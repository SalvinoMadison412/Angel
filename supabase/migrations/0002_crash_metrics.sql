-- Adds the raw BLE crash-event metrics to incidents so the severity score
-- can be recalibrated later without losing the underlying sensor data. See
-- firmware/README.md for the payload these come from — the on-device
-- severity ladder is a first pass, not a validated model, so keeping the
-- raw tuple around (not just the derived severity int) is what makes a
-- future recalibration possible at all.

alter table public.incidents
  add column if not exists impact numeric,
  add column if not exists gyro numeric,
  add column if not exists tilt numeric,
  add column if not exists still boolean;
