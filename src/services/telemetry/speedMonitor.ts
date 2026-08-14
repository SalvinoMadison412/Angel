// Speed alert monitor. The notification-system brief calls for watching
// "live speed from BLE telemetry" — but the firmware protocol (see
// bluetooth/types.ts's telemetryMessageSchema) has no speed field today,
// only impact_g/gyro_dps/tilt/still. GPS speed from the same location watch
// that already backs crash-location capture (locationTracking.ts) is the
// only real speed source in this codebase, so that's what drives this —
// same threshold/cooldown state machine either way, so swapping in a real
// BLE speed field later (if firmware ever adds one) is a one-line change at
// the subscribeSpeedKmh() call below.
import { subscribeSpeedKmh } from "../location/locationTracking";
import { presentSpeedAlert } from "../notifications/angelAlerts";

const HIGH_SPEED_THRESHOLD_KMH = 80;
const RESET_THRESHOLD_KMH = 70;
const SUSTAINED_MS = 3000;
const COOLDOWN_MS = 5 * 60 * 1000;

let unsubscribe: (() => void) | null = null;
let aboveSince: number | null = null;
let cooldownUntil = 0;

function handleSpeed(speedKmh: number | null) {
  const now = Date.now();

  if (speedKmh == null) {
    aboveSince = null;
    return;
  }

  if (speedKmh < RESET_THRESHOLD_KMH) {
    // Dropping back below the (lower) reset threshold clears both the
    // sustained-speed timer and any active cooldown — a rider who's slowed
    // down for a while gets a fresh alert if they speed up again, rather
    // than waiting out the rest of a 5-minute window from the last spike.
    aboveSince = null;
    cooldownUntil = 0;
    return;
  }

  if (speedKmh < HIGH_SPEED_THRESHOLD_KMH) {
    // Between the reset and alert thresholds — neither accumulating nor
    // resetting; a spike back above HIGH_SPEED_THRESHOLD_KMH continues the
    // same sustained window if one was already running.
    return;
  }

  if (aboveSince == null) aboveSince = now;
  if (now - aboveSince < SUSTAINED_MS) return;
  if (now < cooldownUntil) return;

  cooldownUntil = now + COOLDOWN_MS;
  presentSpeedAlert().catch((err) => console.warn("[speed-monitor] failed to present speed alert", err));
}

/** Idempotent — safe to call repeatedly without stacking subscriptions. */
export function startSpeedMonitor(): void {
  if (unsubscribe) return;
  unsubscribe = subscribeSpeedKmh(handleSpeed);
}

export function stopSpeedMonitor(): void {
  unsubscribe?.();
  unsubscribe = null;
  aboveSince = null;
  cooldownUntil = 0;
}
