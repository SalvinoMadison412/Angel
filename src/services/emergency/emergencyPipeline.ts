import { File, Paths } from "expo-file-system";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { CrashEvent } from "../bluetooth";
import { MedicalSnapshot, notificationService, presentCrashConfirmedAlert } from "../notifications";
import { getLastKnownCoords } from "../location/locationTracking";
import { Guardian, Incident } from "../../types/database";

export const DEFAULT_COUNTDOWN_SECONDS = 10;
// Severity-1 events go through the lighter guardians-only countdown
// (EmergencyCountdownScreen) instead of the full crash-alert/dispatch flow
// below — see shouldTriggerAlert. Longer than DEFAULT_COUNTDOWN_SECONDS on
// purpose: a severity-1 reading is the least certain signal, so the rider
// gets more time to notice and cancel before guardians are texted.
export const EMERGENCY_COUNTDOWN_SECONDS = 30;

/** A severity-1 event routes to the lighter guardians-only countdown instead of the full dispatch flow. */
export function shouldTriggerAlert(event: CrashEvent): boolean {
  return event.severity >= 2;
}

type NotifyReason = "missed_checkin" | "confirmed_crash";

// Shared call into the real notify-guardians edge function (Twilio SMS) —
// both alert paths below go through this so severity 1 (missed check-in)
// and severity 2-5 (confirmed crash) guardians get an actual text, not just
// the in-app incident_events log. Best-effort by design: the caller decides
// whether a failure here should block anything else.
async function invokeNotifyGuardians(input: {
  userId: string;
  severity: number;
  receivedAt: number;
  lat: number | null;
  lng: number | null;
  reason: NotifyReason;
}): Promise<{ sent: number }> {
  const { data, error } = await supabase.functions.invoke("notify-guardians", {
    body: {
      rider_id: input.userId,
      severity: input.severity,
      timestamp: new Date(input.receivedAt).toISOString(),
      lat: input.lat,
      lng: input.lng,
      reason: input.reason,
    },
  });
  if (error) {
    // supabase-js's FunctionsHttpError only ever carries a generic "Edge
    // Function returned a non-2xx status code" message — the actual reason
    // (from notify-guardians' own jsonResponse({ error }, 500) body) sits
    // unread on error.context, a Response. Surface it so callers' logs show
    // what actually failed instead of just the status code.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.clone().json();
        if (body?.error) error.message = `${error.message}: ${body.error}`;
      } catch {
        // context wasn't JSON (e.g. a network-level failure) — fall back to
        // the generic message rather than throwing a secondary error here.
      }
    }
    throw error;
  }
  console.log("[emergency] notify-guardians response", JSON.stringify(data));
  // `whatsAppSent` reflects the immediate-phase result only — the edge
  // function's backup voice calls fire 30s later in the background (via
  // EdgeRuntime.waitUntil) and aren't reflected in this response.
  return { sent: typeof data?.whatsAppSent === "number" ? data.whatsAppSent : 0 };
}

// Best-effort GPS capture shared by both alert paths below — never blocks
// or throws past this function; a crash alert must still go out even if
// location permission was denied or the fix times out. Prefers the cached
// fix from the live watch (locationTracking.ts, running continuously once
// permission is granted — see LocationPermissionScreen/RootNavigator) so
// this resolves instantly instead of waiting on a fresh GPS fix at exactly
// the moment that matters least to be slow. Falls back to a fresh
// getCurrentPositionAsync() only if no cached fix exists yet (e.g. the
// watch only just started, or permission was granted this same session
// before a fix had time to arrive).
async function captureCurrentLocation(): Promise<{ lat: number | null; lng: number | null }> {
  const cached = getLastKnownCoords();
  if (cached) return cached;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { lat: null, lng: null };
    const position = await Location.getCurrentPositionAsync({});
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (err) {
    console.warn("[emergency] failed to capture location", err);
    return { lat: null, lng: null };
  }
}

// ───────────────────────────────────────────────────────────────────────
// Local event log — every CrashEvent the sensor sends, cancelled or not,
// gets appended here with its outcome. This is the raw material for the
// calibration work described in the firmware README (the on-device
// threshold ladder was never validated against real crash/non-crash data);
// nothing reads this file yet, but not collecting it now would make that
// work impossible later.
//
// RETENTION (privacy-policy alignment pass): this file is on-device,
// append-only, and unbounded — every logged line (including raw impactG/
// gyroDps/tilt/still, not just the computed severity) stays in app storage
// indefinitely; there is no purge, TTL, or size cap here. Unlike the
// `incidents` table (see migration 0002), this local log is NOT currently
// described anywhere in PRIVACY_POLICY.md. Flagged, not fixed here — before
// release, either (a) add this local log to the policy's "Bluetooth /
// sensor data" section, or (b) stop persisting it / add rotation, since
// right now it's real on-device data collection the policy doesn't
// disclose.
// ───────────────────────────────────────────────────────────────────────
export type CrashEventOutcome = "below_threshold" | "cancelled" | "confirmed";

const LOCAL_LOG_FILE_NAME = "crash_events.jsonl";

function getLocalLogFile(): File {
  return new File(Paths.document, LOCAL_LOG_FILE_NAME);
}

export async function logCrashEventLocally(event: CrashEvent, outcome: CrashEventOutcome): Promise<void> {
  try {
    const file = getLocalLogFile();
    const line = `${JSON.stringify({ ...event, outcome, loggedAt: Date.now() })}\n`;
    const existing = file.exists ? file.textSync() : "";
    if (!file.exists) file.create();
    file.write(existing + line);
  } catch (err) {
    // Best-effort only — losing a calibration log line must never take
    // down the emergency flow itself.
    console.warn("[emergency] failed to write local crash log", err);
  }
}

