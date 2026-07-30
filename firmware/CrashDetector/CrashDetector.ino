// Angel CrashDetector — Arduino Nano ESP32 firmware
//
// Reads a BMI160 accelerometer/gyroscope over I2C via the DFRobot_BMI160
// library and pushes BLE notifications: a "telemetry" reading at a throttled
// 10 Hz (see TELEMETRY_INTERVAL_MS — the live impact/gyro/tilt stream the
// app's Home screen plots; crash detection itself still runs at full loop
// rate, only the BLE notify is throttled), plus one-off "crash" (impact- or
// tilt-triggered), "fault" (the IMU stopped responding), and "fault_cleared"
// notifications layered on top of that same stream.
//
// BLE contract
// ------------
// Earlier revisions of this sketch reused the standard Bluetooth SIG Heart
// Rate Service (0x180D) / Heart Rate Measurement characteristic (0x2A37) to
// carry a non-conforming JSON payload. That's a real bug, not a style nit:
// some OS BLE stacks special-case recognized profiles (parsing/caching the
// value as an actual heart-rate reading), which produces intermittent
// notify failures that look exactly like app-side connection bugs. Fixed
// by using a custom 128-bit UUID pair instead. Generated with `uuidgen`; if
// you regenerate these, update the app's src/services/bluetooth/types.ts to
// match — the two must stay in sync.
//
// Every notification carries a `type` field ("telemetry" / "crash" /
// "fault" / "fault_cleared") that the app branches on before touching
// anything else — see firmware/README.md for the full payload shapes.
#include <DFRobot_BMI160.h>
#include <Wire.h>
#include <ArduinoBLE.h>
#include <Preferences.h>

DFRobot_BMI160 bmi160;
const int8_t i2c_addr = 0x69;

BLEService crashService("9a0d2e10-66dd-4d3d-930e-a4d0e2806c51");
BLEStringCharacteristic crashChar("9a0d2e11-66dd-4d3d-930e-a4d0e2806c51", BLERead | BLENotify, 200);
BLEByteCharacteristic calibrateChar("9a0d2e12-66dd-4d3d-930e-a4d0e2806c51", BLEWrite);

Preferences prefs;

// BMI160 power-on defaults: +/-2g accel, +/-2000dps gyro.
// Verify against your init sequence if you ever change the configured range.
const float ACCEL_LSB_PER_G  = 16384.0;
const float GYRO_LSB_PER_DPS = 16.4;

const float IMPACT_LOW_G   = 20000.0 / ACCEL_LSB_PER_G;   // ~1.22 g
const float IMPACT_HIGH_G  = 50000.0 / ACCEL_LSB_PER_G;   // ~3.05 g
const float GYRO_LOW_DPS   = 15000.0 / GYRO_LSB_PER_DPS;  // ~915 dps
const float GYRO_HIGH_DPS  = 40000.0 / GYRO_LSB_PER_DPS;  // ~2439 dps
const float TILT_HIGH_DEG      = 70.0;
const float TILT_EXTREME_DEG   = 100.0;
const unsigned long EXTREME_TILT_HOLD_MS = 4000;
const float STILL_THRESH_G     = 5000.0 / ACCEL_LSB_PER_G;
const unsigned long STILL_WINDOW_MS = 3000;
const int FAULT_CONSECUTIVE_LIMIT = 100;
// Calibration sampling — spread across loop() iterations (see calibrating/
// below) instead of a blocking inner loop, so BLE.poll() and telemetry
// never stall while averaging. CALIBRATION_SAMPLE_INTERVAL_MS mirrors the
// original blocking version's `delay(20)` between samples; the timeout is
// generous headroom over the ~1s nominal duration (50 samples x 20ms) for
// the case where some loop iterations skip a sample due to a transient I2C
// read failure elsewhere in loop().
const int CALIBRATION_SAMPLE_COUNT = 50;
const unsigned long CALIBRATION_SAMPLE_INTERVAL_MS = 20;
const unsigned long CALIBRATION_TIMEOUT_MS = 3000;
// Sensor is read and crash-evaluated every loop() for detection accuracy,
// but the telemetry BLE notification is throttled to this interval — the
// central's connection interval can't reliably drain a notify sent on every
// ~10ms loop tick, and flooding the same characteristic used for crash
// events risks destabilizing the link (queue overflow / supervision
// timeout) right after the app subscribes to it. 10 Hz is still smooth for
// a live UI and comfortably inside what a typical connection interval can
// carry alongside occasional crash/fault notifications.
const unsigned long TELEMETRY_INTERVAL_MS = 100;

