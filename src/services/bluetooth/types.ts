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

// The wire schema is versioned (see firmware README) so a future firmware
// field change fails loudly here instead of silently misparsing.
const CRASH_PAYLOAD_VERSION = 1;

export const crashPayloadSchema = z.object({
  v: z.literal(CRASH_PAYLOAD_VERSION),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  impact: z.number(),
  gyro: z.number(),
  tilt: z.number(),
  still: z.boolean(),
  // Whether the device has a stored "neutral mount orientation" reference.
  // If false, `tilt` is degrees from the sensor's raw Z-axis, which means
  // nothing without knowing how the sensor happened to be mounted — treat
  // it as unreliable, not just imprecise.
  calibrated: z.boolean(),
});

export type CrashPayload = z.infer<typeof crashPayloadSchema>;

export interface CrashEvent {
  severity: 1 | 2 | 3 | 4 | 5;
  impact: number;
  gyro: number;
  /** Degrees of deviation from the calibrated mounting position — only meaningful when `calibrated` is true. */
  tilt: number;
  still: boolean;
  calibrated: boolean;
  /** app-side receipt time — the firmware doesn't carry a clock */
  receivedAt: number;
}

export function crashEventFromPayload(payload: CrashPayload): CrashEvent {
  return {
    severity: payload.severity,
    impact: payload.impact,
    gyro: payload.gyro,
    tilt: payload.tilt,
    still: payload.still,
    calibrated: payload.calibrated,
    receivedAt: Date.now(),
  };
}

export interface PairedDevice {
  id: string;
  name: string;
}
