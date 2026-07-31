## Angel platform — full project handoff

### 1. What this project is

Angel is a two-wheeler crash-detection platform with three parts. **Angel** (this repo, `/Users/salvinomadison/Desktop/Angel`) is the rider-facing Expo/React Native/TypeScript app: it pairs over Bluetooth Low Energy with a wearable/mountable crash sensor, runs a cancel-countdown when a crash is detected, and — depending on severity — either texts the rider's guardians or creates a dispatch ticket for a real-world responder. **Angel Partners** (`/Users/salvinomadison/Desktop/angel-partners`, a separate sibling repo) is a second Expo/TypeScript app for trained responders ("partners"): it lets them go on/off duty, receive a full-screen alert when a nearby severity 2–5 ticket opens, accept it, and navigate to the rider. Both apps share one Supabase project (Postgres + Auth + Realtime + Edge Functions) as the backend, but riders and partners are separate, unrelated auth accounts — there is no shared login. The hardware is an Arduino Nano ESP32-S3 wired to a GY-BMI160 accelerometer/gyroscope (I2C), running a custom Arduino sketch that scores crash severity on-device and pushes the result to the Angel app over BLE.

---

### 2. Repository layout

**Angel** (`/Users/salvinomadison/Desktop/Angel`) — Android-only (no `ios/` directory, no iOS config in `app.json`), Expo SDK ~57.

```
AGENTS.md / CLAUDE.md      — @-includes AGENTS.md; tells agents to read Expo v57 docs before coding
README.md                  — setup/run instructions (dev-client required, not Expo Go)
SESSION_CONTEXT.md          — this file
app.json                   — Expo config (see §4 for exact contents)
App.tsx                    — root component: font loading + splash gate, then provider tree
index.ts                   — registerRootComponent entry point
package.json                — dependencies/scripts (see §4)
tsconfig.json                — extends expo/tsconfig.base, strict:true, excludes supabase/functions

firmware/
  CrashDetector/CrashDetector.ino  — the Arduino sketch (see §3, full detail)
  README.md                        — BLE payload contract docs

supabase/
  migrations/0001_init.sql              — profiles, devices, guardians, responders, incidents, incident_events, subscriptions
  migrations/0002_crash_metrics.sql     — adds impact/gyro/tilt/still to incidents
  migrations/0003_calibration.sql       — adds devices.calibrated, incidents.calibrated
  migrations/0004_onboarding.sql        — profiles.onboarding_*, emergency_profiles table, devices.bike_make/model — NOT APPLIED LIVE (see §5)
  migrations/0005_partners_platform.sql — partners, crash_tickets tables + RLS + realtime — NOT APPLIED LIVE
  migrations/0006_training_tables.sql   — training_modules, partner_training_completions — NOT APPLIED LIVE
  migrations/0007_partner_rider_contact.sql — one RLS policy on profiles for partner→rider phone lookup — NOT APPLIED LIVE
  functions/notify-guardians/index.ts   — Twilio SMS edge function — NOT DEPLOYED (see §5)

src/
  theme/          colors.ts, spacing.ts, typography.ts, fonts.ts, index.ts — design tokens + Google Fonts loader
  lib/            supabase.ts, secureStorage.ts, oauth.ts, geo.ts, crashSignals.ts, queryClient.ts
  types/          database.ts — hand-written TS interfaces mirroring the SQL schema
  hooks/          useAuth, useProfile, useDevice, useGuardians, useResponders, useIncident,
                  useSubscription, useLocation, useCrashDetector, useEmergencyProfile (+ index.ts barrel)
  services/
    bluetooth/    crashDetectorBle.ts (real), mockCrashDetectorBle.ts, unavailableCrashDetectorBle.ts,
                  types.ts (UUIDs + zod schemas), index.ts (factory)
    emergency/    emergencyPipeline.ts, index.ts
    notifications/ NotificationService.ts (interface), MockNotificationService.ts, localCrashNotifications.ts, index.ts
    payments/     PaymentProvider.ts (interface), MockPaymentProvider.ts, index.ts
  navigation/     types.ts, RootNavigator.tsx, AuthNavigator.tsx, AppTabs.tsx, ProfileNavigator.tsx
  components/     GlassCard, PillButton, ScreenBackground, ScreenHeader, Tag, Avatar, StatTile, StepProgress,
                  SeverityMeter, RadialCountdown, HoloMotorcycle, GyroDial, DotGridBackground, TabBarIcon,
                  AnimatedSplash, RouteMap, NativeRouteMap, SchematicRouteMap (+ index.ts barrel)
  screens/
    auth/         PhoneEntryScreen, OtpScreen
    onboarding/   OnboardingScreen (4-step wizard)
    home/         HomeScreen
    device/       DeviceScreen, DeviceSetupScreen, CalibrateSensorScreen
    guardians/    GuardiansScreen, GuardianFormScreen
    crash/        CrashAlertScreen (severity 2–5), EmergencyCountdownScreen (severity 1), EmergencyAlertSentScreen
    incident/     LiveIncidentScreen (mock-responder tracking), ActiveTicketScreen (real-ticket tracking, unwired)
    plan/         SubscriptionScreen
    profile/      ProfileScreen
    debug/        DiagnosticScreen (temp, raw BLE viewer)

design-reference/  — design-system JSON manifest + adherence config (not read in depth; not functional code)
.claude/            — launch.json, settings.json, settings.local.json (agent/tooling config, not app code)
```

**No dangling imports found** — every file read during this handoff resolved cleanly; nothing in `src/` imports a module that doesn't exist on disk.

