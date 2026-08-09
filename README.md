# Angel

Two-wheeler crash detection. A `CrashDetector` ESP32 sensor (see
[`firmware/`](firmware/)) watches accelerometer/gyroscope data on-device and
pushes a single Bluetooth Low Energy notification when it detects an
impact. This app pairs with it, runs the cancel-countdown emergency flow,
and alerts guardians with the rider's location.

This is an **Android-only** project — there is no iOS target, no `ios/`
directory, and no iOS config in `app.json`.

## This app cannot run in Expo Go

BLE requires a native module (`react-native-ble-plx`), which Expo Go does
not include. **Trying this in Expo Go will fail or silently no-op the
Bluetooth features — that's expected, not a bug.** You need a custom dev
client:

```bash
npx expo prebuild --platform android
npm run android
```

`npx expo prebuild --platform android` regenerates the `android/` native
project from `app.json` (including the BLE config plugin and permissions
below) — rerun it whenever those change. After the first prebuild + run,
`expo start` and the dev client it launches work like normal for
day-to-day iteration; you only need to rebuild the native app when a native
dependency or its config changes.

If you're using EAS: build a `developer-client` profile instead of relying
on the Expo Go app.

## Permissions

- **Android 12+ (API 31+)**: needs `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`
  at runtime, in addition to the location permissions already required
  pre-12. The app requests these when you start a scan from
  [`DeviceSetupScreen`](src/screens/device/DeviceSetupScreen.tsx).
- **Android BLE scanning also requires system Location Services to be
  turned on**, not just the permission grant — the OS silently returns zero
  scan results otherwise. If a scan comes back empty, the setup screen
  checks for this and surfaces it explicitly rather than just looking like
  "no device found."

## Where things live

- `firmware/` — the ESP32 Arduino sketch and its BLE payload contract.
- `src/services/bluetooth/` — scan/connect/parse/reconnect logic
  (`crashDetectorBle.ts`), plus a mock implementation
  (`mockCrashDetectorBle.ts`) for developing the emergency flow without a
  physical device.
- `src/hooks/useCrashDetector.ts` — React-facing wrapper around the above.
- `src/services/emergency/emergencyPipeline.ts` — what happens after a
  crash event fires: countdown, location capture, the Supabase incident
  write, guardian notification, and local event logging for future
  severity-score calibration.
- `src/screens/device/DeviceSetupScreen.tsx` — scan, pair, forget device.
- `src/screens/crash/CrashAlertScreen.tsx` — the full-screen alert.

## Simulating a crash without hardware

The Home screen has a "Simulate device signal" debug panel that drives the
mock BLE stream through the exact same app-root listener → alert screen →
emergency pipeline path a real sensor would use — nothing about the
downstream flow is different from a real crash.

## Supabase

Run the migrations in `supabase/migrations/` in order against your project
(SQL Editor → paste each file → run). `0002_crash_metrics.sql` adds the raw
sensor metrics columns the emergency pipeline writes alongside severity.

## Privacy

What Angel collects, why, and how it's retained is documented in
[`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) (source of truth), mirrored at
[`privacy-policy.html`](privacy-policy.html) (the public-facing page, e.g.
for the Play Console listing) and [`docs/PRIVACY_POLICY.docx`](docs/PRIVACY_POLICY.docx)
(a Word copy for sharing outside the repo). All three should read the same —
if you change one, update the other two.
