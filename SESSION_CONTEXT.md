# Angel — Session Context Summary

Drop this into a new conversation to pick up where this session left off. Written to be read cold — no assumed memory of the conversation that produced it.

**Read this first:** No physical Android device or Arduino/serial connection was available in the environment this session ran in. Every fix below was implemented via direct code reading/reasoning and verified only with `npx tsc --noEmit` (clean throughout) plus one emulator boot/app-launch smoke test (blocked at the login screen — no test account credentials available). **Nothing in this session has been confirmed working on real hardware.** Treat every "fixed" claim below as "implemented and reasoned through, not yet observed working."

---

## 1. Current state of the app

**Working (pre-existing, untouched or only extended this session):**
- Auth (phone OTP / Google), onboarding wizard, Guardians CRUD, Device pairing/setup, Home screen, Profile/Plan/Subscription screens.
- The severity 2–5 crash flow's *structure* (CrashAlertScreen → confirmIncident → nearest-responder dispatch → LiveIncidentScreen) — this was already built before this session and was not modified except for one line (see §4).

**Changed/added this session, status unverified on hardware:**
- Live telemetry streaming to Home screen cards.
- BLE connection stability fix (telemetry was flooding the link).
- New severity-1 guardian-alert flow (EmergencyCountdownScreen + EmergencyAlertSentScreen), now visually unified with CrashAlertScreen.
- Calibration: found and fixed two independent bugs (see §6) — high confidence these were real bugs, unverified that the fix works on-device.
- Background local notifications for crash events (lighter version — no foreground service, no full-screen intent).
- Haptics on the severity-1 screen only.
- A Twilio-backed Supabase Edge Function for real guardian SMS — **written but not deployed** (no Twilio secrets exist).

**Known broken / incomplete:**
- `notify-guardians` edge function is not deployed. Until it is (with Twilio secrets set), `sendGuardianAlert()` will throw and the severity-1 screen will show its error/retry state.
- No foreground service — Android can and likely will kill the BLE connection/app process after some background time; the background-notification path only works in the window before that happens.
- No true full-screen-intent (lock-screen takeover); only a high-priority heads-up notification.
- Haptics only fire on the severity-1 screen, not on CrashAlertScreen (severity 2–5) — not asked for there, but worth knowing it's asymmetric.
- The `emergency_profiles` Supabase table is referenced in code (`confirmIncident`) but does **not exist in the live Supabase project** (confirmed via `list_tables` earlier this session — migration `0004_onboarding.sql` was apparently never applied remotely). That code path is wrapped in try/catch so it fails soft, but medical info will never actually attach to a severity 2–5 incident until that migration is run.

---

## 2. Every file changed this session

### Firmware
- **`firmware/CrashDetector/CrashDetector.ino`**
  - Added a `"telemetry"` message type sent at a throttled rate (was: none — firmware only ever sent rare `crash`/`fault` events).
  - Throttled telemetry send from every `loop()` iteration (~100Hz) down to `TELEMETRY_INTERVAL_MS = 100` (10Hz) — the original 100Hz send is the prime suspect for the BLE connection instability reported mid-session (see §3, §9).
  - Rewrote `runCalibration()` (renamed flow to `startCalibration()` + inline sampling in `loop()`) from a blocking ~1s loop (50× `delay(20)`) to non-blocking sampling spread across `loop()` iterations, reusing the accel read `loop()` already takes.
  - **Added the previously-missing `sendCalibrationComplete()` call** — the firmware never sent a `calibration_complete` notification at all before this session, despite the app always waiting on it and the README always documenting it.
  - New constants: `CALIBRATION_SAMPLE_COUNT = 50`, `CALIBRATION_SAMPLE_INTERVAL_MS = 20`, `CALIBRATION_TIMEOUT_MS = 3000` (firmware-side abandon-and-report-failure timeout).
- **`firmware/README.md`** — updated `telemetry` and `calibrate`/`calibration_complete` payload docs to match the above.