float refX = 0, refY = 0, refZ = ACCEL_LSB_PER_G;
// Per-axis gyro zero-rate offset (raw LSB counts, same units as the gyro
// readings they're subtracted from) and the impact-magnitude stillness
// baseline (g's, same units as impactG) — both captured alongside the tilt
// reference during the same calibration pass. See the calibration-complete
// branch in loop() and saveCalibration() below.
float gyroOffX = 0, gyroOffY = 0, gyroOffZ = 0;
float impactBaseline = 0;
bool calibrated = false;

bool calibrating = false;
unsigned long calibrationStartedMs = 0;
unsigned long lastCalibrationSampleMs = 0;
int calibrationSamplesTaken = 0;
double calibrationSumX = 0, calibrationSumY = 0, calibrationSumZ = 0;
double calibrationSumGX = 0, calibrationSumGY = 0, calibrationSumGZ = 0;
// Online mean/variance accumulators for the impact-magnitude baseline —
// avoids storing all 50 samples just to compute a standard deviation
// afterward (var = sumSq/n - mean^2).
double calibrationSumImpactG = 0, calibrationSumImpactG2 = 0;

unsigned long lastTelemetryMs = 0;
float lastMagG = 0;
unsigned long stillSince = 0;
bool wasImpact = false;
unsigned long impactTime = 0;
unsigned long extremeTiltSince = 0;
bool tiltIncidentReported = false;
int consecutiveFailures = 0;
bool faultReported = false;
bool sensorOk = true;

void loadCalibration() {
  prefs.begin("angel", true);
  calibrated = prefs.getBool("calibrated", false);
  refX = prefs.getFloat("ref_ax", 0);
  refY = prefs.getFloat("ref_ay", 0);
  refZ = prefs.getFloat("ref_az", ACCEL_LSB_PER_G);
  gyroOffX = prefs.getFloat("gyro_ox", 0);
  gyroOffY = prefs.getFloat("gyro_oy", 0);
  gyroOffZ = prefs.getFloat("gyro_oz", 0);
  impactBaseline = prefs.getFloat("impact_base", 0);
  prefs.end();
}

// Persists all three calibration baselines captured by one calibration pass
// — tilt reference, gyro zero-rate offset, and impact stillness baseline.
// A bike's mount only gets one calibration event, so these are always
// computed and stored together, never independently.
void saveCalibration(float ax, float ay, float az, float gox, float goy, float goz, float impactBase) {
  prefs.begin("angel", false);
  prefs.putBool("calibrated", true);
  prefs.putFloat("ref_ax", ax);
  prefs.putFloat("ref_ay", ay);
  prefs.putFloat("ref_az", az);
  prefs.putFloat("gyro_ox", gox);
  prefs.putFloat("gyro_oy", goy);
  prefs.putFloat("gyro_oz", goz);
  prefs.putFloat("impact_base", impactBase);
  prefs.end();
  refX = ax; refY = ay; refZ = az;
  gyroOffX = gox; gyroOffY = goy; gyroOffZ = goz;
  impactBaseline = impactBase;
  calibrated = true;
  Serial.println("Calibration saved.");
}

