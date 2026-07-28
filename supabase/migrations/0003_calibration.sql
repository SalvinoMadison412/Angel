-- Sensor mount calibration. The firmware now stores a "neutral mount
-- orientation" reference on-device (BLE write to the calibrate
-- characteristic — see firmware/README.md) and reports tilt as deviation
-- from that reference rather than raw degrees from vertical, which is
-- meaningless until the sensor has been zeroed to its actual mounting
-- angle on a given bike.
--
-- devices.calibrated tracks whether a full calibration has ever
-- succeeded for the paired device (drives the "not calibrated" banner and
-- gates the setup flow). incidents.calibrated is the per-event flag the
-- device reported at the moment of that specific crash — kept alongside
-- the raw metrics so a stale/historical incident's tilt value can be
-- judged trustworthy or not on its own.

alter table public.devices
  add column if not exists calibrated boolean not null default false;

alter table public.incidents
  add column if not exists calibrated boolean;
