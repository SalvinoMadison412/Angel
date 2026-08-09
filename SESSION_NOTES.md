# SESSION SUMMARY — Angel App Development

**Date:** 2026-08-08 (1:00 AM – 4:30 AM IST)
**Engineer:** Salvino Kevin Madison

> **Editorial note (added when this file was saved):** This is the
> engineer's own session log, covering both work done directly in this
> Claude Code session and work done manually elsewhere (Twilio console,
> Meta Business Manager, WhatsApp). Two corrections were made against
> points Claude Code has direct, first-hand knowledge of from this
> session (marked inline below with `[CORRECTED]`). Live credentials
> originally included in this summary were redacted before committing —
> see the Credentials section for why.

═══════════════════════════════════════════
## WHAT WAS ACCOMPLISHED
═══════════════════════════════════════════

### 1. PROJECT_CONTEXT.md
Full project documentation covering both sibling apps (Angel + Angel
Partners), the Supabase project, stack, working features, bugs, and next
steps. **[CORRECTED]** This file already existed in the repo before
this session (commit `2cb5be0`, "Add PROJECT_CONTEXT.md summarizing
platform architecture and this session's fixes") — it was not created
during this 1:00–4:30 AM session.

### 2. notify-guardians Edge Function — root cause found and fixed

**[CORRECTED]** The actual bug chain, per this session's git history and
Claude Code's direct work, was different from the original draft of
this note:

a) **Real root cause of the original 500s**: `guardians.phone` had been
   renamed to `guardians.phone_number` by an untracked migration
   (applied directly against the database at some point, never
   committed as a migration file) — completely unrelated to Twilio
   secrets. The `notify-guardians` function's
   `db.from("guardians").select("name, phone")` query failed with
   `column "phone" does not exist`, which its catch-all turned into a
   500 before Twilio was ever reached. Fixed in commit `57e3e88`
   ("fix: restore guardians.phone and drop broken notify-guardians
   trigger"), which also dropped an unrelated orphaned DB trigger
   (`notify_guardians_on_crash`) that called the function with a
   hardcoded service-role JWT and an empty body — incompatible with the
   function's user-session auth model, so it could never have worked.
   New migrations `0013`/`0014` added to bring the repo back in sync
   with the live DB.

b) **SMS → WhatsApp switch**: at the engineer's explicit request, the
   function was changed from Twilio SMS (`TWILIO_FROM_NUMBER`) to Twilio
   WhatsApp (`TWILIO_WHATSAPP_NUMBER`), with `whatsapp:` prefixes added
   to both `To` and `From`. Commit `f7cd837`, deployed as function
   version 6. This was a deliberate feature change, not a bug fix for a
   "name mismatch" that was independently discovered — the secret name
   was changed as part of this same request.