// Sent once averaging actually finishes (or times out) — the app's
// CalibrateSensorScreen blocks its "success" state on this arriving rather
// than on the write's own ack (see firmware/README.md). This notification
// was previously never sent at all: calibration would silently save (or
// silently fail) on-device with the app waiting the full 5s and timing out
// every single time, regardless of BLE stability.
void sendCalibrationComplete(bool success) {
  String json = "{\"type\":\"calibration_complete\",\"calibrated\":" + String(success ? "true" : "false") + "}";
  Serial.println(json);
  crashChar.writeValue(json);
}

// Starts (or restarts, if one was already in progress) a non-blocking
// calibration average. Actual sampling happens in loop() below, reusing
// the same accelerometer read loop() already takes every iteration for
// telemetry/crash detection — no separate blocking sample loop, so
// BLE.poll() (and thus the connection itself) keeps running normally for
// the ~1s this takes, instead of stalling.
void startCalibration() {
  Serial.println("Calibrating... keep bike still and upright.");
  calibrating = true;
  calibrationStartedMs = millis();
  lastCalibrationSampleMs = calibrationStartedMs;
  calibrationSamplesTaken = 0;
  calibrationSumX = 0;
  calibrationSumY = 0;
  calibrationSumZ = 0;
  calibrationSumGX = 0;
  calibrationSumGY = 0;
  calibrationSumGZ = 0;
  calibrationSumImpactG = 0;
  calibrationSumImpactG2 = 0;
}

void onCalibrateWrite(BLEDevice central, BLECharacteristic characteristic) {
  startCalibration();
}

int severityFromScore(int score) {
  if (score <= 1) return 1;
  if (score == 2) return 2;
  if (score == 3) return 3;
  if (score == 4) return 4;
  return 5;
}

void sendReport(const char* type, const char* trigger, int severity,
                float impactG, float gyroDps, float tilt, bool isStill) {
  String json = "{";
  json += "\"type\":\"" + String(type) + "\",";
  if (trigger != nullptr) json += "\"trigger\":\"" + String(trigger) + "\",";
  json += "\"severity\":" + String(severity) + ",";
  json += "\"impact_g\":" + String(impactG, 3) + ",";
  json += "\"gyro_dps\":" + String(gyroDps, 1) + ",";
  json += "\"tilt\":" + String(tilt, 1) + ",";
  json += "\"still\":" + String(isStill ? "true" : "false") + ",";
  json += "\"calibrated\":" + String(calibrated ? "true" : "false");
  json += "}";
  Serial.println(json);
  crashChar.writeValue(json);
}

// Sent at TELEMETRY_INTERVAL_MS — the live stream the app's Home screen
// cards render continuously. No `trigger`/`severity`: those only mean
// something for a detected "crash" event, not an arbitrary instantaneous
// reading.
void sendTelemetry(float impactG, float gyroDps, float tilt, bool isStill) {
  String json = "{";
  json += "\"type\":\"telemetry\",";
  json += "\"impact_g\":" + String(impactG, 3) + ",";
  json += "\"gyro_dps\":" + String(gyroDps, 1) + ",";
  json += "\"tilt\":" + String(tilt, 1) + ",";
  json += "\"still\":" + String(isStill ? "true" : "false") + ",";
  json += "\"calibrated\":" + String(calibrated ? "true" : "false");
  json += "}";
  crashChar.writeValue(json);
}

void setup() {
  Serial.begin(115200);

  if (bmi160.softReset() != BMI160_OK) {
    Serial.println("sensor reset failed");
    sensorOk = false;
  }
  if (sensorOk && bmi160.I2cInit(i2c_addr) != BMI160_OK) {
    Serial.println("sensor init failed");
    sensorOk = false;
  }

  loadCalibration();

  if (!BLE.begin()) {
    Serial.println("BLE failed");
    while(1);
  }
  BLE.setLocalName("CrashDetector");
  BLE.setAdvertisedService(crashService);
  crashService.addCharacteristic(crashChar);
  crashService.addCharacteristic(calibrateChar);
  BLE.addService(crashService);
  calibrateChar.setEventHandler(BLEWritten, onCalibrateWrite);
  BLE.advertise();

  Serial.println(sensorOk ? "Ready. Sensor OK." : "Ready. WARNING: sensor not responding.");
  Serial.println(calibrated ? "Calibration loaded from memory." : "NOT CALIBRATED. Send calibrate command from app.");
}