### BLE service layer
- **`src/services/bluetooth/types.ts`** — added `telemetryMessageSchema` (zod), `TelemetryMessage`, `TelemetryReading` interface, `telemetryReadingFromMessage()`; added to the `crashDetectorMessageSchema` discriminated union.
- **`src/services/bluetooth/crashDetectorBle.ts`** (the real `react-native-ble-plx`-backed service):
  - Added `subscribeTelemetry()` + telemetry listener set + `"telemetry"` case in `handleNotification()`.
  - Added permanent packet-level logging (`blePacketLog`) tracing every notification: raw base64 → decoded string → parsed JSON → schema result. Distinct from the pre-existing `bleOpLog` (marked TEMP, for GATT op sequencing), which now skips telemetry packets to avoid drowning out rarer events.
  - Added `NOTIFY_SETTLE_MS = 500` + a `notifySettled` flag: after subscribing to notifications, waits 500ms before the connection is considered ready for writes; `performCalibrate()` throws if called before settled (defense-in-depth — the existing GATT operation queue should make this unreachable in practice).
  - Added `bleOpLog` calls around `startScan()`'s permission/state checks and device-found event (state-transition tracing was previously incomplete there).
- **`src/services/bluetooth/mockCrashDetectorBle.ts`**, **`unavailableCrashDetectorBle.ts`** — added no-op/stub `subscribeTelemetry()` to satisfy the `CrashDetectorBle` interface.
- **`src/hooks/useCrashDetector.ts`** — added `telemetry` state + subscription, returned from the hook.

### Home screen (live telemetry UI)
- **`src/components/StatTile.tsx`** — card height and value font size now scale off `useWindowDimensions()` (clamped), plus `adjustsFontSizeToFit`/`numberOfLines={1}` as a hard backstop, so the three stat cards can't overflow on small Android screens and stay uniform height.
- **`src/screens/home/HomeScreen.tsx`** — the three metric cards (IMPACT/ROTATION/LEAN) and the timestamp now render from live `telemetry` (updates on every packet) instead of only updating on a crash event; show `--` when disconnected. Descriptor captions shortened to "impact force"/"spin speed"/"lean angle". Debug-panel copy updated to describe the new severity-1 routing.

### Crash alert / emergency flow
- **`src/lib/crashSignals.ts`** — added `remainingCountdownSeconds(receivedAt, totalSeconds)`: computes countdown start based on elapsed time since detection, not a fresh full countdown on mount.
- **`src/screens/crash/CrashAlertScreen.tsx`** — one-line change: `secondsLeft` now initializes via `remainingCountdownSeconds(receivedAt, totalSeconds)` instead of always `totalSeconds`.
- **`src/screens/crash/EmergencyCountdownScreen.tsx`** — new screen (built then substantially rewritten mid-session):
  - Fires for severity-1 events only.
  - 30s countdown (`EMERGENCY_COUNTDOWN_SECONDS`, in `emergencyPipeline.ts`), also now elapsed-time-aware via `remainingCountdownSeconds`.
  - Visually rewritten to exactly match `CrashAlertScreen`'s layout (orange top bar, severity bar, trigger pill, IMPACT/ROTATION/LEAN/STILL row, uncalibrated banner, circular `RadialCountdown` arc, guardian avatar chips, two buttons) instead of its original bespoke deep-red design.
  - Severity label text (`MINOR/MODERATE/SERIOUS/SEVERE/CRITICAL`) and trigger pill text (`HARD IMPACT`/`TILT DETECTED`) are **local to this file** — deliberately not the shared `SEVERITY_LABELS`/`triggerHeadline` in `lib/crashSignals.ts`, which still say `ELEVATED`/`POSSIBLE TIP-OVER` and back `CrashAlertScreen` unchanged.
  - Two buttons: "I'M OK — CANCEL ALERT" (→ `cancelCrashEvent`, local-log only) and "SEND HELP NOW" (→ same `sendAlert()` the countdown itself calls on expiry, guarded via the existing `resolvedRef` so an early tap can't race the countdown's own auto-fire).
  - `phase` state machine (`"counting" | "sending" | "error"`) — on send failure, shows inline error text and re-enables "SEND HELP NOW" as a retry (unchanged mechanism, not a new third button).
  - Haptics: 3 heavy pulses, 200ms apart, in a mount-only `useEffect` via `expo-haptics`.
  - `BackHandler` blocks Android back button; `gestureEnabled: false` on the stack screen blocks swipe-back.
