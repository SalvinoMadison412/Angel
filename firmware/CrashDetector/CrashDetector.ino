// Angel CrashDetector — Arduino Nano ESP32 firmware
//
// Reads a BMI160 accelerometer/gyroscope over I2C via the DFRobot_BMI160
// library, watches for a crash signal, and pushes a single BLE notification
// per event — either a "crash" (impact- or tilt-triggered), a "fault" (the
// IMU stopped responding), or a "fault_cleared". This is NOT a continuous
// telemetry stream: BLE central apps should expect long silent stretches
// punctuated by rare notifications.
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
// Every notification carries a `type` field ("crash" / "fault" /
// "fault_cleared") that the app branches on before touching anything else —
// see firmware/README.md for the full payload shapes.
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

float refX = 0, refY = 0, refZ = ACCEL_LSB_PER_G;
bool calibrated = false;

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
  prefs.begin("crash", true);
  calibrated = prefs.getBool("cal", false);
  refX = prefs.getFloat("refX", 0);
  refY = prefs.getFloat("refY", 0);
  refZ = prefs.getFloat("refZ", ACCEL_LSB_PER_G);
  prefs.end();
}

void saveCalibration(float x, float y, float z) {
  prefs.begin("crash", false);
  prefs.putBool("cal", true);
  prefs.putFloat("refX", x);
  prefs.putFloat("refY", y);
  prefs.putFloat("refZ", z);
  prefs.end();
  refX = x; refY = y; refZ = z;
  calibrated = true;
  Serial.println("Calibration saved.");
}

void runCalibration() {
  Serial.println("Calibrating... keep bike still and upright.");
  const int N = 50;
  double sx = 0, sy = 0, sz = 0;
  int count = 0;
  for (int i = 0; i < N; i++) {
    int16_t accelGyro[6] = {0};
    if (bmi160.getAccelGyroData(accelGyro) == 0) {
      sx += accelGyro[3]; sy += accelGyro[4]; sz += accelGyro[5];
      count++;
    }
    delay(20);
  }
  if (count > 0) saveCalibration(sx / count, sy / count, sz / count);
  else Serial.println("Calibration failed: no sensor data.");
}

void onCalibrateWrite(BLEDevice central, BLECharacteristic characteristic) {
  runCalibration();
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

  float impactMagRaw = sqrt(ax*ax + ay*ay + az*az);
  float gyroMagRaw   = sqrt(gx*gx + gy*gy + gz*gz);
  float impactG = impactMagRaw / ACCEL_LSB_PER_G;
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

  delay(10);
}