void loop() {
  BLE.poll();

  if (!sensorOk) { delay(500); return; }

  int16_t accelGyro[6] = {0};
  int rslt = bmi160.getAccelGyroData(accelGyro);

  if (rslt != 0) {
    consecutiveFailures++;
    if (consecutiveFailures >= FAULT_CONSECUTIVE_LIMIT && !faultReported) {
      Serial.println("=== SENSOR FAULT ===");
      String json = "{\"type\":\"fault\",\"reason\":\"sensor_communication_lost\"}";
      Serial.println(json);
      crashChar.writeValue(json);
      faultReported = true;
    }
    delay(10);
    return;
  }
  if (consecutiveFailures >= FAULT_CONSECUTIVE_LIMIT && faultReported) {
    String json = "{\"type\":\"fault_cleared\"}";
    Serial.println(json);
    crashChar.writeValue(json);
    faultReported = false;
  }
  consecutiveFailures = 0;

  float gx = accelGyro[0], gy = accelGyro[1], gz = accelGyro[2];
  float ax = accelGyro[3], ay = accelGyro[4], az = accelGyro[5];

  // Non-blocking calibration averaging — only ever reaches here on a loop
  // iteration with a successful sensor read (a failed read returns early
  // above), so every accumulated sample is already known-good, same as the
  // old blocking version's own success check.
  if (calibrating) {
    unsigned long now = millis();
    if (now - lastCalibrationSampleMs >= CALIBRATION_SAMPLE_INTERVAL_MS) {
      lastCalibrationSampleMs = now;
      calibrationSumX += ax;
      calibrationSumY += ay;
      calibrationSumZ += az;
      calibrationSumGX += gx;
      calibrationSumGY += gy;
      calibrationSumGZ += gz;
      // Raw (uncorrected) impact magnitude for this sample — the stillness
      // baseline has to be computed from what the sensor actually reports
      // at rest, not from an already-corrected value.
      float sampleImpactG = sqrt(ax * ax + ay * ay + az * az) / ACCEL_LSB_PER_G;
      calibrationSumImpactG += sampleImpactG;
      calibrationSumImpactG2 += sampleImpactG * sampleImpactG;
      calibrationSamplesTaken++;
      if (calibrationSamplesTaken >= CALIBRATION_SAMPLE_COUNT) {
        calibrating = false;
        double n = calibrationSamplesTaken;
        double meanImpactG = calibrationSumImpactG / n;
        double varImpactG = (calibrationSumImpactG2 / n) - (meanImpactG * meanImpactG);
        float impactBase = sqrt(varImpactG > 0 ? varImpactG : 0);
        saveCalibration(
          calibrationSumX / n,
          calibrationSumY / n,
          calibrationSumZ / n,
          calibrationSumGX / n,
          calibrationSumGY / n,
          calibrationSumGZ / n,
          impactBase
        );
        sendCalibrationComplete(true);
      }
    } else if (now - calibrationStartedMs > CALIBRATION_TIMEOUT_MS) {
      calibrating = false;
      Serial.println("Calibration timed out — not enough good samples.");
      sendCalibrationComplete(false);
    }
  }

  // Gyro zero-rate offset correction — subtract the per-axis stillness
  // offset captured during calibration before computing magnitude, so
  // sensor-specific drift doesn't show up as phantom rotation.
  float gxCorrected = gx - gyroOffX;
  float gyCorrected = gy - gyroOffY;
  float gzCorrected = gz - gyroOffZ;

  float impactMagRaw = sqrt(ax*ax + ay*ay + az*az);
  float gyroMagRaw   = sqrt(gxCorrected*gxCorrected + gyCorrected*gyCorrected + gzCorrected*gzCorrected);
  float impactGRaw = impactMagRaw / ACCEL_LSB_PER_G;
  // Impact stillness baseline correction — mounting-surface vibration noise
  // captured during calibration sets the effective zero; severity scoring
  // and telemetry both use this corrected value from here on.
  float impactG = max(0.0f, impactGRaw - impactBaseline);
  float gyroDps = gyroMagRaw / GYRO_LSB_PER_DPS;

  float refMag = sqrt(refX*refX + refY*refY + refZ*refZ);
  float dot = (ax*refX + ay*refY + az*refZ);
  float cosAngle = (refMag > 0 && impactMagRaw > 0) ? dot / (refMag * impactMagRaw) : 1.0;
  cosAngle = constrain(cosAngle, -1.0, 1.0);
  float tilt = acos(cosAngle) * 180.0 / 3.14159;

  Serial.print("Impact: "); Serial.print(impactG, 2); Serial.print("g");
  Serial.print("  Gyro: "); Serial.print(gyroDps, 1); Serial.print("dps");
  Serial.print("  Tilt: "); Serial.println(tilt, 1);

  float delta = abs(impactG - lastMagG);
  lastMagG = impactG;
  bool isStill = false;
  if (delta < STILL_THRESH_G) {
    if (stillSince == 0) stillSince = millis();
    if (millis() - stillSince > STILL_WINDOW_MS) isStill = true;
  } else {
    stillSince = 0;
  }

  if (millis() - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = millis();
    sendTelemetry(impactG, gyroDps, tilt, isStill);
  }

  // Both crash-alert paths below require a completed calibration — without
  // it there's no gyro offset, impact baseline, or tilt reference for this
  // specific mount, so a "detection" would just be noise. Telemetry above
  // still streams either way (with calibrated:false) so the app can prompt
  // for calibration; only alert-firing is gated.
  if (calibrated) {
    // Path 1: impact-triggered (existing behavior)
    if (impactG > IMPACT_LOW_G && !wasImpact) {
      wasImpact = true;
      impactTime = millis();
      Serial.println(">>> IMPACT DETECTED! Calculating severity...");
    }
    if (wasImpact && millis() - impactTime > 2000) {
      int score = 0;
      if (impactG > IMPACT_HIGH_G) score += 2; else if (impactG > IMPACT_LOW_G) score += 1;
      if (gyroDps > GYRO_HIGH_DPS) score += 2; else if (gyroDps > GYRO_LOW_DPS) score += 1;
      if (tilt > TILT_HIGH_DEG) score += 1;
      if (isStill) score += 1;
      sendReport("crash", "impact", severityFromScore(score), impactG, gyroDps, tilt, isStill);
      wasImpact = false;
      stillSince = 0;
      extremeTiltSince = 0;
      tiltIncidentReported = false;
    }

    // Path 2: sustained extreme tilt with no qualifying impact.
    // Catches slow tip-overs and a sensor dislodged/thrown that lands
    // at an implausible angle.
    if (!wasImpact) {
      if (tilt > TILT_EXTREME_DEG) {
        if (extremeTiltSince == 0) extremeTiltSince = millis();
        if (!tiltIncidentReported && millis() - extremeTiltSince > EXTREME_TILT_HOLD_MS) {
          int score = 1;
          if (gyroDps > GYRO_HIGH_DPS) score += 2; else if (gyroDps > GYRO_LOW_DPS) score += 1;
          if (isStill) score += 1;
          sendReport("crash", "tilt", severityFromScore(score), impactG, gyroDps, tilt, isStill);
          tiltIncidentReported = true;
        }
      } else {
        extremeTiltSince = 0;
        tiltIncidentReported = false;
      }
    }
  }

  delay(10);
}
