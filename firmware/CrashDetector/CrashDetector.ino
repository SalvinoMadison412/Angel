// Angel CrashDetector — Arduino Nano ESP32 firmware
//
// Reads a BMI160 accelerometer/gyroscope over I2C, watches for an impact
// spike, and — only when one is detected — pushes a single BLE notification
// with a JSON crash event. This is NOT a continuous telemetry stream: BLE
// central apps should expect long silent stretches punctuated by rare
// notifications.
//
// BLE contract
// ------------
// Earlier revisions of this sketch reused the standard Bluetooth SIG Heart
// Rate Service (0x180D) / Heart Rate Measurement characteristic (0x2A37) to
// carry a non-conforming JSON payload. That's a real bug, not a style nit:
// some OS BLE stacks special-case recognized profiles (parsing/caching the
// value as an actual heart-rate reading), which produces intermittent
// notify failures that look exactly like app-side connection bugs. Fixed
// here by using a custom 128-bit UUID pair instead. Generated with
// `uuidgen`; if you regenerate these, update the app's
// src/services/bluetooth/types.ts to match — the two must stay in sync.
#include <ArduinoBLE.h>
#include <Wire.h>

static const char *CRASH_SERVICE_UUID = "9a0d2e10-66dd-4d3d-930e-a4d0e2806c51";
static const char *CRASH_CHARACTERISTIC_UUID = "9a0d2e11-66dd-4d3d-930e-a4d0e2806c51";
static const char *DEVICE_LOCAL_NAME = "CrashDetector";

// Payload is versioned so future firmware changes (new fields, renamed
// fields, different units) don't silently break the app's parser — the app
// checks `v` before trusting the rest of the shape.
static const int PAYLOAD_VERSION = 1;
static const size_t PAYLOAD_MAX_LEN = 160;

BLEService crashService(CRASH_SERVICE_UUID);
BLEStringCharacteristic crashChar(CRASH_CHARACTERISTIC_UUID, BLERead | BLENotify, PAYLOAD_MAX_LEN);

// ───────────────────────────────────────────────────────────────────────
// BMI160 — raw register access (no external sensor library dependency).
// Default I2C address (SDO tied low). Explicitly configured to ±2g /
// ±2000 dps rather than relying on power-on-reset defaults.
//
// Unlike the MPU6050, the BMI160 boots into a low-power suspend state:
// the accelerometer and gyroscope each need an explicit "set PMU mode
// normal" command before they report real data, and the gyro in
// particular needs on the order of tens of milliseconds to start up.
// Skipping that wait is the most common reason a BMI160 port reads all
// zeros or garbage.
// ───────────────────────────────────────────────────────────────────────
static const uint8_t BMI_ADDR = 0x68;
static const uint8_t REG_CHIP_ID = 0x00;
static const uint8_t REG_GYR_DATA = 0x0C;   // burst read from here: gyro xyz, then accel xyz
static const uint8_t REG_ACC_CONF = 0x40;
static const uint8_t REG_ACC_RANGE = 0x41;
static const uint8_t REG_GYR_CONF = 0x42;
static const uint8_t REG_GYR_RANGE = 0x43;
static const uint8_t REG_CMD = 0x7E;
static const uint8_t CHIP_ID_EXPECTED = 0xD1;
static const uint8_t CMD_ACC_NORMAL_MODE = 0x11;
static const uint8_t CMD_GYR_NORMAL_MODE = 0x15;

struct ImuSample {
  float ax, ay, az; // raw LSB counts, not converted to g — see severity note below
  float gx, gy, gz; // raw LSB counts, not converted to deg/s
};

