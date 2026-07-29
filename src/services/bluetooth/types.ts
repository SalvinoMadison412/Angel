import { z } from "zod";

// Must match firmware/CrashDetector/CrashDetector.ino exactly — see that
// file's header comment before regenerating either of these.
export const CRASH_SERVICE_UUID = "9a0d2e10-66dd-4d3d-930e-a4d0e2806c51";
export const CRASH_CHARACTERISTIC_UUID = "9a0d2e11-66dd-4d3d-930e-a4d0e2806c51";
// Writable — a single-byte write triggers the device to average ~1s of
// accelerometer samples and store the result as its new "neutral mount
// orientation" reference in flash. See CalibrateSensorScreen.
export const CALIBRATE_CHARACTERISTIC_UUID = "9a0d2e12-66dd-4d3d-930e-a4d0e2806c51";
export const DEVICE_LOCAL_NAME = "CrashDetector";

export type ConnectionState = "disconnected" | "scanning" | "connecting" | "connected" | "error";

// Firmware now converts to physical units on-device and sends impact_g /
// gyro_dps directly — no raw-count conversion needed on the app side.
const severityLiteral = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

// Sent once per firmware loop iteration — the continuous stream that drives
// the app's live IMPACT/ROTATION/LEAN cards. No `trigger`/`severity`: those
// only mean something for a detected "crash" event below.
export const telemetryMessageSchema = z.object({
  type: z.literal("telemetry"),
  impact_g: z.number(),
  gyro_dps: z.number(),
  tilt: z.number(),
  still: z.boolean(),
  calibrated: z.boolean(),
});

// Every notification carries a `type` discriminator, checked before
// anything else about the message is trusted — a "fault" and a "crash"
// payload have no fields in common and must never share a code path.
export const crashMessageSchema = z.object({
  type: z.literal("crash"),
  trigger: z.enum(["impact", "tilt"]),
  severity: severityLiteral,
  impact_g: z.number(),
  gyro_dps: z.number(),
  tilt: z.number(),
  still: z.boolean(),
  // Whether the device has a stored "neutral mount orientation" reference.
  // If false, `tilt` is degrees from the sensor's raw Z-axis, which means
  // nothing without knowing how the sensor happened to be mounted — treat
  // it as unreliable, not just imprecise.
  calibrated: z.boolean(),
});

// A device-health problem (e.g. the IMU stopped responding over I2C) — not
// a personal emergency. Must never reach the crash-alert/dispatch pipeline.
export const faultMessageSchema = z.object({
  type: z.literal("fault"),
  reason: z.string(),
});

export const faultClearedMessageSchema = z.object({
  type: z.literal("fault_cleared"),
});

// Confirms an in-progress calibrate() write actually finished and was
// stored — sent asynchronously over the same notify channel, separately
// from the write's own ack. Keeps the persisted `calibrated` flag honest
// even if the write ack alone isn't a reliable "done" signal.
export const calibrationCompleteMessageSchema = z.object({
  type: z.literal("calibration_complete"),
  calibrated: z.boolean(),
});

export const crashDetectorMessageSchema = z.discriminatedUnion("type", [
  telemetryMessageSchema,
  crashMessageSchema,
  faultMessageSchema,
  faultClearedMessageSchema,
  calibrationCompleteMessageSchema,
]);

export type CrashMessage = z.infer<typeof crashMessageSchema>;
export type CrashDetectorMessage = z.infer<typeof crashDetectorMessageSchema>;

export interface CrashEvent {
  severity: 1 | 2 | 3 | 4 | 5;
  /** What triggered this event — a hard impact spike, or a sustained extreme tilt with no qualifying impact. */
  trigger: "impact" | "tilt";
  /** Force of the hit, in g's. */
  impactG: number;
  /** How fast the bike was spinning/tumbling, in degrees/second. */
  gyroDps: number;
  /** Degrees of deviation from the calibrated mounting position — only meaningful when `calibrated` is true. */
  tilt: number;
  still: boolean;
  calibrated: boolean;
  /** app-side receipt time — the firmware doesn't carry a clock */
  receivedAt: number;
}

export function crashEventFromMessage(message: CrashMessage): CrashEvent {
  return {
    severity: message.severity,
    trigger: message.trigger,
    impactG: message.impact_g,
    gyroDps: message.gyro_dps,
    tilt: message.tilt,
    still: message.still,
    calibrated: message.calibrated,
    receivedAt: Date.now(),
  };
}

export type TelemetryMessage = z.infer<typeof telemetryMessageSchema>;

/** A single continuous-stream reading — see `type: "telemetry"` in firmware/README.md. */
export interface TelemetryReading {
  /** Instantaneous force magnitude, in g's. */
  impactG: number;
  /** Instantaneous gyro magnitude, in degrees/second. */
  gyroDps: number;
  /** Degrees of deviation from the calibrated mounting position — only meaningful when `calibrated` is true. */
  tilt: number;
  still: boolean;
  calibrated: boolean;
  /** app-side receipt time — the firmware doesn't carry a clock */
  receivedAt: number;
}

export function telemetryReadingFromMessage(message: TelemetryMessage): TelemetryReading {
  return {
    impactG: message.impact_g,
    gyroDps: message.gyro_dps,
    tilt: message.tilt,
    still: message.still,
    calibrated: message.calibrated,
    receivedAt: Date.now(),
  };
}

export interface DeviceFault {
  reason: string;
  /** app-side receipt time — the firmware doesn't carry a clock */
  receivedAt: number;
}

export interface CalibrationConfirmation {
  calibrated: boolean;
  /**
   * app-side receipt time — the firmware doesn't carry a clock. Distinct
   * confirmations always produce a new object even when `calibrated` is
   * the same boolean as last time (e.g. recalibrating an already-calibrated
   * device), so callers can tell "a fresh confirmation arrived" apart from
   * "the value happens to be unchanged" — a plain boolean can't.
   */
  receivedAt: number;
}

export interface PairedDevice {
  id: string;
  name: string;
}