// ───────────────────────────────────────────────────────────────────────
// Confirmed-incident path — runs once the cancel countdown in
// CrashAlertScreen expires without the rider cancelling.
// ───────────────────────────────────────────────────────────────────────
export interface ConfirmIncidentInput {
  event: CrashEvent;
  userId: string;
  deviceId: string | null;
  guardians: Guardian[];
}

export async function confirmIncident({ event, userId, deviceId, guardians }: ConfirmIncidentInput): Promise<Incident> {
  await logCrashEventLocally(event, "confirmed");

  const { lat, lng } = await captureCurrentLocation();

  // Raw sensor readings (impact/gyro/tilt/still) are written here alongside
  // the computed severity and retained indefinitely with the rest of the
  // incidents row — see migration 0002_crash_metrics.sql for exactly what
  // "retained" means here and what it maps to in PRIVACY_POLICY.md.
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      user_id: userId,
      device_id: deviceId,
      severity: event.severity,
      impact: event.impactG,
      gyro: event.gyroDps,
      tilt: event.tilt,
      still: event.still,
      calibrated: event.calibrated,
      lat,
      lng,
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;

  const incident = data as Incident;

  // MEDICAL DATA VISIBILITY (privacy-policy alignment pass, audited against
  // the real crash_tickets/Angel Partners flow): medicalInfo below only
  // ever reaches notificationService.notifyGuardians() — today that's
  // MockNotificationService, which logs a "medical profile included"
  // summary into incident_events (RLS: rider-only, see 0001_init.sql) and
  // nothing else. It is never attached to the crash_tickets row created in
  // CrashAlertScreen (that insert has no medical columns — see its schema
  // in migration 0005), and emergency_profiles' RLS
  // (migration 0004_onboarding.sql) grants select/insert/update/delete to
  // `auth.uid() = user_id` only — no policy grants a partner access, at any
  // ticket status. Confirmed empirically too: nothing under angel-partners/
  // (TicketAlertScreen, ActiveResponseScreen, useTickets.ts) ever queries
  // emergency_profiles or reads a medical field. So the real current
  // behavior is stricter than "gated on acceptance" — a partner cannot see
  // medical data at any point in the current build, not just before
  // accepting. PRIVACY_POLICY.md's "shared with a dispatched responder at
  // the moment of a confirmed crash alert" describes intended v2 behavior,
  // not what this codebase actually does today — worth reconciling before
  // that line is relied on as an accurate description of current behavior.
  let medicalInfo: MedicalSnapshot = null;
  try {
    const { data: emergencyProfile, error: profileError } = await supabase
      .from("emergency_profiles")
      .select("full_name, blood_group, medical_conditions")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    medicalInfo = emergencyProfile;
  } catch (err) {
    // A confirmed crash must still notify guardians even if the medical
    // lookup fails — this is enrichment, not a precondition for the alert.
    console.warn("[emergency] failed to load emergency profile for notification", err);
  }

  await notificationService.notifyGuardians(incident, guardians, medicalInfo);

  // Confirmed severity 2-5 crashes must reach guardians by real SMS, not
  // just the incident_events log above — that log only ever surfaces inside
  // the app's own Live Incident screen, which a guardian has no reason to
  // be looking at. Best-effort: a failure here must not undo the dispatch
  // that already happened above.
  if (guardians.length > 0) {
    try {
      const { sent } = await invokeNotifyGuardians({
        userId,
        severity: event.severity,
        receivedAt: event.receivedAt,
        lat,
        lng,
        reason: "confirmed_crash",
      });
      await notificationService.logEvent(incident.id, `SMS sent to ${sent}/${guardians.length} guardian(s)`);
    } catch (err) {
      console.warn("[emergency] failed to send guardian SMS for confirmed crash", err);
      await notificationService.logEvent(incident.id, "Guardian SMS failed to send — will not retry automatically");
    }
  }

  // Rider-facing confirmation that the alert actually went out — additive on
  // top of the guardian SMS/log above, never blocking it. See angelAlerts.ts.
  presentCrashConfirmedAlert().catch((err) =>
    console.warn("[notifications] failed to present crash-confirmed alert", err)
  );

  return incident;
}

export async function cancelCrashEvent(event: CrashEvent): Promise<void> {
  await logCrashEventLocally(event, "cancelled");
}

// ───────────────────────────────────────────────────────────────────────
// Guardians-only alert path — runs once EmergencyCountdownScreen's 30s
// countdown expires without the rider cancelling. Deliberately lighter
// than confirmIncident() above: no incidents row, no crash_tickets row —
// just a real WhatsApp message to every guardian on record, sent
// server-side via the notify-guardians Supabase Edge Function (Twilio).
// See supabase/functions/notify-guardians for the delivery side.
// ───────────────────────────────────────────────────────────────────────
export interface SendGuardianAlertInput {
  event: CrashEvent;
  userId: string;
}

export interface SendGuardianAlertResult {
  /** How many guardians the edge function actually got an SMS out to. */
  sent: number;
}

export async function sendGuardianAlert({ event, userId }: SendGuardianAlertInput): Promise<SendGuardianAlertResult> {
  await logCrashEventLocally(event, "confirmed");

  const { lat, lng } = await captureCurrentLocation();

  const result = await invokeNotifyGuardians({
    userId,
    severity: event.severity,
    receivedAt: event.receivedAt,
    lat,
    lng,
    reason: "missed_checkin",
  });

  presentCrashConfirmedAlert().catch((err) =>
    console.warn("[notifications] failed to present crash-confirmed alert", err)
  );

  return result;
}
