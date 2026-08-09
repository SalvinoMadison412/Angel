-- Adds the raw BLE crash-event metrics to incidents so the severity score
-- can be recalibrated later without losing the underlying sensor data. See
-- firmware/README.md for the payload these come from — the on-device
-- severity ladder is a first pass, not a validated model, so keeping the
-- raw tuple around (not just the derived severity int) is what makes a
-- future recalibration possible at all.
--
-- RETENTION, stated plainly (privacy-policy alignment pass): these columns
-- are retained INDEFINITELY as a permanent part of the incidents row, not
-- deleted or nulled out once severity is computed. This matches
-- PRIVACY_POLICY.md's "Crash and incident records" section ("we record the
-- event (severity, sensor readings, location, timestamp) so it can be ...
-- reviewed by you afterward in your incident history") and its "Data
-- retention & deletion" section (kept while the account is active, removed
-- on an explicit account-deletion request) — there is no separate,
-- shorter-lived retention window for the raw sensor fields specifically.
-- If a policy of NOT retaining raw sensor data beyond crash processing is
-- ever adopted instead, this table needs an actual code change (a
-- post-processing null-out or a TTL delete job), not just a comment update.

alter table public.incidents
  add column if not exists impact numeric,
  add column if not exists gyro numeric,
  add column if not exists tilt numeric,
  add column if not exists still boolean;