c) **Error 21212 ("From number not a valid phone number")**: caused by
   a double `whatsapp:` prefix — `TWILIO_WHATSAPP_NUMBER` already stored
   the value pre-prefixed (`whatsapp:+14155238886`), but the fetch call
   was prepending another one, producing
   `whatsapp:whatsapp:+14155238886`. Fixed in commit `7b9bbd5`, deployed
   as function version 8. Verified live (via the Android emulator's "I
   NEED HELP NOW" flow): the post-fix invocation returned HTTP 200 in
   ~3 seconds, versus the pre-fix broken path's 87–146ms fast-fail
   before ever reaching Twilio — strong evidence the fix landed, though
   final delivery confirmation (does the WhatsApp message actually
   arrive) needs checking in the Twilio console or on the recipient's
   phone, which Claude Code cannot see from the Supabase side.

   Claude Code did not use `npx supabase functions download` — the
   local `supabase` CLI is not authenticated in this environment
   (`supabase login` requires an interactive browser flow). All function
   reads/writes/deploys went through the Supabase MCP tools instead.

### 3. WhatsApp sandbox opt-in (Bobby)
Per the engineer's account: guardian "Bobby" (+916301233270) sent "join
mouse-business" to +14155238886 and received Twilio's confirmation at
1:53 AM. Claude Code has no direct visibility into this (it happens over
WhatsApp, outside any tool available in this session) and is recording
it as reported.

### 4. Twilio Messaging Service investigation
Per the engineer's account: the "Angel" Messaging Service
(`MG637242580a35dc651c8351ac06b5055e`) had 0 senders; attempted to add a
WhatsApp sender via the Twilio console but the sandbox number isn't
owned by the account, so it can't be attached that way. Dead end, per
the engineer. Claude Code did not perform any Twilio console browser
automation in this session and has no direct visibility into this
investigation.

### 5. WhatsApp production number — not resolved tonight
Per the engineer's account:

- **Buying an Indian Twilio number**: blocked by TRAI regulations
  preventing foreign Twilio numbers from delivering SMS to Indian
  mobiles. Abandoned.
- **Registering a spare business SIM for WhatsApp Business**: Meta
  rejected it ("number already registered to a WhatsApp account"), then
  after that was cleared, hit a second error ("business has not met
  WhatsApp's policy requirements"). Needs business contact info filled
  in at business.facebook.com/settings. Not completed tonight — deferred
  to the next session.

### 6. WhatsApp delivery — status
The double-prefix bug (see #2c) is fixed and deployed. Whether messages
are actually being delivered end-to-end depends on the sandbox/business
number situation in #5, which is unresolved. Next session should
re-verify delivery once a working `TWILIO_WHATSAPP_NUMBER` is in place.

### 7. Partner functionality removed from Angel v1
Confirmed via this session's git history — commit `0dc813a` ("feat:
remove partner/responder dispatch for v1 Play Store release"):
- Deleted `LiveIncidentScreen.tsx` (mock responder matching/ETA/ratings)
  and `useResponders.ts` — pure partner logic, no shared code.
- Commented out (with `TODO: RE-ENABLE FOR V2` markers, not deleted —
  tangled with core crash-alert code) the nearest-responder distance
  calc/assignment in `CrashAlertScreen.dispatch()` and
  `useAssignResponder` in `useIncident.ts`.
- Simplified `ActiveTicketScreen.tsx`: was "Help is on the way / WAITING
  FOR A PARTNER" with partner-acceptance status, CALL PARTNER, and a
  partner-location realtime subscription. Now: "Help is on the way /
  Your guardians have been notified", a single-pin crash-location map,
  CALL 112, and I'M SAFE NOW — CLOSE TICKET.
- Simplified the map components (`RouteMap`, `NativeRouteMap`,
  `SchematicRouteMap`) from two-point rider+responder route renderers to
  single-pin crash-location maps.
- Removed the `Responder`/`ResponderType` types and the "Gig-partner
  dispatch, 24/7" line from the subscription plan screen.
- Guardian management screens, crash detection, and the
  `crash_tickets`/`incidents` insert logic were untouched, per the
  original request. **[CORRECTED]** `crash_tickets` insert does **not**
  trigger the guardian WhatsApp notification — that's a separate,
  independent call (`confirmIncident` → `invokeNotifyGuardians` in
  `emergencyPipeline.ts`) that happens regardless of whether the
  `crash_tickets` row is written successfully. The `crash_tickets` table
  exists for the (now-unused-by-Angel-v1) Angel Partners integration.
  Verified end-to-end on the Android emulator: a simulated severity-3
  crash correctly showed the new guardians-notified confirmation screen
  with no partner content anywhere.
- `angel-partners` repo was not touched, per the original request.

### 8. Build artifact cleanup
**[CORRECTED]** Actual space freed, measured via `df` before/after, was
**~5.4 GB** (35 GB → 40.5 GB free), not the ~2 GB estimate — many of the
deleted files were APFS hardlinked copies sharing underlying storage
(the `libreactnative.so` files alone summed to 2.9 GB across ~60
copies, but that overstates real usage due to the hardlinking).

Removed: all `libreactnative.so` files system-wide (found only under
`Angel/`, `angel-partners/`, and `~/.gradle/caches` — nothing elsewhere
on the Mac), release/debug `.apk`s in both projects,
`android/app/build/` in both projects, `.expo/` cache in both projects.
No `/tmp/metro-*`, `/tmp/haste-*`, or `node_modules/.cache` existed in
either project at cleanup time.

**Side effect discovered and fixed later in the session**: the
`find ~ -name "libreactnative.so" -delete` step reached into Gradle's
global immutable cache (`~/.gradle/caches/.../transforms/...`), not just
the project's build folder. Deleting files Gradle expects to be
immutable once written corrupted its integrity checks, causing the next
`assembleRelease` to fail with "the contents of the immutable workspace
... have been modified." Fixed by clearing
`~/.gradle/caches/9.3.1/transforms/` and stopping the Gradle daemon (a
stale in-memory reference to the wiped cache caused a second failure on
the first retry) — safe, since it's just a cache that regenerates, at
the cost of one slower rebuild. Worth remembering if a similar
home-wide `find ~ -delete` cleanup comes up again: `~/.gradle` and
`~/.android` are risky targets for that.

### 9. Bug fixes

**BUG 1 — Location permission requested too late (at crash time, not
launch).** Fixed in commit `0be28b2`. Real gap confirmed by Claude Code
before fixing: the existing onboarding screen only requested foreground
permission and silently continued regardless of outcome — no background
permission, no denial explanation, no revocation detection, no location
caching. Implemented:
- Foreground + background permission requested together during
  onboarding, before the home screen is ever reached.
- A blocking "why we need this" screen on denial ("Angel needs your
  location to send it to your guardians if you're in a crash...") with
  an Open Settings button and a smaller "Continue anyway" escape hatch
  (can't be a hard gate).
- A live `Location.watchPositionAsync` cache
  (`src/services/location/locationTracking.ts`, module-level, not React
  state, so `emergencyPipeline.ts` and `CrashAlertScreen` can read it
  synchronously at crash time instead of waiting on a fresh GPS fix).
- A monitor (`RootNavigator.tsx`) that re-checks the OS-level permission
  on every app-foreground resume, since a rider revoking it from system
  Settings is never otherwise reported to the app. A persistent warning
  banner shows on the Home screen whenever the permission isn't granted.
- Verified live on the Android emulator: app boots clean, the
  permission read correctly reflects the real OS grant state, and
  Android's `FusedLocationProvider` logs confirm the watch is actually
  running (it was rate-limiting the registered listener, which only
  happens when a listener is live). The denial path (blocking screen)
  was not exercised live — the test AVD already had location granted
  from earlier testing, and re-triggering onboarding needs a fresh
  account.

**BUG 2 — BLE telemetry (Impact/Rotation/Lean) not showing on Home
screen.** Status: **audited, root cause not yet confirmed — real
hardware evidence gathered, awaiting a phone-side test.**

- First pass: audited the full pipeline against the actual firmware
  source (UUIDs match exactly between `firmware/CrashDetector/
  CrashDetector.ino` and `src/services/bluetooth/types.ts`; the data
  format is JSON with Zod schema validation, not comma-separated; the
  firmware's extra `calibrating` field doesn't break validation — Zod
  strips unknown keys by default, verified empirically; `setState`
  (`setTelemetry`) is wired correctly). No code-level bug found.
- With the Arduino connected via USB to the Mac, captured live serial
  output at 115200 baud: the firmware's sensor loop is healthy — sane,
  continuously updating Impact/Gyro/Tilt values, with `sendTelemetry()`
  called unconditionally every 100ms right alongside that print. This
  rules out "firmware never generates telemetry."
- Leading hypothesis: **BLE notification truncation from insufficient
  negotiated MTU.** BLE notifications (unlike long reads/writes) are
  never fragmented/reassembled by the stack — a payload bigger than
  (negotiated MTU − 3) bytes is silently cut off by the radio before the
  app ever sees it. Telemetry JSON is ~116 bytes, crash JSON ~125 bytes;
  Android's BLE default MTU is 23 (20 usable). `requestMTU(247)` is
  already called in `crashDetectorBle.ts`, but a resolved promise isn't
  proof the negotiation actually stuck at the radio level. This matches
  this codebase's own prior history — the `DiagnosticScreen.tsx`
  comments reference an earlier "calibration_complete investigation"
  into a similar-smelling problem (a 49-byte message, also bigger than
  the 20-byte default).
- Attempted to verify directly by connecting the Mac's own Bluetooth
  radio to the Arduino (bypassing the phone and app entirely, via a
  Python `bleak` script) — blocked by macOS refusing bare `python3`
  Bluetooth access without an app bundle declaring
  `NSBluetoothAlwaysUsageDescription` (confirmed via the crash log:
  `TCC` / `SIGABRT`). Fixable by granting Terminal Bluetooth permission
  in System Settings → Privacy & Security → Bluetooth, but needs manual
  interaction — not done.
- Instrumented instead (commit `390c189`,
  "diag: instrument BLE notify path for silent MTU-truncation
  failures"): every BLE notification now logs the negotiated MTU and
  raw/decoded payload byte lengths, with an explicit warning if MTU
  comes back below a ~150-byte safety margin, and flags any decoded
  payload that doesn't end in `}` (the signature of mid-JSON
  truncation). Also added the missing "LAST TELEMETRY" section to
  `DiagnosticScreen.tsx` (Device tab → "VIEW RAW BLE DATA", dev builds
  only) — the screen previously had connection/crash/calibration/fault
  sections but never telemetry.
- **Not yet done**: testing this instrumented build with the phone
  connected to the real Arduino, to read the actual MTU/truncation
  diagnostic and confirm or rule out the hypothesis. If confirmed, the
  real fix is firmware-side (shrink the JSON payload, or don't send
  telemetry until MTU negotiation completes) — not something forceable
  from the app alone.
- **[CORRECTED]** Hardware is **ESP32 (Arduino Nano ESP32) with a
  BMI160** accelerometer/gyroscope on I2C, per
  `firmware/README.md`/`CrashDetector.ino` — not "ESP32-WROOM with
  MPU-6050."

### 10. Hardware manufacturing package
**[CORRECTED]** No `hardware/` directory exists in this repo as of this
session. If this package was created, it was not done in this Claude
Code session and is not present in the current repo state — worth
checking where it actually lives before assuming it's ready to commit.

═══════════════════════════════════════════
## CURRENT BUG STATUS
═══════════════════════════════════════════

- ✅ FIXED — `guardians.phone` schema drift breaking `notify-guardians`
  (migrations `0013`/`0014`, commit `57e3e88`)
- ✅ FIXED — `notify-guardians` double `whatsapp:` prefix / error 21212
  (commit `7b9bbd5`, deployed as version 8)
- ✅ FIXED — Keyboard covers phone input on PhoneEntry/Otp screens
  (`KeyboardAvoidingView`, commit `6a9193d`)
- ✅ DONE — Partner/responder screens removed for v1 (commit `0dc813a`)
- ✅ DONE — Location permission requested at launch, background
  permission, live caching, revocation banner (commit `0be28b2`)
- ✅ DONE — Disk cleanup (~5.4 GB freed) + Gradle cache corruption from
  that cleanup fixed
- 🔄 IN PROGRESS — BLE telemetry not showing on Home screen: firmware
  confirmed healthy via serial, MTU-truncation diagnostics shipped
  (commit `390c189`), awaiting a real phone+Arduino test to confirm root
  cause
- ⚠️ BLOCKED (per engineer's account, outside this session) — WhatsApp
  guardian alert delivery: needs a working production/business WhatsApp
  number registered and `TWILIO_WHATSAPP_NUMBER` updated to match

═══════════════════════════════════════════
## CREDENTIALS & SERVICES
═══════════════════════════════════════════

**Live secrets (Twilio Account SID, Auth Token, Verify SID) were in the
original draft of this note and have been redacted here — they must
never be committed to this (or any) repo.** They live only in Supabase's
Edge Function secrets for project `vqkwdwbzbwjplxqpqsuj`, set via
`npx supabase secrets set ... --project-ref vqkwdwbzbwjplxqpqsuj` or the
[Supabase dashboard](https://supabase.com/dashboard/project/vqkwdwbzbwjplxqpqsuj/settings/functions).
If you need to reference them, use a local, gitignored `.env` file or a
password manager — not a file in this repo.

- Supabase project: `vqkwdwbzbwjplxqpqsuj` (shared by both Angel and
  Angel Partners)
- WhatsApp sandbox number: `+14155238886`
- Sandbox join code: `join mouse-business`
- Twilio Messaging Service: `MG637242580a35dc651c8351ac06b5055e`
  ("Angel", 0 senders as of this session per the engineer)

Supabase secrets set (values not recorded here — see Supabase dashboard):
- `TWILIO_ACCOUNT_SID` ✅
- `TWILIO_AUTH_TOKEN` ✅
- `TWILIO_WHATSAPP_NUMBER` ✅ (currently `whatsapp:+14155238886`, the
  sandbox number — needs updating once a production/business number is
  ready)
- `MSG91_API_KEY` ✅ (not in use — WhatsApp used instead)

Guardian used for testing:
- Name: Bobby
- Phone: `+916301233270`
- Relationship: Brother
- Sandbox joined: per the engineer's account, yes (confirmed 1:53 AM)

═══════════════════════════════════════════
## NEXT PRIORITIES
═══════════════════════════════════════════

1. **Resolve WhatsApp delivery** (most critical, per the engineer):
   fill in Meta Business contact info, register the spare business SIM
   as a WhatsApp Business number, link to Twilio, update
   `TWILIO_WHATSAPP_NUMBER`, then send a real test crash and confirm
   Bobby receives it.
2. **Confirm the BLE telemetry root cause**: run the diagnostic build
   (commit `390c189`) with the phone connected to the real Arduino,
   check Device → VIEW RAW BLE DATA's new Telemetry section and/or
   `adb logcat | grep BLE-PACKET` for the MTU/truncation warnings.
3. **Re-verify the partner-screen removal** on a real device (already
   verified on the emulator — see #7 above).
4. **Re-verify the location permission fix** on a fresh install (already
   verified partially on the emulator — the denial/blocking-screen path
   still needs a real first-run test).
5. **Play Store prep** (after WhatsApp delivery works): final release
   build, store listing assets, privacy policy covering location and
   BLE permissions.

═══════════════════════════════════════════
## ARCHITECTURE REMINDER
═══════════════════════════════════════════

Crash flow (v1, no partners):

```
Device (ESP32 + BMI160)
  → BLE notify
  → Angel app crash detection
  → 30s countdown (severity 1) or 10s (severity 2-5)
  → user does not cancel
  → confirmIncident(): incidents row + notify-guardians (WhatsApp)
    — independent of crash_tickets, see correction in #7 above
  → crash_tickets row also inserted (severity 2-5 only) for the
    Angel Partners platform — not used by Angel v1's own UI anymore
  → guardian receives WhatsApp alert with location
```

- Angel app: `com.angel.crashdetection`
- Angel Partners app: `com.angel.partners` (not part of the v1 Play
  Store release; its repo is untouched)
- Both share Supabase project `vqkwdwbzbwjplxqpqsuj`
- All migrations live in this repo's `supabase/migrations/` — but note:
  this session found that the live database has drifted from these
  files before (untracked migrations applied directly, see #2a above).
  Worth periodically diffing `supabase list_migrations` against what's
  actually committed here.

═══════════════════════════════════════════
## REPOS
═══════════════════════════════════════════

- Angel: `/Users/salvinomadison/Desktop/Angel`
- Angel Partners: `/Users/salvinomadison/Desktop/angel-partners`