**Angel Partners** (`/Users/salvinomadison/Desktop/angel-partners`) — separate git repo, Expo SDK ~57, Android-focused (same dev-client requirement as Angel; `react-native-maps`, `expo-task-manager`, `expo-notifications` all need native code, won't run in Expo Go).

```
App.tsx / index.ts / app.json / package.json / tsconfig.json
.env / .env.example        — same Supabase project URL + anon key as Angel

src/
  theme/        colors.ts, spacing.ts, typography.ts, index.ts — same palette as Angel, system fonts (no custom font loading)
  lib/          supabase.ts, secureStorage.ts, geo.ts, duration.ts, mapsDeepLink.ts, queryClient.ts
  types/        database.ts — Partner, CrashTicket, TrainingModule, PartnerTrainingCompletion, RiderProfile
  hooks/        useAuth, usePartner, useTraining, useTickets, useRiderProfile (+ index.ts barrel)
  services/     locationTask.ts (background location + ticket poll), notifications.ts (local notification fallback)
  navigation/    types.ts, RootNavigator.tsx, AuthNavigator.tsx, PreApprovalNavigator.tsx, AppTabs.tsx
  components/    GlassCard, PillButton, ScreenBackground, ScreenHeader, Tag (+ index.ts barrel)
  screens/
    auth/        SignInScreen, SignUpScreen
    training/    TrainingScreen, ModuleReaderScreen, PendingApprovalScreen
    home/        HomeScreen (duty toggle)
    alert/       TicketAlertScreen (full-screen incoming-ticket modal)
    response/    ActiveResponseScreen
    history/     HistoryScreen, HistoryDetailScreen
    profile/     ProfileScreen
```

---

### 3. Firmware — exact current state

File: `firmware/CrashDetector/CrashDetector.ino`. Board: Arduino Nano ESP32. Sensor: BMI160 over I2C.

**I2C address**: `0x69` (`const int8_t i2c_addr = 0x69;`) — SAO pin floating. Not `0x68`.

**BLE UUIDs** (all three, exact):
| | UUID |
|---|---|
| Service | `9a0d2e10-66dd-4d3d-930e-a4d0e2806c51` |
| Telemetry/crash characteristic (read + notify) | `9a0d2e11-66dd-4d3d-930e-a4d0e2806c51` |
| Calibrate characteristic (write) | `9a0d2e12-66dd-4d3d-930e-a4d0e2806c51` |

Device advertises local name `"CrashDetector"`.

**Every constant, exact value**:
| Constant | Value | Meaning |
|---|---|---|
| `ACCEL_LSB_PER_G` | 16384.0 | BMI160 power-on default, ±2g |
| `GYRO_LSB_PER_DPS` | 16.4 | BMI160 power-on default, ±2000dps |
| `IMPACT_LOW_G` | 20000.0/16384.0 ≈ 1.22g | Impact score threshold (1 pt) |
| `IMPACT_HIGH_G` | 50000.0/16384.0 ≈ 3.05g | Impact score threshold (2 pts) |
| `GYRO_LOW_DPS` | 15000.0/16.4 ≈ 915dps | Rotation score threshold (1 pt) |
| `GYRO_HIGH_DPS` | 40000.0/16.4 ≈ 2439dps | Rotation score threshold (2 pts) |
| `TILT_HIGH_DEG` | 70.0 | Tilt score threshold (1 pt, impact path only) |
| `TILT_EXTREME_DEG` | 100.0 | Sustained-tilt trigger threshold (Path 2) |
| `EXTREME_TILT_HOLD_MS` | 4000 | How long extreme tilt must hold before Path 2 fires |
| `STILL_THRESH_G` | 5000.0/16384.0 ≈ 0.305g | Delta-per-loop threshold for "still" |
| `STILL_WINDOW_MS` | 3000 | Stillness must hold this long to set `still: true` |
| `FAULT_CONSECUTIVE_LIMIT` | 100 | Consecutive failed I2C reads before `fault` notification |
| `CALIBRATION_SAMPLE_COUNT` | 50 | Samples averaged per calibration |
| `CALIBRATION_SAMPLE_INTERVAL_MS` | 20 | Spacing between calibration samples (~1s total) |
| `CALIBRATION_TIMEOUT_MS` | 3000 | Firmware gives up and reports failure past this |
| `TELEMETRY_INTERVAL_MS` | 100 | Telemetry notify rate — 10Hz |

**Calibration state machine**: A single write (any byte) to the calibrate characteristic fires `onCalibrateWrite()` → `startCalibration()`, which sets `calibrating = true`, records `calibrationStartedMs`, and zeroes all accumulator sums. Actual sampling happens inside `loop()`, non-blocking: every iteration where `calibrating` is true and `≥20ms` has passed since the last sample, it accumulates raw accel (X/Y/Z), raw gyro (X/Y/Z), and the per-sample impact magnitude (for mean/variance) into `double` sums. No `delay()` is used for this. Once 50 samples are collected: computes the mean accel vector (tilt reference), mean gyro vector (zero-rate offset), and `sqrt(variance)` of the impact-magnitude samples (impact baseline), calls `saveCalibration(...)`, then `sendCalibrationComplete(true)`. If 3000ms elapses without reaching 50 samples, it aborts, sets `calibrating = false`, and calls `sendCalibrationComplete(false)` — **no** calibration is persisted on timeout.

**NVS persistence** — `Preferences` namespace `"angel"` (not `"crash"`). Keys, exactly:
- `calibrated` (bool)
- `ref_ax`, `ref_ay`, `ref_az` (float) — tilt reference vector, raw accel counts
- `gyro_ox`, `gyro_oy`, `gyro_oz` (float) — gyro zero-rate offset, raw gyro counts
- `impact_base` (float) — impact stillness baseline, in g's

**The `calibrating` flag**: exists (`bool calibrating`), set `true` in `startCalibration()`, set `false` both on successful completion (line inside the sample-count-reached branch) and on firmware-side timeout. It **does mute crash detection** — `if (calibrating) return;` sits in `loop()` immediately after telemetry is sent and before either crash-detection path, so a calibration in progress (including recalibrating an already-calibrated device) cannot score or fire a crash alert against the stale, about-to-be-replaced reference. Telemetry keeps streaming during calibration (with a `calibrating` field, see below) — only alert-firing is gated.

**Crash detection — both trigger paths**, gated by `if (calibrated) { ... }` (i.e. only runs if a calibration has ever succeeded):
- **Path 1 (impact)**: `impactG > IMPACT_LOW_G` sets `wasImpact = true` and starts a 2000ms window (hardcoded literal `2000`, not a named constant). When that window elapses, scores: `+2` if `impactG > IMPACT_HIGH_G` else `+1` if `> IMPACT_LOW_G`; `+2` if `gyroDps > GYRO_HIGH_DPS` else `+1` if `> GYRO_LOW_DPS`; `+1` if `tilt > TILT_HIGH_DEG`; `+1` if `isStill`. Sends a `crash` report with `trigger: "impact"`.
- **Path 2 (tilt)**: only evaluated when `!wasImpact`. If `tilt > TILT_EXTREME_DEG` continuously for `EXTREME_TILT_HOLD_MS` (4000ms), scores starting at `1`, `+2`/`+1` for gyro same as above, `+1` if still. Sends a `crash` report with `trigger: "tilt"`. Fires once per sustained-tilt episode (`tiltIncidentReported` guard).

**Severity scoring table** (`severityFromScore`): score ≤1 → severity 1; score==2 → 2; score==3 → 3; score==4 → 4; anything else (≥5) → 5. Max possible score is impact path 2+2+1+1=6 (still severity 5) or tilt path 1+2+1=4 (severity 4 max via tilt alone).

**Impact/gyro correction applied before scoring or telemetry**: `gyroDps` is computed from `(gx-gyroOffX, gy-gyroOffY, gz-gyroOffZ)`, not raw. `impactG` is `max(0, impactGRaw - impactBaseline)`. Tilt is computed from the **raw, uncorrected** accel vector against the raw `refX/refY/refZ` reference (tilt calculation itself is unchanged from before the gyro/impact-baseline work).

**Telemetry JSON** (every field, sent at `TELEMETRY_INTERVAL_MS`):
```json
{"type":"telemetry","impact_g":0.98,"gyro_dps":12.4,"tilt":2.1,"still":true,"calibrated":true,"calibrating":false}
```
Note: `calibrating` is a real field in the current firmware, sent alongside `calibrated`. `firmware/README.md`'s example payload has **not** been updated to show it (doc drift — the README still shows only 5 fields, the actual code sends 6).

**Crash JSON** (every field):
```json
{"type":"crash","trigger":"impact","severity":3,"impact_g":1.74,"gyro_dps":1165.3,"tilt":42.1,"still":true,"calibrated":true}
```
(`trigger` is `"impact"` or `"tilt"`; no `calibrating` field on this message type.)

**Fault messages**: `{"type":"fault","reason":"sensor_communication_lost"}` and `{"type":"fault_cleared"}`. `reason` is currently always the one literal string — no other fault reasons exist in the code.

**Calibration-complete**: `{"type":"calibration_complete","calibrated":true}` or `...calibrated":false}`.

**Bugs fixed (confirmed by reading the current code)**:
- Standard Bluetooth SIG Heart Rate UUIDs are not used anywhere — custom UUIDs only (header comment documents this was a past bug, already fixed before this session's work).
- `calibration_complete` is sent on both success and timeout paths.
- Calibration sampling is fully non-blocking (no `delay()` inside the sample loop).
- Telemetry throttled to 100ms (10Hz), not sent every loop iteration.
- Crash detection is muted (`if (calibrating) return;`) during an in-progress calibration.
- Gyro offset and impact baseline are captured and applied (three-signal calibration, not tilt-only).

**Bugs/gaps still open in the firmware**:
- No mechanism suppresses the continuous 10Hz telemetry stream *during* a calibrate write specifically (only during the ~1s `calibrating` window is detection muted — the notify channel itself is still busy with telemetry throughout, which was flagged in an earlier session as a possible source of Android BLE instability during calibration and was never conclusively ruled out or fixed).
- The `2000` (impact confirmation window) and other small literals inside `loop()` are not named constants, unlike everything else.
- `firmware/README.md`'s telemetry example JSON is stale (missing `calibrating`).

---

### 4. Angel app — exact current state

**Navigation structure** (`src/navigation/`):
- `RootNavigator.tsx` — top-level switch, driven by `useAuth()` + `useProfile()`: no session → `AuthNavigator`; session but `!profile.data?.onboarding_completed` → `OnboardingScreen` directly (not a stack); otherwise → `AppNavigator` (defined inline in this same file). A splash screen (`AnimatedSplash`) overlays everything for a minimum 1300ms (200ms if Reduce Motion is on), extended up to 400ms more if auth/profile are still loading, then fades over 250ms.
- `AuthNavigator` (stack): `PhoneEntry` → `Otp`.
- `AppNavigator` (defined inside `RootNavigator.tsx`, not its own file) — stack containing: `Tabs` (the bottom-tab navigator), `DeviceSetup`, `CalibrateSensor`, `CrashAlert` (gestures disabled), `EmergencyCountdown` (gestures disabled), `EmergencyAlertSent`, `LiveIncident`, `ActiveTicket`, `GuardianForm`, `Diagnostic`. Also mounts `CrashDetectorListener` (renders `null`, pure side-effect component) alongside the stack.
- `AppTabs` (bottom tabs): `Home`, `Device`, `Guardians`, `Profile` (the last is itself a nested stack, `ProfileNavigator`: `ProfileHome` → `Plan`).
- `ProfileNavigator` (stack): `ProfileHome` → `Plan`.

**BLE layer** (`src/services/bluetooth/`): Three implementations behind one `CrashDetectorBle` interface, selected by `getCrashDetectorBle(mock: boolean)`: `CrashDetectorBleService` (real, `react-native-ble-plx`), `MockCrashDetectorBleService` (Home screen's debug panel + severity simulation), `UnavailableCrashDetectorBleService` (stub shown if constructing the real service throws, e.g. running in Expo Go).

A **GATT operation queue does exist**: `CrashDetectorBleService.enqueue()` chains every `connect()`/`disconnect()`/`calibrate()` call onto a single `operationTail` promise so exactly one GATT operation is ever in flight. Connect flow: `connectToDevice()` → `requestMTU(247)` (best-effort, failure doesn't kill the connection) → `discoverAllServicesAndCharacteristics()` → `monitorCharacteristicForService()` (subscribe to notifications) → wait `NOTIFY_SETTLE_MS = 500ms` → set `notifySettled = true` → register disconnect listener → persist paired device → state = `connected`. `calibrate()` throws if `notifySettled` isn't true yet (belt-and-suspenders; the queue should make this unreachable). Reconnect backoff: `[1000, 2000, 4000, 8000, 16000, 30000]` ms. `isLinked` (exposed via `useCrashDetector`) debounces real disconnects behind a 2000ms grace window so brief blips don't flicker the UI.

**Calibration flow** (`CalibrateSensorScreen.tsx`): Reused for both first-connect (pushed by `DeviceSetupScreen` with `mandatory: true` the first time a connection lands on an uncalibrated device) and later voluntary recalibration (from the Device tab, no param). States: `idle → calibrating → success | error`. On `idle`, shows instructions plus the literal line "Keep the bike upright and stationary. Do not move it." and a CALIBRATE button (disabled if not connected). On tap: calls `calibrate()` (the GATT write), which only acks receipt — the screen does **not** treat the write resolving as success. It waits for a `calibration_complete` BLE notification (`CONFIRMATION_TIMEOUT_MS = 5000`), driven by a `waitStartedAtRef` timestamp so a stale confirmation from an earlier attempt can't be mistaken for this one's result. While waiting, a progress bar animates over `CALIBRATION_EXPECTED_MS = 1000` capped at 95% (`PROGRESS_CAP`) — cosmetic only, the real completion signal is the notification. If the notification says `calibrated: true` → success (and syncs `devices.calibrated` if it wasn't already true); if `false` → error ("sensor reported calibration didn't take"). If the connection drops mid-wait (past the debounce grace window) or the 5s timeout elapses first → error with a retry button. `mandatory` blocks the skip button and Android back button until something actually goes wrong. **The "uncalibrated" warning banner is implemented** — both on `DeviceSetupScreen` (after connecting, if `!device?.calibrated`) and on `DeviceScreen`'s Sensor Calibration card.

**Crash alert flow**: `CrashDetectorListener` (inside `RootNavigator.tsx`) merges events from both the real and mock BLE instances, picks the most recent, and routes via `navigateToCrashAlert()`: `shouldTriggerAlert(event)` (severity ≥ 2) → `CrashAlertScreen`; otherwise → `EmergencyCountdownScreen`. It also fires a local Android notification (`presentCrashNotification`) if the app isn't foregrounded at that moment, and syncs `devices.calibrated` if the event's calibrated flag disagrees with the stored one.

- **Severity 1 → `EmergencyCountdownScreen`**: 30s countdown (`EMERGENCY_COUNTDOWN_SECONDS`), elapsed-time-aware (`remainingCountdownSeconds`, so opening late via a notification tap doesn't restart the clock). 3 heavy haptic pulses on mount. On expiry or "SEND HELP NOW": `sendGuardianAlert()` — logs locally, captures GPS best-effort, invokes the `notify-guardians` edge function, navigates to `EmergencyAlertSentScreen` on success or shows an inline error/retry on failure. On "I'M OK": `cancelCrashEvent()` (local log only) → back. No `incidents` row is ever written for this path; no responder dispatch.
- **Severity 2–5 → `CrashAlertScreen`**: 10s countdown (`DEFAULT_COUNTDOWN_SECONDS`), also elapsed-time-aware. **On mount**, independently starts creating a `crash_tickets` row (see next section) — this is separate from the countdown/dispatch logic below and does not block it. On expiry or "SEND HELP NOW": `confirmIncident()` — logs locally, captures GPS, inserts an `incidents` row, best-effort loads `emergency_profiles` for medical info (fails soft — table doesn't exist live, see §5), calls `notificationService.notifyGuardians()` (the **mock** implementation — writes to `incident_events` + `console.log`, no real SMS), finds the nearest mock `responders` row and assigns it, navigates to `LiveIncidentScreen`. On "I'M OK": `cancelCrashEvent()` **plus** closes the crash_ticket if one was created (see below) → back.
- `EmergencyAlertSentScreen`: "Alert sent to N contacts" + names (from the app's own already-loaded guardian list, not the edge function's response) + "RETURN HOME".

**Crash ticket creation — implemented, in `CrashAlertScreen.tsx`** (not in `emergencyPipeline.ts` — kept separate per the prompt that added it): a `useEffect` on mount (guarded by a `ticketPromiseRef` so it only ever runs once) does, if `severity >= 2` and a session exists: requests foreground location permission, gets current position (best-effort — on any failure, `rider_lat`/`rider_lng` are inserted as `null`, never blocking), then inserts into `crash_tickets`: `rider_id`, `severity`, `trigger`, `impact_g` (from `impactG`), `gyro_dps` (from `gyroDps`), `tilt_deg` (from `tilt`), `rider_lat`, `rider_lng`, `status: "open"`. The insert's result id is stored (as a promise) for `handleCancel()` to await and then `UPDATE ... SET status='closed', closed_at=now()`. Dispatching (`SEND HELP NOW` or countdown expiry) does **not** touch the ticket at all — it's already `open`, which is correct per spec. **This table does not exist in the live database yet** (§5) — so in the app's current deployed state, this insert will fail every time (caught, logged via `console.warn`, doesn't block the alert).

**ActiveTicketScreen — exists** (`src/screens/incident/ActiveTicketScreen.tsx`), registered in the nav stack, but **nothing navigates to it**. `CrashAlertScreen.dispatch()` still goes to `LiveIncidentScreen` (the mock-responder screen) as it always has. Its content: "Help is on the way" heading, a status tag (open/accepted/closed/escalated), a `RouteMap` (rider pin, and partner pin once accepted, falling back to the rider's own coordinates otherwise), a partner card (name + "CALL PARTNER" tel: link once `status === "accepted"` and the partner row loads), "CALL 112" and "I'M SAFE NOW — CLOSE TICKET" buttons. Subscribes to the ticket row via Supabase Realtime (`postgres_changes` UPDATE) so it updates live if a partner accepts from the Angel Partners app. Defines its own local `CrashTicket`/`Partner` TS interfaces and its own inline `useTicket`/`usePartner` query hooks (not shared with anything else, deliberately, per the prompt that added it).

**Supabase usage by screen** (tables actually queried):
- `PhoneEntryScreen`/`OtpScreen` → `auth` only (phone OTP).
- `OnboardingScreen` → `profiles`, `emergency_profiles`, `guardians`, `devices`.
- `HomeScreen` → `guardians` (count), `subscriptions` (current plan) — plus the mock BLE stream, no table.
- `DeviceScreen`/`DeviceSetupScreen`/`CalibrateSensorScreen` → `devices`.
- `GuardiansScreen`/`GuardianFormScreen` → `guardians`.
- `CrashAlertScreen` → `incidents` (via `confirmIncident`), `emergency_profiles` (read, best-effort), `crash_tickets` (insert + update, best-effort — table absent live).
- `EmergencyCountdownScreen` → no direct table write (delegates to the edge function, which itself reads `profiles`/`guardians` server-side).
- `LiveIncidentScreen` → `incidents`, `incident_events`, `responders`.
- `ActiveTicketScreen` → `crash_tickets`, `partners` (both absent live).
- `ProfileScreen` → `profiles`, `devices`, `emergency_profiles`, `subscriptions`.
- `SubscriptionScreen` → `subscriptions`.
- `DiagnosticScreen` → no table, pure BLE state viewer.

**Guardian SMS**: The `notify-guardians` edge function is **written but not deployed** — confirmed live via `list_edge_functions`, which returns an empty list for this project. It requires three secrets (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`) that are not set anywhere visible in this repo (no evidence either way on whether they exist in the Supabase dashboard, but the function isn't deployed regardless, so it's moot). Until deployed, `sendGuardianAlert()` will always throw, and `EmergencyCountdownScreen` will always land in its error/retry state on send.

**Confirmed working vs. implemented-but-untested**: Nothing in this handoff session was executed against real hardware or a real Twilio account — this is a read-only documentation pass, not a test pass. Everything above is described as it exists in the source and against the confirmed live database schema (§5), not as "verified working." Treat all of §4 as "this is what the code does," not "this is confirmed to work end-to-end."

---

### 5. Supabase — exact current state

**Project**: `vqkwdwbzbwjplxqpqsuj` (`https://vqkwdwbzbwjplxqpqsuj.supabase.co`). `list_migrations` on this project returns an empty list — there is no tracked migration history; whatever schema exists live was applied by hand (SQL Editor), not via `supabase migration`/CLI push. The migration **files** in this repo are therefore a mix of "already applied, matches live" and "written, never run."

**Migration files, what each creates/alters**:
| File | Creates/alters | Applied live? |
|---|---|---|
| `0001_init.sql` | `profiles`, `devices`, `guardians`, `responders`, `incidents`, `incident_events`, `subscriptions` + RLS + 2 triggers + realtime on incidents/incident_events + seeds 5 mock responders | **Yes** — matches live schema exactly |
| `0002_crash_metrics.sql` | adds `incidents.impact/gyro/tilt/still` | **Yes** — columns present live |
| `0003_calibration.sql` | adds `devices.calibrated`, `incidents.calibrated` | **Yes** — columns present live |
| `0004_onboarding.sql` | adds `profiles.onboarding_completed`/`onboarding_step`; creates `emergency_profiles`; adds `devices.bike_make`/`bike_model` | **No** — confirmed absent live (see below) |
| `0005_partners_platform.sql` | creates `partners`, `crash_tickets` + RLS + realtime on crash_tickets | **No** |
| `0006_training_tables.sql` | creates `training_modules`, `partner_training_completions` + trigger + seeds 3 modules | **No** |
| `0007_partner_rider_contact.sql` | adds one RLS policy to existing `profiles` table | **No** |

**Every table that actually exists live right now** (via `list_tables`, verbose, verified this session):
- `public.profiles` — `id (uuid, PK, FK→auth.users)`, `name (text, null)`, `phone (text, null)`, `subscription_tier (int4, null)`, `subscription_expiry (timestamptz, null)`, `created_at (timestamptz, default now())`. **No `onboarding_completed`/`onboarding_step` columns.**
- `public.devices` — `id (uuid, PK, default gen_random_uuid())`, `owner_id (uuid, FK→auth.users)`, `calibration_offset_x/y/z (numeric, default 0)`, `pairing_status (text, default 'unpaired', check in unpaired/pairing/paired)`, `created_at`, `calibrated (bool, default false)`. **No `bike_make`/`bike_model`.**
- `public.guardians` — `id`, `user_id (FK→auth.users)`, `name`, `phone`, `relationship (null)`, `priority (int4, default 1)`, `alert_mode (text, default 'call', check call/sms)`, `created_at`.
- `public.responders` — `id`, `name`, `type (check gig_partner/auto/car_uber)`, `platform_label (null)`, `rating (null)`, `vehicle_label (null)`, `lat/lng (float8)`, `available (bool, default true)`. 5 rows (the seeded mock responders).
- `public.incidents` — `id`, `user_id (FK→auth.users)`, `device_id (FK→devices, null)`, `severity (int4, check 1-5)`, `status (text, default active, check active/cancelled/resolved)`, `lat/lng (float8, null)`, `assigned_responder_id (FK→responders, null)`, `created_at`, `resolved_at (null)`, `impact/gyro/tilt (numeric, null)`, `still (bool, null)`, `calibrated (bool, null)`. 10 rows.
- `public.incident_events` — `id`, `incident_id (FK→incidents)`, `label`, `occurred_at`. 20 rows.
- `public.subscriptions` — `id`, `user_id (FK→auth.users)`, `tier (int4, check 3/6/12)`, `start_date`, `end_date`, `status (default active, check active/expired/cancelled)`, `created_at`. 1 row.

**Tables referenced in app code that do NOT exist live** — flagged clearly, this is the single most important finding in this handoff:
- `emergency_profiles` — referenced in `useEmergencyProfile.ts`, `ProfileScreen.tsx`, `OnboardingScreen.tsx` (indirectly via the hook), `emergencyPipeline.ts`'s `confirmIncident()`. The read in `confirmIncident` is wrapped in try/catch and fails soft. The **hook's own query is not wrapped** — `useEmergencyProfile()`'s `useQuery` will error against a missing table, meaning `emergencyProfile.data` stays undefined and any UI depending on it (Onboarding step 2, Profile screen's medical section) will not behave as designed until this migration is applied.
- `partners`, `crash_tickets` — referenced in `CrashAlertScreen.tsx` (insert/update) and `ActiveTicketScreen.tsx` (select). Both wrapped in try/catch where they matter for not blocking the crash-alert flow; `ActiveTicketScreen`'s queries are not reachable anyway since nothing navigates there.
- `training_modules`, `partner_training_completions` — referenced only in the angel-partners repo, not in Angel.
- **Practical consequence**: `profiles.onboarding_completed` being absent means `select("*")` on `profiles` simply omits that key, so `!profile.data?.onboarding_completed` is always `true` for a signed-in user with a profile row — **every sign-in currently forces onboarding**, and `profile.setOnboardingStep.mutateAsync()` / `profile.completeOnboarding.mutateAsync()` (both `.update()` calls referencing a nonexistent column) will error against PostgREST's schema cache. This is a live, current-state bug, not a hypothetical.

**RLS policies**: Every one of the 7 live tables has `rls_enabled: true`. Policy contents were not independently re-queried this session (only column/table shape was, via `list_tables`) — the policy **text** for the applied migrations (0001–0003) can be trusted to match those files' `CREATE POLICY` statements, since the resulting table/column shape matches exactly; there is no way to confirm the live and file text are byte-identical without a separate policy dump, so treat the RLS shown in 0001–0003's files as *what the live policies are meant to be*, not independently re-verified this session.

**Realtime**: `0001_init.sql` enables it on `incidents` and `incident_events` (applied live, since 0001 is applied). `0005_partners_platform.sql` would enable it on `crash_tickets` (not applied, so not live).

**Edge functions**: `list_edge_functions` on this project returns an empty array. `notify-guardians` exists only as a local file (`supabase/functions/notify-guardians/index.ts`) — it has never been deployed. Required secrets if/when deployed: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (plus `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, which the Edge Functions runtime provides automatically).

---

### 6. Angel Partners app — exact current state

The `angel-partners/` directory **exists** — a separate Expo/TypeScript project at `/Users/salvinomadison/Desktop/angel-partners`, its own git repo, own `package.json`/`node_modules`, sharing only the Supabase project URL/anon key with Angel (via its own `.env`).

**Navigation structure**: `RootNavigator.tsx` switches on `useAuth()` (session) and `usePartner()` (the signed-in user's `partners` row): no session → `AuthNavigator` (`SignIn`↔`SignUp`); session but `!partner.data?.is_approved` → `PreApprovalNavigator` (`Training`→`ModuleReader`, or `PendingApproval`); approved → the main stack (`Tabs` [bottom tabs: `Home`, `History`, `Profile`], plus `ActiveResponse` and `TicketAlert` pushed on top, plus `HistoryDetail`). An `IncomingTicketListener` (mirroring Angel's `CrashDetectorListener` pattern) is mounted alongside the approved-app stack: subscribes to `crash_tickets` INSERT events (status=open) only while `partner.is_active`, and navigates to `TicketAlert` on both a live event and a tapped local notification (deduped by ticket id).

**BLE layer**: none — Angel Partners has no Bluetooth code at all; it only talks to Supabase and device location/notifications.

**Auth**: email/password (`supabase.auth.signUp`/`signInWithPassword`), completely separate account space from Angel's phone-OTP riders. On sign-up, immediately inserts a `partners` row with `is_active: false`, `is_approved: false`.

**Training/approval flow**: `TrainingScreen` lists all `training_modules` (ordered by `order_index`) with a completed/not-completed tag per module (from `partner_training_completions`); auto-navigates to `PendingApproval` the instant every module has a completion row (client-side check — the actual `training_completed_at` stamp happens server-side via a trigger in `0006_training_tables.sql`). `ModuleReaderScreen` renders `content_markdown` via `react-native-markdown-display` and a "MARK COMPLETE" button that inserts a `partner_training_completions` row (duplicate-insert errors, Postgres code `23505`, are swallowed as a no-op). `PendingApprovalScreen` re-fetches the partner row on every screen focus (`useFocusEffect`) — approval itself only happens out-of-band via the Supabase dashboard, per spec; there is no in-app admin flow.

**Duty toggle / background location**: `HomeScreen`'s ON DUTY/OFF DUTY toggle calls `startDutyLocationUpdates`/`stopDutyLocationUpdates` (`src/services/locationTask.ts`) alongside `usePartner().setActive.mutate()`. This registers an `expo-task-manager` background task (`LOCATION_TASK_NAME = "angel-partners-duty-location"`, defined at module scope, imported once in `App.tsx` for its side effect) via `Location.startLocationUpdatesAsync` with `timeInterval: 30000`. Each firing: updates `partners.current_lat/lng/location_updated_at`, **and** polls `crash_tickets` for any `status='open'` row created since the last check, firing a local notification (`expo-notifications`) for each new one found — this doubles as the "app is backgrounded" alert fallback described in the brief (a second, independent background-fetch task was not built; the location task's own 30s tick was used for both purposes). Partner id and last-ticket-check timestamp are persisted via `expo-secure-store` (not in-memory), since the task can run in a restarted headless JS context on Android.

**Incoming ticket alert**: `TicketAlertScreen` — full-screen, `BackHandler` blocks Android back, 45-second client-side-only countdown (`COUNTDOWN_SECONDS`), shows severity badge, Haversine distance from the partner's `current_lat/lng` to the ticket's `rider_lat/lng`, trigger label, impact/rotation/tilt readings. ACCEPT calls `useAcceptTicket()`, which does `UPDATE crash_tickets SET status='accepted', accepted_by=<partner id>, accepted_at=now() WHERE id=... AND accepted_by IS NULL` — the `.is("accepted_by", null)` filter combined with `.select().single()` is the atomicity guarantee (zero rows updated → Postgrest error → caught, shown as "another partner already accepted this one," auto-dismisses). DECLINE or timeout just navigates back. On accept success, replaces with `ActiveResponse`.

**ActiveResponseScreen**: `react-native-maps` `MapView` with the rider's pin, the partner's own live pin (`expo-location.watchPositionAsync`, 5s/10m interval — separate, tighter-cadence foreground watch than the 30s duty background task), and a dashed `Polyline` between them (straight line, not real routing). "NAVIGATE" opens the native maps app via a platform-specific deep link (`maps://app?daddr=` on iOS, `google.navigation:q=` on Android, falling back to a Google Maps web URL if the scheme fails to open). "CALL RIDER" looks up the rider's phone via `useRiderProfile()` (`select id, name, phone from profiles where id = rider_id`) — this depends on the `0007_partner_rider_contact.sql` RLS policy, which is not applied live, so this query will currently return nothing/error under RLS. A response timer counts up from `accepted_at`. "MARK SAFE" closes the ticket and pops to top; "ESCALATE TO 112" dials 112 and sets `status='escalated'`. If the *rider* closes the ticket first (from Angel's `ActiveTicketScreen` or `CrashAlertScreen`'s cancel), the realtime subscription behind `useTicket()` picks up the status change and the screen pops to top automatically (distinguished from the partner's own close action via a `closedByMeRef` guard).

**History/Profile**: `HistoryScreen` lists every ticket this partner has `accepted_by`'d, with response time (`accepted_at - created_at`) and resolution time (`closed_at - accepted_at`) computed client-side; tapping a row opens `HistoryDetailScreen` (read-only). `ProfileScreen` shows name/phone/approval badge, a "GO OFF DUTY" shortcut, training progress (`completed/total` module count), sign-out.

**What is confirmed working vs. untested**: This app was scaffolded, built, and installed on an Android emulator during an earlier session, and its Sign In/Sign Up screens were confirmed to render and navigate correctly (a `punycode` Metro resolution bug and a notification-channel sound-config bug were found and fixed during that verification pass). **Nothing past the sign-up form has been exercised against a live backend** — the `partners`/`crash_tickets`/`training_modules`/`partner_training_completions` tables don't exist live yet (§5), so sign-up itself will currently fail at the point it tries to insert a `partners` row.

---

### 7. Open bugs and unresolved work

- **Onboarding is currently broken against the live database.** `profiles.onboarding_completed`/`onboarding_step` don't exist live → every sign-in forces onboarding, and the mutations that would advance/complete it will error. Layer: Supabase schema / `RootNavigator.tsx` / `OnboardingScreen.tsx` / `useProfile.ts`. Fix prescribed (apply `0004_onboarding.sql`), not yet applied or verified.
- **`emergency_profiles` table doesn't exist live.** `useEmergencyProfile()`'s query will error (unguarded); `confirmIncident()`'s read is guarded and fails soft. Layer: Supabase schema / `useEmergencyProfile.ts` / `ProfileScreen.tsx` / `OnboardingScreen.tsx`. Fix prescribed (0004), not applied.
- **`devices.bike_make`/`bike_model` don't exist live.** Any bike-info save (`DeviceScreen`, `ProfileScreen`, Onboarding step 4) will error. Fix prescribed (0004), not applied.
- **`partners`/`crash_tickets` don't exist live.** Crash-ticket creation (`CrashAlertScreen`) fails soft (caught, logged); `ActiveTicketScreen`'s queries would error if the screen were ever reached, but nothing navigates there yet. Fix prescribed (0005), not applied.
- **`training_modules`/`partner_training_completions` don't exist live.** Angel Partners' entire training/approval flow cannot function. Fix prescribed (0006), not applied.
- **The `0007` RLS policy (partner reading a rider's phone) isn't applied.** `ActiveResponseScreen`'s "CALL RIDER" would return no data even once `crash_tickets`/`partners` exist, until this is also applied.
- **`notify-guardians` edge function is not deployed**, and no evidence either way on whether Twilio secrets are configured. Severity-1 guardian SMS will always fail (caught, shown as an inline retry) until deployed. Layer: Supabase Edge Functions.
- **`ActiveTicketScreen` is unreachable.** Built and registered in the nav stack, but `CrashAlertScreen.dispatch()` still navigates to the old mock-responder `LiveIncidentScreen`. This was a deliberate scope decision in the session that built it (explicitly confirmed with the user at the time — "add only, don't wire it"), not an oversight, but it means the whole Angel Partners rider-facing loop has no entry point yet from the Angel app's real dispatch flow.
- **Firmware telemetry-during-calibration BLE-stability question is unresolved.** Flagged in an earlier session as a possible cause of Android BLE instability specifically during calibration (continuous 10Hz notifications competing with the calibrate write); the `calibrating` mute added since then stops false crash alerts, but does not address this separate, still-open BLE-stability question. No fix has been prescribed for this one.
- **`firmware/README.md`'s telemetry example is stale** (missing the `calibrating` field the actual firmware sends). Cosmetic/documentation-only.
- **No foreground service backs BLE or crash notifications in Angel.** Android can suspend/kill the app process while backgrounded; the local-notification fallback (`presentCrashNotification`) only works in the window before that happens. Explicitly researched and scoped down in an earlier session (a real fix would need a native Android foreground service + config plugin) rather than an oversight — not fixed, not planned as of this handoff.
- **`DiagnosticScreen` is explicitly marked TEMP** in its own header comment, meant to be removed once the (already-resolved) `calibration_complete` investigation is fully closed out. Still present, still wired into the nav stack and `DeviceScreen`.
- **Angel Partners' Google Maps API key is a placeholder** (`REPLACE_WITH_GOOGLE_MAPS_API_KEY` in `angel-partners/app.json`) — Android maps will not render until a real key is added; iOS needs none (uses Apple Maps by default).

---

### 8. What must not be changed

- **BLE UUIDs** (firmware and `src/services/bluetooth/types.ts` must always agree):
  - Service: `9a0d2e10-66dd-4d3d-930e-a4d0e2806c51`
  - Telemetry/crash characteristic: `9a0d2e11-66dd-4d3d-930e-a4d0e2806c51`
  - Calibrate characteristic: `9a0d2e12-66dd-4d3d-930e-a4d0e2806c51`
- **I2C address**: `0x69` (not `0x68`).
- **Firmware timing constants**: `TELEMETRY_INTERVAL_MS = 100` (do not increase frequency — this throttle was added specifically to fix a prior BLE stability bug), `CALIBRATION_SAMPLE_COUNT = 50`, `CALIBRATION_SAMPLE_INTERVAL_MS = 20` (must stay non-blocking — no `delay()` inside the sample loop), `CALIBRATION_TIMEOUT_MS = 3000`.
- **Severity scoring thresholds**: `IMPACT_LOW_G`/`IMPACT_HIGH_G` (20000/50000 raw, ÷16384), `GYRO_LOW_DPS`/`GYRO_HIGH_DPS` (15000/40000 raw, ÷16.4), `TILT_HIGH_DEG = 70`, `TILT_EXTREME_DEG = 100`, `EXTREME_TILT_HOLD_MS = 4000`, `STILL_THRESH_G` (5000 raw, ÷16384), `STILL_WINDOW_MS = 3000`, `FAULT_CONSECUTIVE_LIMIT = 100`.
- **NVS namespace and keys**: namespace `"angel"`; keys `calibrated`, `ref_ax`/`ref_ay`/`ref_az`, `gyro_ox`/`gyro_oy`/`gyro_oz`, `impact_base`. Changing any of these orphans every already-calibrated device's stored data.
- **Do not reintroduce standard Bluetooth SIG UUIDs** (e.g. Heart Rate Service `180D`/`2A37`) — this was a confirmed, fixed bug; some OS BLE stacks special-case recognized profiles and corrupt the payload.
- **Do not make the calibration sample loop blocking again** (no `delay()` inside it) — this was a confirmed, fixed bug that stalled `BLE.poll()` for ~1s per calibration.
- **The `calibrating` mute in `loop()`** (`if (calibrating) return;`, placed after telemetry send, before crash-detection) must stay — removing it reintroduces spurious crash alerts during recalibration.
- **`crash_tickets.severity` domain is 2–5 only** — severity 1 must never create a ticket row (enforced both by a DB check constraint in `0005` and a client-side guard in `CrashAlertScreen.tsx`).

---

### 9. Immediate next steps

1. **Apply the pending migrations to the live Supabase project, in order: `0004_onboarding.sql`, `0005_partners_platform.sql`, `0006_training_tables.sql`, `0007_partner_rider_contact.sql`.** This is the single highest-leverage fix — onboarding is actively broken live, and the entire Partners platform (both apps) has zero functional backend until these run. Nothing else in this list matters until this is done.
2. **Decide and wire up how a rider actually reaches `ActiveTicketScreen`.** It's built and tested-in-isolation but has no entry point — either replace `LiveIncidentScreen` as `CrashAlertScreen.dispatch()`'s destination, or design some other path (this was explicitly deferred, not decided, in the session that built it).
3. **Deploy the `notify-guardians` edge function** (after confirming/setting the three Twilio secrets) so severity-1 guardian SMS can work at all.
4. **Verify the firmware builds and flashes** with the current three-signal calibration + `calibrating` mute on real hardware — nothing in this codebase has been confirmed working on an actual sensor since those changes landed; all verification so far has been static code reading plus emulator UI smoke tests (no BLE radio in an emulator).
5. **Replace the placeholder Google Maps API key** in `angel-partners/app.json` so `ActiveResponseScreen`'s map actually renders on Android, and confirm `ActiveResponseScreen`'s rider-phone lookup works once `0007` is applied.