- **`src/screens/crash/EmergencyAlertSentScreen.tsx`** — new confirmation screen: "Alert sent to N contacts" + names (from the already-loaded `useGuardians()` list, not from the edge function's response) + "RETURN HOME" button (`navigation.popToTop()`).
- **`src/services/emergency/emergencyPipeline.ts`**:
  - Added `EMERGENCY_COUNTDOWN_SECONDS = 30` (alongside existing `DEFAULT_COUNTDOWN_SECONDS = 10` for severity 2–5).
  - Extracted `captureCurrentLocation()` helper (shared by `confirmIncident` and the new `sendGuardianAlert`).
  - Added `sendGuardianAlert({ event, userId })`: logs locally, captures location, calls the `notify-guardians` edge function via `supabase.functions.invoke`, returns `{ sent }`.
- **`src/navigation/types.ts`** — added `EmergencyCountdown: CrashEvent` and `EmergencyAlertSent: { guardianNames: string[] }` to `RootStackParamList`.
- **`src/navigation/RootNavigator.tsx`**:
  - Registered the two new screens (`EmergencyCountdown` with `gestureEnabled: false`, `EmergencyAlertSent`).
  - Extracted `navigateToCrashAlert(navigation, event)` — the severity-routing decision (`shouldTriggerAlert`), now shared between the live BLE listener and the notification-tap handler so they can't disagree.
  - `CrashDetectorListener` now also fires `presentCrashNotification(event)` when `AppState.currentState !== "active"` at the moment an event arrives (in addition to, not instead of, the existing `navigate()` call).
  - Added a notification-response effect: `Notifications.getLastNotificationResponseAsync()` (cold start) + `Notifications.addNotificationResponseReceivedListener()` (warm/backgrounded tap), deduped by the notification's own request identifier (both can fire for the same tap, in either order), both routing through `navigateToCrashAlert`.

### Notifications (new)
- **`src/services/notifications/localCrashNotifications.ts`** — new file:
  - `configureCrashNotificationChannel()` — Android channel `"crash-alerts"`, `AndroidImportance.MAX`, vibration pattern `[0, 500, 250, 500, 250, 500]`.
  - `requestCrashNotificationPermission()` — configures the channel then calls `Notifications.requestPermissionsAsync()`.
  - Module-level `Notifications.setNotificationHandler(...)` — always shows banner/list/sound (foreground suppression is handled by the caller checking `AppState`, not by this handler).
  - `presentCrashNotification(event)` — schedules an immediate notification (`trigger: { channelId: "crash-alerts" }` on Android — deliberately not `trigger: null`, which would skip the custom channel) with the full `CrashEvent` embedded as JSON in `content.data`.
  - `crashEventFromNotificationResponse(response)` — validates and extracts the `CrashEvent` back out of a tapped notification.
- **`src/services/notifications/index.ts`** — re-exports the above.
- **`src/screens/onboarding/OnboardingScreen.tsx`** — at the end of onboarding (`advanceTo` when `next > TOTAL_STEPS`), now also calls `requestCrashNotificationPermission()` (best-effort, alongside the pre-existing `Location.requestForegroundPermissionsAsync()` added earlier this session for the guardian-alert Maps link).

### Supabase (new, not deployed)
- **`supabase/functions/notify-guardians/index.ts`** — new Deno Edge Function. Accepts `{ rider_id, severity, timestamp, lat, lng }`, authenticates the caller via their own JWT (rejects if `rider_id` doesn't match the authenticated user — prevents spoofing), looks up `profiles.name` + `guardians` (phone, name) via service-role client, sends one SMS per guardian via Twilio's REST API (`fetch` + Basic Auth), returns `{ sent, total, failures }`. **Requires `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` secrets — none are set, and the function has never been deployed.**

### Config / misc
- **`app.json`** — added `"POST_NOTIFICATIONS"` to `android.permissions`; added `"expo-notifications"` to `plugins`.
- **`tsconfig.json`** — added `"exclude": ["node_modules", "supabase/functions"]` so the Deno edge function (which uses `Deno.serve` and a remote `esm.sh` import) doesn't break the app's `tsc --noEmit`.
- **`package.json` / `package-lock.json`** — added `expo-haptics@~57.0.1`, `expo-notifications@~57.0.7`.

---

## 3. BLE architecture

**Service/characteristic UUIDs** (must match between firmware and `src/services/bluetooth/types.ts` — unchanged this session):
```
Service:               9a0d2e10-66dd-4d3d-930e-a4d0e2806c51
Telemetry/crash char:   9a0d2e11-66dd-4d3d-930e-a4d0e2806c51  (read + notify)
Calibrate char:          9a0d2e12-66dd-4d3d-930e-a4d0e2806c51  (write)
```
Device advertises local name `"CrashDetector"`.

**Message types over the single notify characteristic** (JSON, base64-encoded), discriminated by `type`:
- `telemetry` — sent every `TELEMETRY_INTERVAL_MS` (100ms / 10Hz, firmware-side). Fields: `impact_g`, `gyro_dps`, `tilt`, `still`, `calibrated`. No `trigger`/`severity`.
- `crash` — sent once per detected event (impact- or tilt-triggered), unthrottled. Fields: `trigger`, `severity` (1–5), `impact_g`, `gyro_dps`, `tilt`, `still`, `calibrated`.
- `fault` / `fault_cleared` — device-health signal (IMU stopped responding for `FAULT_CONSECUTIVE_LIMIT = 100` consecutive reads), never routed through the crash pipeline.
- `calibration_complete` — `{ calibrated: boolean }`. **This session's biggest firmware finding: this was never actually sent before this session** (see §6).

**App-side parsing pipeline** (`crashDetectorBle.ts` → `handleNotification()`):
raw base64 → `base64.decode()` → `JSON.parse()` → `crashDetectorMessageSchema.safeParse()` (zod discriminated union) → switch on `type` → dispatch to the relevant listener set (`telemetryListeners`, `eventListeners`, `faultListeners`, `calibrationListeners`). Every stage is now logged via `blePacketLog` (permanent) — if a packet silently vanishes, this is where to look.

**Connection lifecycle** (`CrashDetectorBleService`):
- All central-initiated GATT operations (`connect`, `disconnect`, `calibrate`) are serialized through a promise-chain queue (`enqueue()` / `operationTail`) — never more than one in flight.
- `connect()` → `connectToDevice()` → `requestMTU(247)` (best-effort, connection survives if this fails) → `discoverAllServicesAndCharacteristics()` → `monitorCharacteristicForService()` (subscribe) → **new this session:** wait `NOTIFY_SETTLE_MS = 500` → mark `notifySettled = true` → persist paired device → state = `connected`.
- Reconnect backoff: `RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000]`.
- `isLinked` (exposed by `useCrashDetector`) debounces real disconnects behind a 2s grace window (`RECONNECT_GRACE_MS`, in the hook) so brief blips don't flicker the UI — this predates this session.
- `react-native-ble-plx`'s config plugin has `isBackgroundEnabled: false` in `app.json` — background BLE central mode is explicitly off; no change made here this session (consistent with the "no foreground service" decision in §9).

**Mock vs real vs unavailable**: `getCrashDetectorBle(mock: boolean)` in `services/bluetooth/index.ts` picks between `CrashDetectorBleService` (real), `MockCrashDetectorBleService` (Home screen's dev "simulate crash" panel, severities 1–5), and `UnavailableCrashDetectorBleService` (stub shown if the native BLE module fails to construct, e.g. running in Expo Go). All three implement the same `CrashDetectorBle` interface.

---

## 4. The crash alert screens

Two separate screens, chosen by severity (`shouldTriggerAlert(event) = severity >= 2`), routed from `RootNavigator.tsx`'s `CrashDetectorListener` via the shared `navigateToCrashAlert()` helper:

**Severity 2–5 → `CrashAlertScreen.tsx`** (pre-existing, only the countdown-start line changed this session):
- 10s countdown (`DEFAULT_COUNTDOWN_SECONDS`), now elapsed-time-aware.
- On expiry or "SEND HELP NOW": `confirmIncident()` — writes an `incidents` row, attempts to load `emergency_profiles` (medical info; **table doesn't exist live**, fails soft), assigns the nearest mock responder, calls `notificationService.notifyGuardians()` (still the **mock** notification service — writes to `incident_events` + `console.log`, no real SMS/call), navigates to `LiveIncidentScreen`.
- "I'M OK — CANCEL ALERT": `cancelCrashEvent()` — local log only, `navigation.goBack()`.
- No haptics on this screen.

**Severity 1 → `EmergencyCountdownScreen.tsx`** (new this session, UI now matches CrashAlertScreen exactly):
- 30s countdown (`EMERGENCY_COUNTDOWN_SECONDS`), elapsed-time-aware.
- On expiry or "SEND HELP NOW": `sendGuardianAlert()` — real Twilio SMS via the (undeployed) edge function, **no** incident row, **no** responder dispatch — navigates to `EmergencyAlertSentScreen` on success.
- "I'M OK — CANCEL ALERT": `cancelCrashEvent()` — same as above.
- 3 heavy haptic pulses on mount.
- Both screens block Android back button and swipe-back.

**Data displayed** (both screens, same fields): severity number/bar/label, trigger badge + description, IMPACT (g) / ROTATION (°/s) / LEAN (°, or `—` if uncalibrated) / STILL tag, an "uncalibrated sensor" banner when `calibrated === false`, detection timestamp, guardian avatar chips (first 3 + "+N" overflow).

---

## 5. Countdown + guardian alert flow, end to end (severity 1)

1. Firmware detects a crash, sends a `crash` notification with `severity: 1`.
2. `crashDetectorBle.ts` parses it → `CrashEvent` → `subscribeCrashEvents` listeners fire (both real and mock BLE instances feed the same `CrashDetectorListener`).
3. `CrashDetectorListener` (RootNavigator.tsx): syncs the device's `calibrated` flag if it changed, calls `navigateToCrashAlert()` → since severity `< 2`, `navigation.navigate("EmergencyCountdown", event)`. If `AppState.currentState !== "active"` at this moment, also calls `presentCrashNotification(event)` (fires a local Android notification, channel `crash-alerts`, MAX importance + vibration pattern, `content.data` carries the full event as JSON).
4. `EmergencyCountdownScreen` mounts (either via direct navigation, or later via a notification tap → `crashEventFromNotificationResponse()` → `navigateToCrashAlert()` again). Haptics fire (3 pulses). Countdown starts at `remainingCountdownSeconds(event.receivedAt, 30)` — already partially/fully elapsed if opened late.
5. Every second, `secondsLeft` decrements via `setTimeout`. If it reaches 0 (immediately, if already elapsed) without the rider tapping "I'M OK", `sendAlert()` fires automatically; it also fires immediately if "SEND HELP NOW" is tapped early (guarded by `resolvedRef` against double-firing with the auto-expiry).
6. `sendAlert()` → `phase = "sending"` → `sendGuardianAlert({ event, userId })`:
   - Logs the event locally (`logCrashEventLocally(event, "confirmed")`, the same jsonl calibration-data log used for all outcomes).
   - `captureCurrentLocation()` — best-effort GPS via `expo-location` (falls back to `{ lat: null, lng: null }` on any failure/denial).
   - `supabase.functions.invoke("notify-guardians", { body: { rider_id: userId, severity, timestamp: ISO string, lat, lng } })`.
7. **Edge function (not deployed)**: would authenticate the caller, look up guardians + rider name, build an SMS (`"Angel emergency alert: {name} may have been in a crash (severity {n}/5) at {time}... Last known location: https://www.google.com/maps?q={lat},{lng}"`), send via Twilio REST API to each guardian's phone, return `{ sent, total, failures }`.
8. On success: `navigation.replace("EmergencyAlertSent", { guardianNames })` (names come from the app's own already-loaded `useGuardians()` list, not the edge function's response). Confirmation screen shows "Alert sent to N contacts" + names + "RETURN HOME".
9. On failure (certain right now, since the function isn't deployed): `phase = "error"`, inline error text shown, "SEND HELP NOW" button re-enabled as a retry (same handler, no new UI).

"I'M OK — CANCEL ALERT" at any point before expiry: `cancelCrashEvent()` (local log only) → `navigation.goBack()` — no guardian contact, no location capture, nothing else.

---

## 6. Calibration — current state

**Two independent bugs found and fixed this session, neither verified on hardware:**

1. **Missing confirmation (found via direct code read, not testing)** — the firmware documented and the app always waited for a `calibration_complete` BLE notification, but no code path in the `.ino` file ever sent one. This alone would make every recalibration attempt time out (the app's `CalibrateSensorScreen` has a 5s wait, `CONFIRMATION_TIMEOUT_MS`) regardless of BLE stability. **Fixed**: `sendCalibrationComplete(bool success)` now called on both successful completion and on a new firmware-side 3s timeout (`CALIBRATION_TIMEOUT_MS`).

2. **Blocking averaging loop** — `runCalibration()` used to run 50× blocking `delay(20)` (~1s total) synchronously inside the BLE write event handler, stalling `BLE.poll()` (and thus the whole connection) for that entire second. **Fixed**: rewritten as non-blocking — `startCalibration()` just arms a flag/timestamp; actual sampling happens inside the main `loop()`, one sample every `CALIBRATION_SAMPLE_INTERVAL_MS = 20`, reusing the accelerometer read `loop()` already takes each iteration. Reaches `CALIBRATION_SAMPLE_COUNT = 50` samples in ~1s of wall-clock time same as before, but without blocking anything.

**App-side hardening** (`crashDetectorBle.ts`): `NOTIFY_SETTLE_MS = 500` delay after subscribing to notifications before any write is permitted, backed by a `notifySettled` flag that `performCalibrate()` checks and throws a clear error against if somehow bypassed. The pre-existing GATT operation queue (`enqueue()`/`operationTail`) already serializes connect/disconnect/calibrate — this predates the session and was confirmed adequate for that specific purpose, not rewritten.

**Not fixed / not investigated further**: whether continuous 10Hz telemetry notifications *during* a calibrate write can still cause Android-stack-level issues independent of the two bugs above — flagged as a real possibility mid-session (peripheral-pushed notifications can't be paused from the central/app side; only the firmware could suppress them, and it currently doesn't pause telemetry during calibration). If calibration is still flaky after reflashing with the two fixes above, this is the next thing to look at — likely a firmware-side change (pause `sendTelemetry()` calls while `calibrating == true`).

**CalibrateSensorScreen.tsx was not modified this session** — it already correctly waited for `calibration_complete` rather than trusting the write ack (pre-existing, confirmed correct by reading it).

---

## 7. Background BLE / foreground service

**Not implemented.** This was explicitly researched and scoped down mid-session:
- `expo-notifications` has no full-screen-intent support at all (confirmed against the actual Expo v57 docs, not assumed).
- `expo-task-manager` + `expo-background-fetch`/`expo-background-task` is periodic, OS-scheduled, best-effort, minimum ~15 minute interval — the Expo docs explicitly say this is not suitable for keeping a Bluetooth connection alive.
- A genuine fix would require a native Android foreground service (Kotlin + an Expo config plugin) — proposed as an option, **explicitly declined** by the user in favor of the lighter approach below.
- `react-native-ble-plx`'s config plugin still has `isBackgroundEnabled: false` in `app.json` — untouched.

**Practical consequence**: the BLE connection (and the whole JS runtime) can and will eventually be suspended/killed by Android once the app is backgrounded for long enough (varies heavily by OEM — MIUI/OneUI/etc. are typically more aggressive than stock Android). Nothing in this app currently prevents that. The background-notification path (§9) only works in the window before that happens.

---

## 8. Full-screen intent notification

**Not implemented** — same research/decision as §7. True full-screen-intent (lock-screen takeover like an incoming call) requires either a custom native Android notification (`NotificationCompat.Builder.setFullScreenIntent`) or a library like `@notifee/react-native`; `expo-notifications` cannot do it. This was proposed as the "real fix" option and explicitly declined in favor of a plain high-priority heads-up notification (§9). `USE_FULL_SCREEN_INTENT` permission was deliberately **not** requested — it would do nothing without the actual native API usage, and requesting an unused sensitive permission is bad practice.

**Never tested on any device**, physical or emulated (the emulator session this feature was built in never got past the login screen — no test credentials available).

---

## 9. What was actually implemented for "background alert" (the lighter version)

- A local (not push) Android notification, high-importance channel (`AndroidImportance.MAX`) with an explicit vibration pattern, fired via `expo-notifications`' `scheduleNotificationAsync` with `trigger: { channelId: "crash-alerts" }` (immediate delivery, correctly attached to the custom channel — plain `trigger: null` would silently fall back to a default channel and lose the importance/vibration).
- Fires only when `AppState.currentState !== "active"` at the moment a crash event is received by the still-running JS/BLE listener — i.e., this only helps in the window where the app process is backgrounded but not yet killed by Android.
- Tapping it (or cold-launching from it) deep-links to the correct screen with the original crash data intact, via `content.data` on the notification and `crashEventFromNotificationResponse()` on the way back out. Routing reuses the exact same `shouldTriggerAlert`-based logic as a live event (`navigateToCrashAlert()`), so the two paths can't disagree on severity 2–5 vs 1.
- `POST_NOTIFICATIONS` permission requested at the end of onboarding (Android 13+; channel is created before the permission request, since Android reads channel importance at request time).
- **Never verified on a device.** In particular: real-world timing of how long Android keeps the process alive after backgrounding (varies by OEM/battery settings) was never tested; whether the notification actually appears/vibrates as configured was never observed.

---

## 10. Haptics

- Package: `expo-haptics` (`~57.0.1`), installed this session, requires a native rebuild to take effect (it's a native module — a JS-only reload won't pick it up).
- Used in exactly one place: `EmergencyCountdownScreen.tsx`, a mount-only `useEffect` firing `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)` three times, 200ms apart (awaited sequentially, not `Promise.all`, to avoid iOS potentially coalescing/dropping rapid-fire impacts — though this app is Android-only per `AGENTS.md`, the sequencing was kept for correctness anyway).
- **Not present on `CrashAlertScreen.tsx`** (severity 2–5) — never asked for there; flagged as a possible follow-up if the user wants haptics on every severity, not just severity 1.
- Never confirmed to actually vibrate on a device.

---

## 11. Known bugs / unverified fixes — honest list

Everything below was reasoned through and typechecks, but **none of it has been observed working on physical hardware**:

- BLE connection stability fix (10Hz telemetry throttle) — root cause was inferred from a diff review + BLE domain knowledge, not from reproducing the failure.
- Both calibration fixes (missing `calibration_complete`, blocking loop) — very high confidence these were real bugs (confirmed by reading the code, not inference), but the fix itself is unflashed/untested.
- `NOTIFY_SETTLE_MS`/`notifySettled` guard — a defensive addition; unclear if it actually addresses any real-world failure mode, since the more likely persistent risk (ongoing telemetry notifications interleaving with a write) isn't something this can fix from the app side at all (see §6, "not fixed / not investigated further").
- Background notification delivery, deep-link routing, and the notification-tap dedup logic (`handledIds` keyed by `request.identifier`) — logically reviewed for the getLastNotificationResponseAsync/addNotificationResponseReceivedListener race, never observed firing on a device.
- `remainingCountdownSeconds()` elapsed-time math — straightforward, but never exercised with a real delayed-tap scenario.
- The entire `notify-guardians` edge function — written, never deployed, never invoked against a real Twilio account. Will currently always fail when called (function doesn't exist yet at that URL).
- The Twilio SMS message content/formatting has never been seen as an actual received text message.
- `expo prebuild` was run clean this session (had to delete a stale `android/app/.cxx` directory first — prebuild's own cleanup failed on it) and the release APK was rebuilt successfully afterward, confirming the native project compiles with all new native modules linked and the `POST_NOTIFICATIONS` permission present in the merged manifest. This is the closest thing to "verified" in this list, but it's still just "builds and installs," not "works as intended."

---

## 12. Hardcoded values / magic numbers a new developer needs to know

**Firmware (`CrashDetector.ino`):**
| Constant | Value | Meaning |
|---|---|---|
| `TELEMETRY_INTERVAL_MS` | 100 | Telemetry notify rate (10Hz) — was every loop iteration (~100Hz), throttled this session after it was identified as likely destabilizing the connection |
| `CALIBRATION_SAMPLE_COUNT` | 50 | Samples averaged for calibration |
| `CALIBRATION_SAMPLE_INTERVAL_MS` | 20 | Spacing between calibration samples (non-blocking now) |
| `CALIBRATION_TIMEOUT_MS` | 3000 | Firmware gives up and reports failure if it can't collect 50 samples in this window |
| `IMPACT_LOW_G` / `IMPACT_HIGH_G` | ~1.22g / ~3.05g | Crash-severity impact thresholds (unchanged, pre-existing) |
| `GYRO_LOW_DPS` / `GYRO_HIGH_DPS` | ~915 / ~2439 dps | Crash-severity rotation thresholds (unchanged) |
| `TILT_HIGH_DEG` / `TILT_EXTREME_DEG` | 70 / 100 | Tilt thresholds (unchanged) |
| `EXTREME_TILT_HOLD_MS` | 4000 | How long extreme tilt must hold before a tilt-triggered crash fires (unchanged) |
| `STILL_WINDOW_MS` | 3000 | Stillness detection window (unchanged) |
| `FAULT_CONSECUTIVE_LIMIT` | 100 | Consecutive failed I2C reads before reporting a sensor fault (unchanged) |

**App (`crashDetectorBle.ts`):**
| Constant | Value | Meaning |
|---|---|---|
| `NOTIFY_SETTLE_MS` | 500 | New this session — delay after notify-subscribe before writes are allowed |
| `CALIBRATE_TIMEOUT_MS` | 5000 | App-side write timeout (pre-existing) |
| `SCAN_TIMEOUT_MS` | 15000 | Pre-existing |
| `RECONNECT_DELAYS_MS` | [1,2,4,8,16,30]s | Pre-existing backoff schedule |
| `REQUESTED_MTU` | 247 | Pre-existing |

**App (`emergencyPipeline.ts`):**
| Constant | Value | Meaning |
|---|---|---|
| `DEFAULT_COUNTDOWN_SECONDS` | 10 | Severity 2–5 countdown (pre-existing, unchanged) |
| `EMERGENCY_COUNTDOWN_SECONDS` | 30 | New this session — severity 1 countdown |

**App (`CalibrateSensorScreen.tsx`):**
| Constant | Value | Meaning |
|---|---|---|
| `CONFIRMATION_TIMEOUT_MS` | 5000 | Pre-existing — how long the UI waits for `calibration_complete` before showing an error |

**Notifications (`localCrashNotifications.ts`):**
- Channel ID: `"crash-alerts"`, importance `MAX`, vibration pattern `[0, 500, 250, 500, 250, 500]` (ms).

**Haptics:** 3 pulses, 200ms apart, `ImpactFeedbackStyle.Heavy`.

---

## 13. Dependencies added this session

**npm / Expo modules:**
- `expo-haptics@~57.0.1`
- `expo-notifications@~57.0.7`

**Both require a native rebuild** (they're native modules) — a JS bundle reload alone will not pick them up. `expo prebuild` was run once this session to regenerate the native Android project after these were added and after `app.json`'s `plugins`/`permissions` changed; a stale `android/app/.cxx` directory had to be manually deleted first because prebuild's own cleanup step failed on it.

**Supabase:**
- New Edge Function `notify-guardians` (`supabase/functions/notify-guardians/index.ts`) — code written, **not deployed**. To deploy: needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` set as function secrets first (none exist), then deploy via the Supabase MCP tool or CLI. No new tables/migrations added — reuses existing `profiles` and `guardians` tables. (Reminder: `emergency_profiles`, referenced by the *pre-existing* severity 2–5 flow, is not present in the live database — separate, older issue, not something this session touched or introduced.)

**No changes to:** `react-native-ble-plx`, `expo-location`, `expo-secure-store`, `@supabase/supabase-js`, or any other existing dependency.

---

## 14. Build/deploy state at end of session

- Latest commit: `f8614da` — "Fix calibration confirmation gap and blocking loop, add background crash alerts" (on top of `2e960c3` UI-unification and `7943ce9` BLE-throttle/severity-1-feature commits, all on `main`).
- A release APK (`android/app/build/outputs/apk/release/app-release.apk`, self-signed with the debug key) was built after the `expo prebuild` regeneration and sent to the user — this is the most current build artifact and reflects everything in this summary.
- The firmware (`CrashDetector.ino`) changes have **not been flashed to any physical device** — this needs to happen before any calibration or telemetry-stability testing is meaningful.
- An Android emulator (`Pixel_10` AVD) is available in this environment and was left running/booted at the end of the session, but cannot exercise BLE, real notifications-while-backgrounded behavior, or haptics meaningfully (emulators don't have BLE radios or physical vibration motors) — it's only useful for confirming the app builds/launches/renders correctly, not for validating anything in §§3, 6, 7, 8, 10.
