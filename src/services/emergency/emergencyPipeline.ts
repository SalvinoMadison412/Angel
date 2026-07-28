import { File, Paths } from "expo-file-system";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { CrashEvent } from "../bluetooth";
import { MedicalSnapshot, notificationService } from "../notifications";
import { Guardian, Incident } from "../../types/database";

export const DEFAULT_COUNTDOWN_SECONDS = 10;

/** A severity-1 event is logged for calibration but never interrupts the rider. */
export function shouldTriggerAlert(event: CrashEvent): boolean {
  return event.severity >= 2;
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

  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const position = await Location.getCurrentPositionAsync({});
      lat = position.coords.latitude;
      lng = position.coords.longitude;
    }
  } catch (err) {
    console.warn("[emergency] failed to capture location for incident", err);
  }

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