void bmiWriteReg(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(BMI_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission(true);
}

void imuInit() {
  Wire.begin();
  delay(10); // let the sensor's own power-on-reset settle before talking to it

  Wire.beginTransmission(BMI_ADDR);
  Wire.write(REG_CHIP_ID);
  Wire.endTransmission(false);
  Wire.requestFrom(BMI_ADDR, (uint8_t)1);
  uint8_t chipId = Wire.available() ? Wire.read() : 0x00;
  if (chipId != CHIP_ID_EXPECTED) {
    Serial.print("[imu] warning: unexpected CHIP_ID 0x");
    Serial.println(chipId, HEX);
  }

  bmiWriteReg(REG_ACC_RANGE, 0x03); // ±2g
  bmiWriteReg(REG_ACC_CONF, 0x28);  // normal filter, 100 Hz output data rate
  bmiWriteReg(REG_GYR_RANGE, 0x00); // ±2000 dps
  bmiWriteReg(REG_GYR_CONF, 0x28);  // normal filter, 100 Hz output data rate

  bmiWriteReg(REG_CMD, CMD_ACC_NORMAL_MODE);
  delay(5); // accel normal-mode startup, ~3.8ms typical

  bmiWriteReg(REG_CMD, CMD_GYR_NORMAL_MODE);
  delay(80); // gyro normal-mode startup, up to ~80ms — the step MPU6050 code doesn't need
}

bool imuRead(ImuSample &out) {
  Wire.beginTransmission(BMI_ADDR);
  Wire.write(REG_GYR_DATA);
  if (Wire.endTransmission(false) != 0) return false;

  const uint8_t bytesToRead = 12; // gyro(6) + accel(6)
  if (Wire.requestFrom(BMI_ADDR, bytesToRead) != bytesToRead) return false;

  // BMI160 registers are little-endian (low byte first) — the reverse of
  // the MPU6050's big-endian layout.
  uint8_t gxl = Wire.read(), gxh = Wire.read();
  uint8_t gyl = Wire.read(), gyh = Wire.read();
  uint8_t gzl = Wire.read(), gzh = Wire.read();
  uint8_t axl = Wire.read(), axh = Wire.read();
  uint8_t ayl = Wire.read(), ayh = Wire.read();
  uint8_t azl = Wire.read(), azh = Wire.read();

  out.gx = (int16_t)((gxh << 8) | gxl);
  out.gy = (int16_t)((gyh << 8) | gyl);
  out.gz = (int16_t)((gzh << 8) | gzl);
  out.ax = (int16_t)((axh << 8) | axl);
  out.ay = (int16_t)((ayh << 8) | ayl);
  out.az = (int16_t)((azh << 8) | azl);
  return true;
}

float vecMag(float x, float y, float z) {
  return sqrtf(x * x + y * y + z * z);
}

// Degrees from vertical. Uses raw accel counts directly — the LSB/g scale
// factor cancels out of the ratio, so this is valid without a calibrated
// conversion to physical g units.
float tiltFromVertical(const ImuSample &s) {
  float mag = vecMag(s.ax, s.ay, s.az);
  if (mag < 1.0f) return 0.0f;
  float cosTilt = constrain(s.az / mag, -1.0f, 1.0f);
  return degrees(acos(cosTilt));
}

// ───────────────────────────────────────────────────────────────────────
// Severity ladder — a hand-picked first pass, NOT validated against real
// crash / non-crash data. Treat these constants as a rough triage signal
// to unblock app development, not a calibrated model. See the app repo's
// AGENTS.md section 4 for the planned calibration follow-up (log raw
// tuples + human-labeled ground truth, fit an ordinal classifier, keep
// these on-device thresholds only as a cheap pre-filter that decides
// whether to wake BLE at all).
//
// These numbers implicitly assume the ±2g / ±2000 dps ranges configured in
// imuInit() above — if you change either range, these thresholds are
// scaled wrong until re-tuned (roughly linearly: e.g. switching gyro range
// to ±1000 dps would double the raw counts for the same physical rotation).
// ───────────────────────────────────────────────────────────────────────
static const float IMPACT_TRIGGER = 20000.0f; // raw accel-magnitude deviation that starts an impact window
static const float IMPACT_LOW = 24000.0f;
static const float IMPACT_HIGH = 34000.0f;
static const float GYRO_LOW = 15000.0f;
static const float GYRO_HIGH = 26000.0f;
static const float TILT_HIGH = 55.0f;    // degrees
static const float STILL_MOTION_THRESHOLD = 1500.0f; // raw accel-magnitude jitter tolerated while "still"
static const unsigned long STILL_WINDOW_MS = 3000;
static const unsigned long IMPACT_COOLDOWN_MS = 5000; // ignore retriggers right after sending an event
static const unsigned long SAMPLE_INTERVAL_MS = 10;   // ~100 Hz

int bandOf(float value, float low, float high) {
  if (value >= high) return 2;
  if (value >= low) return 1;
  return 0;
}

int severityFromScore(int score) {
  // score ranges 0-6 (impact 0-2 + gyro 0-2 + tilt 0-1 + still 0-1) -> 1-5.
  int severity = 1 + (int)round(score * 4.0f / 6.0f);
  return constrain(severity, 1, 5);
}

// ───────────────────────────────────────────────────────────────────────
// Impact state machine
// ───────────────────────────────────────────────────────────────────────
enum class ImpactState { IDLE, WATCHING_STILLNESS, COOLDOWN };

ImpactState state = ImpactState::IDLE;
float restingMag = 16384.0f; // ~1g at power-on in raw counts; refined by a running baseline below
float peakImpactMag = 0.0f;
float peakGyroMag = 0.0f;
float tiltAtImpact = 0.0f;
bool stillnessBroken = false;
unsigned long windowStartedAt = 0;
unsigned long cooldownStartedAt = 0;

void resetImpactWindow() {
  peakImpactMag = 0.0f;
  peakGyroMag = 0.0f;
  tiltAtImpact = 0.0f;
  stillnessBroken = false;
}

void sendCrashEvent(int severity, float impact, float gyro, float tilt, bool still) {
  // Fixed field order/precision keeps payloads small and diffable in logs.
  char json[PAYLOAD_MAX_LEN];
  snprintf(
    json, sizeof(json),
    "{\"v\":%d,\"severity\":%d,\"impact\":%.1f,\"gyro\":%.1f,\"tilt\":%.1f,\"still\":%s}",
    PAYLOAD_VERSION, severity, impact, gyro, tilt, still ? "true" : "false"
  );

  crashChar.writeValue(json);
  Serial.print("[crash] sent: ");
  Serial.println(json);
}

void setup() {
  Serial.begin(115200);
  imuInit();

  if (!BLE.begin()) {
    Serial.println("BLE init failed — halting");
    while (1) { delay(1000); }
  }

  BLE.setLocalName(DEVICE_LOCAL_NAME);
  BLE.setAdvertisedService(crashService);
  crashService.addCharacteristic(crashChar);
  BLE.addService(crashService);
  crashChar.writeValue(""); // no event yet
  BLE.advertise();

  Serial.println("CrashDetector advertising as \"CrashDetector\"");
}

void loop() {
  static unsigned long lastSampleAt = 0;
  unsigned long now = millis();
  if (now - lastSampleAt < SAMPLE_INTERVAL_MS) {
    BLE.poll();
    return;
  }
  lastSampleAt = now;
  BLE.poll();

  ImuSample sample;
  if (!imuRead(sample)) return;

  float accelMag = vecMag(sample.ax, sample.ay, sample.az);
  float gyroMag = vecMag(sample.gx, sample.gy, sample.gz);
  float deviation = fabs(accelMag - restingMag);

  switch (state) {
    case ImpactState::IDLE: {
      // Slow running baseline so normal riding vibration doesn't drift into
      // "impact" — only updated while nothing is happening.
      restingMag = restingMag * 0.995f + accelMag * 0.005f;

      if (deviation >= IMPACT_TRIGGER) {
        resetImpactWindow();
        peakImpactMag = deviation;
        peakGyroMag = gyroMag;
        tiltAtImpact = tiltFromVertical(sample);
        windowStartedAt = now;
        state = ImpactState::WATCHING_STILLNESS;
        Serial.println("[crash] impact trigger — watching for stillness");
      }
      break;
    }

    case ImpactState::WATCHING_STILLNESS: {
      peakImpactMag = max(peakImpactMag, deviation);
      peakGyroMag = max(peakGyroMag, gyroMag);
      if (deviation > STILL_MOTION_THRESHOLD) stillnessBroken = true;

      if (now - windowStartedAt >= STILL_WINDOW_MS) {
        bool still = !stillnessBroken;
        int score = bandOf(peakImpactMag, IMPACT_LOW, IMPACT_HIGH)
                  + bandOf(peakGyroMag, GYRO_LOW, GYRO_HIGH)
                  + (tiltAtImpact >= TILT_HIGH ? 1 : 0)
                  + (still ? 1 : 0);
        int severity = severityFromScore(score);

        sendCrashEvent(severity, peakImpactMag, peakGyroMag, tiltAtImpact, still);

        cooldownStartedAt = now;
        state = ImpactState::COOLDOWN;
      }
      break;
    }

    case ImpactState::COOLDOWN: {
      if (now - cooldownStartedAt >= IMPACT_COOLDOWN_MS) {
        state = ImpactState::IDLE;
      }
      break;
    }
  }
}
