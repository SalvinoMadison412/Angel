# CrashDetector firmware

Arduino sketch for the ESP32-based crash sensor. Lives in
[`CrashDetector/CrashDetector.ino`](CrashDetector/CrashDetector.ino).

## Hardware

- Arduino Nano ESP32 (or any board supported by `ArduinoBLE` + the ESP32
  Arduino core)
- BMI160 accelerometer/gyroscope on I2C (SDA/SCL to the board's default I2C
  pins), address `0x69`

## Libraries

Install via the Arduino Library Manager:

- `ArduinoBLE`
- `DFRobot_BMI160`

`Wire` and `Preferences` ship with the ESP32 Arduino core.

## BLE contract

The sketch advertises as **`CrashDetector`** with one custom service and two
characteristics:

| | UUID |
|---|---|
| Service | `9a0d2e10-66dd-4d3d-930e-a4d0e2806c51` |
| Telemetry characteristic (read + notify) | `9a0d2e11-66dd-4d3d-930e-a4d0e2806c51` |
| Calibrate characteristic (write) | `9a0d2e12-66dd-4d3d-930e-a4d0e2806c51` |

These are **not** standard Bluetooth SIG UUIDs. An earlier revision reused the
GATT Heart Rate Service (`180D`) / Heart Rate Measurement characteristic
(`2A37`) to carry this payload — that caused intermittent notify failures on
some OS BLE stacks, because they apply special parsing/caching to recognized
profiles. If you ever regenerate these UUIDs (`uuidgen`), update
`src/services/bluetooth/types.ts` in the app repo to match — firmware and app
must agree.

### Calibrating the mount

Every bike mounts the sensor at a different angle, so raw tilt off the
sensor's own Z-axis is meaningless on its own — 70° could be a real fall on
one bike and normal parked orientation on another. Writing any single byte
to the calibrate characteristic tells the device to average ~50
accelerometer samples (~1s) and store the result as its "neutral mount
orientation" reference in flash (`Preferences`/NVS), surviving power loss
between rides. From then on, telemetry's `tilt` field is degrees of
deviation from *that* reference, not from vertical. The app's
`CalibrateSensorScreen` triggers this after pairing and again from the
Device tab any time the sensor is remounted.

### Payload

Every notification carries a `type` field, and the app branches on it before
touching anything else about the message — a `fault` and a `crash` share no
fields and must never be handled by the same code path. There is no `v`
(schema version) field on this revision; `type` is what the app checks
first, and an unrecognized shape is dropped rather than guessed at.

#### `type: "telemetry"`

Sent once per loop iteration — this **is** the continuous stream, and it's
what drives the live IMPACT/ROTATION/LEAN cards on the app's Home screen:

```json
{
  "type": "telemetry",
  "impact_g": 0.98,
  "gyro_dps": 12.4,
  "tilt": 2.1,
  "still": true,
  "calibrated": true
}
```

Same field meanings as the matching fields on `crash` below, just sampled
continuously instead of only at the moment of a detected event. No
`trigger`/`severity` — those only mean something for a `crash`.

#### `type: "crash"`

One notification per detected event, layered on top of the `telemetry`
stream above — the app treats this as a separate, rarer signal that carries
extra fields (`trigger`, `severity`) the continuous stream doesn't:

```json
{
  "type": "crash",
  "trigger": "impact",
  "severity": 3,
  "impact_g": 1.74,
  "gyro_dps": 1165.3,
  "tilt": 42.1,
  "still": true,
  "calibrated": true
}
```

- `trigger` — `"impact"` (a hard impact spike) or `"tilt"` (a sustained
  extreme tilt held for 4s with no qualifying impact — catches slow
  tip-overs and a sensor that's been dislodged/thrown). These are different
  situations and the app shows distinct copy for each.
- `severity` — int 1-5, computed on-device from the ladder below.
- `impact_g` — float, peak `|accel|` deviation from resting baseline,
  already converted to g's on-device.
- `gyro_dps` — float, peak `|gyro|` magnitude, already converted to
  degrees/second on-device.
- `tilt` — float, degrees of deviation from the calibrated mount reference
  at the moment of the event. Only meaningful when `calibrated` is true —
  see above.
- `still` — bool, true if no significant motion was seen for 3s after.
- `calibrated` — bool, whether a mount reference has been stored via the
  calibrate characteristic. If false, ignore `tilt` — the device hasn't
  been zeroed yet, so it's degrees from the raw sensor axis instead.

#### `type: "fault"` / `"fault_cleared"`

```json
{ "type": "fault", "reason": "sensor_communication_lost" }
```
```json
{ "type": "fault_cleared" }
```

Sent when the IMU stops responding over I2C for `FAULT_CONSECUTIVE_LIMIT`
(100) consecutive reads, and again once reads succeed again. This is a
device-health problem, not a personal emergency — the app shows a banner on
the Device screen and never routes this through the crash-alert/dispatch
pipeline.

#### `type: "calibration_complete"`

```json
{ "type": "calibration_complete", "calibrated": true }
```

Sent once a calibrate-characteristic write has actually finished averaging
samples and been stored — asynchronously, not as the write's own ack. The
app treats this as the authoritative signal for whether the mount reference
is set, syncing its persisted `calibrated` flag from it.

## On the severity score

The 1-5 score is a hand-picked threshold ladder (`IMPACT_LOW_G/HIGH_G`,
`GYRO_LOW_DPS/HIGH_DPS`, `TILT_HIGH_DEG`, `STILL_THRESH_G` in the sketch),
not a model validated against real crash/non-crash data. It's a reasonable
first-pass triage signal — don't present it as more precise than that (the
app deliberately avoids things like "94% severity" for the same reason).

The `(impact_g, gyro_dps, tilt, still)` tuple is what's worth collecting for
future calibration — the app logs every event locally, cancelled or not, for
exactly this reason. If you want to improve the score later: log labeled
rides, fit an ordinal classifier (or a manually tuned weighted sum with
percentile-based cut points) on the raw tuples, and keep the on-device
thresholds only as a cheap pre-filter that decides whether to wake BLE for a
sample at all — let the phone re-score with the calibrated model once it has
the raw metrics.

## Flashing

1. Arduino IDE → Boards Manager → install **"Arduino ESP32 Boards"** (the
   official Arduino package — this is what makes `ArduinoBLE` work on this
   board; the community `esp32` core is a different package and isn't what
   this depends on).
2. Tools → Board → select **Arduino Nano ESP32**, then select the port.
3. Install `ArduinoBLE` and `DFRobot_BMI160` via Library Manager.
4. Open `CrashDetector.ino`, upload.
5. Open the Serial Monitor at 115200 baud. On boot you should see `Ready.
   Sensor OK.` — if you instead see `Ready. WARNING: sensor not
   responding.` (or `sensor reset failed` / `sensor init failed` earlier in
   the log), double check the BMI160's wiring/address before trusting any
   readings. Crash triggers and sent payloads log here too while testing.
