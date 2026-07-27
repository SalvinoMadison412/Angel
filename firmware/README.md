# CrashDetector firmware

Arduino sketch for the ESP32-based crash sensor. Lives in
[`CrashDetector/CrashDetector.ino`](CrashDetector/CrashDetector.ino).

## Hardware

- Arduino Nano ESP32 (or any board supported by `ArduinoBLE` + the ESP32
  Arduino core)
- BMI160 accelerometer/gyroscope on I2C (SDA/SCL to the board's default I2C
  pins), address `0x68` (SDO tied low)

## Libraries

Install via the Arduino Library Manager:

- `ArduinoBLE`

`Wire` ships with the Arduino core. The BMI160 is read via raw I2C register
access (no sensor library dependency) — see the comment above `imuInit()`
in the sketch for why it needs an explicit power-mode-normal command and a
startup delay that a simpler chip like the MPU6050 wouldn't.

## BLE contract

The sketch advertises as **`CrashDetector`** with one custom service/characteristic
pair:

| | UUID |
|---|---|
| Service | `9a0d2e10-66dd-4d3d-930e-a4d0e2806c51` |
| Characteristic (read + notify) | `9a0d2e11-66dd-4d3d-930e-a4d0e2806c51` |

These are **not** standard Bluetooth SIG UUIDs. An earlier revision reused the
GATT Heart Rate Service (`180D`) / Heart Rate Measurement characteristic
(`2A37`) to carry this payload — that caused intermittent notify failures on
some OS BLE stacks, because they apply special parsing/caching to recognized
profiles. If you ever regenerate these UUIDs (`uuidgen`), update
`src/services/bluetooth/types.ts` in the app repo to match — firmware and app
must agree.

### Payload

One JSON notification per detected impact — **not** a continuous stream:

```json
{
  "v": 1,
  "severity": 3,
  "impact": 28450.2,
  "gyro": 19100.7,
  "tilt": 42.1,
  "still": true
}
```

- `v` — payload schema version. Bump this if you add/rename/change the
  meaning of a field, and update the app's parser to branch on it. The app
  will reject any payload where `v` doesn't match what it expects, rather
  than guessing.
- `severity` — int 1-5, computed on-device from the ladder below.
- `impact` — float, peak `|accel|` deviation from resting baseline, **raw
  sensor units** (not converted to g).
- `gyro` — float, peak `|gyro|` magnitude, **raw sensor units** (not
  converted to deg/s).
- `tilt` — float, degrees from vertical at the moment of impact.
- `still` — bool, true if no significant motion was seen for 3s after impact.

## On the severity score

The 1-5 score is a hand-picked threshold ladder (`IMPACT_LOW/HIGH`,
`GYRO_LOW/HIGH`, `TILT_HIGH`, `STILL_MOTION_THRESHOLD` in the sketch), not a
model validated against real crash/non-crash data. It's a reasonable
first-pass triage signal — don't present it as more precise than that (the
app deliberately avoids things like "94% severity" for the same reason).

The raw `(impact, gyro, tilt, still)` tuple is what's worth collecting for
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
3. Install `ArduinoBLE` via Library Manager.
4. Open `CrashDetector.ino`, upload.
5. Open the Serial Monitor at 115200 baud. On boot you should see
   `CrashDetector advertising as "CrashDetector"` and no `[imu] warning:
   unexpected CHIP_ID` line — if you do see that warning, double check the
   BMI160's wiring/address before trusting any readings. Impact triggers
   and sent payloads log here too while testing.
