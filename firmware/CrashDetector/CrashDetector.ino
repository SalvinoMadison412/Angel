// Angel CrashDetector — ESP32 firmware
//
// Reads an MPU6050 accelerometer/gyroscope over I2C, watches for an impact
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
// MPU6050 — raw register access (no external sensor library dependency).
// Default I2C address, default full-scale ranges (±2g / ±250 dps).
// ───────────────────────────────────────────────────────────────────────
static const uint8_t MPU_ADDR = 0x68;
static const uint8_t REG_PWR_MGMT_1 = 0x6B;
static const uint8_t REG_ACCEL_XOUT_H = 0x3B;

struct ImuSample {
  float ax, ay, az; // raw LSB counts, not converted to g — see severity note below
  float gx, gy, gz; // raw LSB counts, not converted to deg/s
};

void mpuInit() {
  Wire.begin();
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_PWR_MGMT_1);
  Wire.write(0x00); // wake the sensor up out of sleep mode
  Wire.endTransmission(true);
}

bool mpuRead(ImuSample &out) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_ACCEL_XOUT_H);
  if (Wire.endTransmission(false) != 0) return false;

  const uint8_t bytesToRead = 14; // accel(6) + temp(2) + gyro(6)
  if (Wire.requestFrom(MPU_ADDR, bytesToRead) != bytesToRead) return false;

  int16_t rawAx = (Wire.read() << 8) | Wire.read();
  int16_t rawAy = (Wire.read() << 8) | Wire.read();
  int16_t rawAz = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read(); // discard temperature
  int16_t rawGx = (Wire.read() << 8) | Wire.read();
  int16_t rawGy = (Wire.read() << 8) | Wire.read();
  int16_t rawGz = (Wire.read() << 8) | Wire.read();

  out.ax = rawAx; out.ay = rawAy; out.az = rawAz;
  out.gx = rawGx; out.gy = rawGy; out.gz = rawGz;
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
  mpuInit();

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
  if (!mpuRead(sample)) return;

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
