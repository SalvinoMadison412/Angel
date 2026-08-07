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

## Phone auth setup (Twilio Verify)

Phone login (`PhoneLoginScreen` → `OTPVerifyScreen`) uses Supabase's native
phone provider, backed by **Twilio Verify** — not plain Twilio SMS. Verify
issues and checks the OTP itself rather than sending a raw SMS, which is
what makes it exempt from TRAI's DLT sender-registration rules that block
ordinary SMS delivery to Indian numbers.

1. https://console.twilio.com → Verify → Services → create a Verify Service
   (or reuse one). Copy its **Service SID** (`VAxxxxxxxx...`).
2. From the Twilio Console root, copy your **Account SID** and **Auth
   Token**.
3. Supabase Dashboard → project `vqkwdwbzbwjplxqpqsuj` → Authentication →
   Providers → **Phone** → Enable.
4. Set the SMS provider to **Twilio Verify** and fill in:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_VERIFY_SERVICE_SID`
5. Save. No app code changes are needed beyond what's already in this repo
   — `sendOtp`/`verifyOtp` in `src/hooks/useAuth.tsx` call
   `supabase.auth.signInWithOtp` / `verifyOtp` directly, and Supabase routes
   the actual delivery through whatever provider is configured here.

`supabase/migrations/0010_phone_auth_setup.sql` documents (rather than
duplicates) the existing `profiles.phone` column and signup trigger this
depends on — see the comments at the top of that file.

## Guardian crash alerts (Twilio WhatsApp + Exotel voice calls)

When a severity 2-5 crash creates a `crash_tickets` row, a Supabase
**Database Webhook** fires the `notify-guardians` Edge Function, which
messages and calls every guardian on file via Twilio WhatsApp and Exotel.
Three things need to be configured outside this repo before that actually
delivers anything:

### 1. Twilio — WhatsApp

1. https://console.twilio.com → Messaging → Try it out → Send a WhatsApp
   message (sandbox) for development, or apply for a WhatsApp-enabled
   Twilio Sender for production. Either way you end up with a
   WhatsApp-enabled Twilio number.
2. From the Twilio Console root, collect:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_NUMBER` — the WhatsApp-enabled number itself, e.g.
     `+14155238886` (no `whatsapp:` prefix — the function adds that when
     building the `From` address).
3. In the sandbox, each guardian must first send the sandbox's join code to
   your Twilio WhatsApp number from their own phone before Twilio will
   deliver messages to them — a one-time step per guardian, sandbox-only.
   A production WhatsApp Sender doesn't have this restriction.

`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` here can be the same Twilio account
as the "Phone auth setup" section above, but they're configured in two
separate places — Supabase's Auth provider settings there, Edge Function
secrets here — and aren't shared automatically between them.

### 2. Exotel — voice calls

Exotel has no "speak this text" REST call — a call can only connect to a
pre-built **Flow** (an ExoML app) configured in the Exotel dashboard.

1. Exotel dashboard → Flows → new Flow → add a **Text-to-Speech** applet
   that reads `{{CustomField}}` → publish.
2. Copy that Flow's App ID.
3. Collect from the Exotel dashboard:
   - `EXOTEL_API_KEY`
   - `EXOTEL_API_TOKEN`
   - `EXOTEL_SID`
   - `EXOTEL_SUBDOMAIN`
   - `EXOTEL_CALLER_ID` (your Exotel virtual number)
   - `EXOTEL_FLOW_APP_ID` (the Flow from step 2 — not in the original
     credentials list, but required for the call to actually say anything)

### 3. Set the secrets

```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=... \
  TWILIO_AUTH_TOKEN=... \
  TWILIO_WHATSAPP_NUMBER=... \
  EXOTEL_API_KEY=... \
  EXOTEL_API_TOKEN=... \
  EXOTEL_SID=... \
  EXOTEL_SUBDOMAIN=... \
  EXOTEL_CALLER_ID=... \
  EXOTEL_FLOW_APP_ID=...
```

(Or Dashboard → Edge Functions → `notify-guardians` → Secrets.)

### 4. Create the Database Webhook

Dashboard → Database → Webhooks → **Create a new hook**:

- Table: `crash_tickets`
- Events: `Insert`
- Type: Supabase Edge Functions
- Edge Function: `notify-guardians`
- Auth: service role key (the default) — `notify-guardians` checks the
  incoming `Authorization` header against `SUPABASE_SERVICE_ROLE_KEY`, so
  this must stay selected.

Severity-1 "missed check-in" alerts (`EmergencyCountdownScreen`) don't go
through this webhook — they never create a `crash_tickets` row — and
instead call the same Edge Function directly from the app with the caller's
own session. Both paths share the same Twilio WhatsApp/Exotel senders.
