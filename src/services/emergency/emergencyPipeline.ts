import { File, Paths } from "expo-file-system";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { CrashEvent } from "../bluetooth";
import { MedicalSnapshot, notificationService } from "../notifications";
import { Guardian, Incident } from "../../types/database";

export const DEFAULT_COUNTDOWN_SECONDS = 10;
// Severity-1 events go through the lighter guardians-only countdown
// (EmergencyCountdownScreen) instead of the full responder-dispatch flow
// below — see shouldTriggerAlert. Longer than DEFAULT_COUNTDOWN_SECONDS on
// purpose: a severity-1 reading is the least certain signal, so the rider
// gets more time to notice and cancel before guardians are texted.
export const EMERGENCY_COUNTDOWN_SECONDS = 30;

/** A severity-1 event routes to the lighter guardians-only countdown instead of the full dispatch flow. */
export function shouldTriggerAlert(event: CrashEvent): boolean {
  return event.severity >= 2;
}

// Best-effort GPS capture shared by both alert paths below — never blocks
// or throws past this function; a crash alert must still go out even if
// location permission was denied or the fix times out.
async function captureCurrentLocation(): Promise<{ lat: number | null; lng: number | null }> {
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
  return incident;
}

export async function cancelCrashEvent(event: CrashEvent): Promise<void> {
  await logCrashEventLocally(event, "cancelled");
}

// ───────────────────────────────────────────────────────────────────────
// Guardians-only alert path — runs once EmergencyCountdownScreen's 30s
// countdown expires without the rider cancelling. Deliberately lighter
// than confirmIncident() above: no incidents row, no responder dispatch —
// just a real SMS to every guardian on record, sent server-side via the
// notify-guardians Supabase Edge Function (Twilio). See
// supabase/functions/notify-guardians for the delivery side.
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

  const { data, error } = await supabase.functions.invoke("notify-guardians", {
    body: {
      rider_id: userId,
      severity: event.severity,
      timestamp: new Date(event.receivedAt).toISOString(),
      lat,
      lng,
    },
  });
  if (error) throw error;

  return { sent: typeof data?.sent === "number" ? data.sent : 0 };
}
