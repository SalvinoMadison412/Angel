# SESSION SUMMARY — Angel App Development

**Date:** 2026-08-14
**Repo:** `/Users/salvinomadison/Desktop/Angel` (`com.angel.crashdetection`)

> **Editorial note:** This file **overwrites** the previous `SESSION_NOTES.md`
> (dated 2026-08-08, covering a different session — partner-flow RLS fixes,
> the original WhatsApp sandbox investigation, disk cleanup, etc.). That
> content is now only in git history (see `git log -- SESSION_NOTES.md`) if
> it's needed again. This note covers only the session that just happened.
> Per this project's existing convention (see `PROJECT_CONTEXT.md` §5), a
> few items in the requested outline for this note didn't match what I have
> direct evidence for from this session — those are marked `[CORRECTED]`
> below rather than written as if verified.

═══════════════════════════════════════════
## 1. CURRENT APP STATE
═══════════════════════════════════════════

**Works, verified live this session (Android emulator, and the physical
device for the BLE sections):**
- Foreground location permission flow (onboarding step 1), including a
  precise-vs-approximate accuracy check.
- Guardian WhatsApp alerts — a live "I NEED HELP NOW" test during this
  session produced a `200` response with `whatsAppSent: 1`, a real Twilio
  message SID, and the rider's actual name (`"Kevin"`) in the message body.
- Device screen with the BIKE section removed; Bluetooth, Sensor
  Calibration, and Calibration Offsets cards unchanged.
- Guardians screen cards with the status dot/text removed.
- The new Light Cycle visualization (transparent PNG rider + lean animation
  + offline dim), background now matching the other Home cards.
- A release APK builds successfully and was handed off twice this session
  (see §5 for what's in the most recent one).

**Confirmed broken / not yet working:**
- Live BLE telemetry (Impact/Rotation/Lean values on Home) does not stream
  from the physical sensor as currently flashed — see §2.7. You reported
  "I am getting proper readings" after starting a reflash, but the phone
  disconnected from USB before I could re-attach the log stream and verify
  it independently. **This is not yet confirmed by me — only reported.**

**In progress / partially verified:**
- Background/"Always" location was deliberately *not* implemented (see
  §2.1) — this was a scope decision made with you mid-session, not an
  oversight.

═══════════════════════════════════════════
## 2. CHANGES MADE THIS SESSION, IN ORDER
═══════════════════════════════════════════

### 2.1 Location permissions (Android, foreground-only, precise)

Original ask was "Always On" background location + precise + hard-block-on-
denial. I flagged that pattern as a real Play Store / App Store rejection
risk two days before a launch (background permission requests need an
actual background use to justify them to reviewers, and neither store
allows a first-launch hard block). You chose **"foreground-only, done
right."** Implemented:

- `src/screens/onboarding/LocationPermissionScreen.tsx` — dropped the
  `requestBackgroundPermissionsAsync()` call entirely (nothing in the app
  currently runs in the background to use it — `react-native-ble-plx` has
  `isBackgroundEnabled: false`, and there's no `TaskManager` background
  location task). Added a precise-vs-approximate accuracy check
  (`result.android?.accuracy === "coarse"` / `result.ios?.accuracy ===
  "reduced"`) with its own non-blocking nudge screen. Denial still shows an
  explanation + "Open Settings" + a "Continue anyway" escape hatch (kept
  deliberately non-blocking).
- `src/screens/onboarding/OnboardingScreen.tsx` — moved the location step
  to step 1 of 6 (was step 5 of 7), so it's requested essentially on first
  launch rather than buried after four other onboarding steps. Verified
  against current DB state that no in-progress account is past step 1, so
  this reorder doesn't strand anyone mid-onboarding.
- `app.json` — switched the iOS plugin config key from
  `locationAlwaysAndWhenInUsePermission` to `locationWhenInUsePermission`,
  matching the foreground-only scope.
- **Real bug found and fixed along the way**: `ACCESS_BACKGROUND_LOCATION`
  was missing from the generated `AndroidManifest.xml` entirely (visible
  directly in the manifest, and later in a live logcat error: `"You need to
  add ACCESS_BACKGROUND_LOCATION to the AndroidManifest"`). Moot now since
  background location isn't requested at all anymore, but worth knowing if
  background location is revisited later.

### 2.2 "Debug window removal"

**[CORRECTED]** I have no record of removing a debug window/screen in this
session. The `__DEV__`-gated "TEMP · DEBUG / VIEW RAW BLE DATA" card on the
Device screen (linking to `DiagnosticScreen.tsx`) was **not touched** — it's
still there, still gated behind `__DEV__`. If this was done, it wasn't in
this Claude Code session; worth checking whether it happened in a separate
session or is still pending.

### 2.3 Rider name fix (profile save → alert pipeline)

You reported the WhatsApp alert said "Your rider" instead of the actual
name, even though you believed the profile was saved. I found the profile
name genuinely wasn't in the database — traced it to a real bug, not a
caching issue:

- Your account (`85e5392e-...`, the one signed in on your physical device)
  was created **before** the `handle_new_user()` trigger existed on this
  Supabase project, so it never got a `profiles` row at all. Every
  `PATCH /profiles` you sent was hitting zero rows — PostgREST returns
  `204` (success) for that regardless of whether any row actually changed,
  which is why it looked like it should have worked.
- Backfilled the missing row directly via SQL (same insert the trigger
  itself does). Confirmed via query that no other account was missing a
  row.
- Separately, the notify-guardians edge function was fetching
  `profiles.name` fresh on every invocation already (no cache to fix, this
  was confirmed by reading the code directly) — once the row existed and
  you saved a name through the app, subsequent live alerts correctly showed
  `"Kevin"` in the message body. Confirmed multiple times in Metro logs
  after this fix, including with the guardian-notified flow.
- Along the way, also fixed: `emergencyPipeline.ts`'s
  `invokeNotifyGuardians` now unwraps `FunctionsHttpError.context` so a
  failed edge-function call surfaces its real error message client-side
  instead of the generic "non-2xx status code" — this is what made it
  possible to actually diagnose the Twilio issues earlier in the session
  quickly instead of guessing.

### 2.4 Bike section removed from Device screen

Removed the BIKE card (Make/Model text inputs, SAVE button, "purely
organizational" description) from `src/screens/device/DeviceScreen.tsx`,
along with its now-unused local state/handler and `TextInput`-related
styles. `useDevice().saveBikeInfo` itself was left alone since onboarding's
`BikeStep` still uses it. Bluetooth, Sensor Calibration, and Calibration
Offsets cards are unchanged. Verified live.

### 2.5 Guardian card cleanup

Two-step request on `src/screens/guardians/GuardiansScreen.tsx`:
1. Removed the "Will receive crash alerts" text, replaced with a small
   green dot only.
2. You then asked to remove the dot too — done. The card now ends cleanly
   right after the phone number line, no leftover text, dot, or gap.
Both steps verified live.

### 2.6 WhatsApp template status

**[CORRECTED]** — "3 templates active" doesn't match what I have direct
evidence for. What I actually saw this session, across a fairly long
back-and-forth:
1. `angel_crash_alert` — the originally-referenced template. Turned out to
   be Meta-approved but I was initially given the wrong/unapproved Content
   SID for it (`HXdaf305d3ea7967b19d018527ebd2e353`, a *different*,
   newer template called `angel_emergency_alert` that was still "Under
   Review" at the time).
2. `angel_emergency_alert` — the template whose SID is currently set in the
   `TWILIO_TEMPLATE_SID` Supabase secret. By the end of this session, live
   sends using this SID were succeeding (`200`, real Twilio message SID,
   `status: "queued"`, no error).

I only have direct knowledge of these two template names. If there's a
third, I don't have visibility into it from anything done in this session —
worth confirming directly in the Twilio Content Template Builder rather
than assuming.

The edge function itself (`supabase/functions/notify-guardians/index.ts`)
was also given much more detailed logging this session — every Twilio
API request/response is now logged (`[notify-guardians] WhatsApp request/
response`), env vars are sanity-checked at invocation time (lengths only,
never the actual secret values), and the response body now includes a
`whatsAppResults` array with the raw Twilio message resource (sid, status,
error_code) per guardian — this is what let us see the real Twilio-side
state instead of guessing. Currently deployed as function version 27.

### 2.7 Firmware update — telemetry stream added, needs reflashing

This was the biggest investigation of the session. You reported the Live
Reading card showing dashes for Impact/Rotation/Lean despite the sensor
being connected (crash alerts fired correctly). I initially found no bug in
the app's BLE pipeline — confirmed via ~8 minutes of live `adb logcat`
tracing (`[BLE-PACKET]` tag) on your physical device that:
- Crash-type BLE packets parsed and dispatched correctly end-to-end.
- Zero telemetry-type packets ever arrived, across a full reconnect cycle
  with a healthy negotiated MTU (242, well above the ~150-byte safety
  margin).

You then asked me to re-verify against a "UI-only bug" theory — I checked a
live screenshot of your phone, which actually *confirmed* my diagnosis
rather than contradicting it: "DEVICE CONNECTED" showed correctly, and the
crash-event card rendered correctly, while only the telemetry-driven
Impact/Rotation/Lean tiles were empty. Both crash and telemetry messages go
through the identical code path, so this ruled out a UI/state-wiring bug.

I then read `firmware/CrashDetector/CrashDetector.ino` line-by-line: the
telemetry send (`sendTelemetry()`, throttled to 100ms via
`TELEMETRY_INTERVAL_MS`) is unconditional in `loop()`, using the exact same
`crashChar.writeValue()` mechanism as the crash-report path that was
demonstrably working. No bug found in the current firmware source.
Conclusion: **the physical sensor's firmware doesn't send telemetry because
it hasn't been reflashed with this repo's current `.ino` file** (which
already has `sendTelemetry()` — added at some point before this session,
per the file's own comments, but apparently never flashed onto the actual
hardware).

I opened `firmware/CrashDetector` in Finder for you and walked through the
Arduino IDE steps (open the folder as a sketch, required libraries —
`DFRobot_BMI160`, `ArduinoBLE`, `Preferences` — board: Arduino Nano ESP32).
You reported back "I am getting proper readings," but your phone had
disconnected from USB by that point, so **I was not able to re-attach the
live log and independently confirm telemetry is actually flowing.** This
should be the first thing re-verified next session — reconnect via USB and
watch `[BLE-PACKET]` for `"type":"telemetry"` packets.

### 2.8 Light Cycle visualization

Went through several iterations:

1. **First version** — replaced the old wireframe `HoloMotorcycle` (kept
   untouched elsewhere — still used dim on the auth screens) with a new
   `LightCycleVisual.tsx` component: a Firefly-generated base photo +
   animated SVG overlay layers (scrolling grid, helmet glow pulse, wheel
   rim pulse, scan line), lean rotation driven by live telemetry tilt.
   Found and fixed a real bug during verification: the rim-pulse rings
   stayed visibly on screen while "disconnected" because pausing an
   `Animated.Value` at its resting value doesn't mean opacity 0 — fixed by
   conditionally unmounting the whole overlay block when offline, not just
   pausing it.
2. **Redesign** — you provided a new PNG (front-facing Tron-style rider,
   already transparent — I verified this directly by sampling the PNG's
   raw alpha channel with Python/PIL, not by eye; the apparent "white
   background" was my preview tool flattening transparency for display,
   not a property of the file). Rewrote `LightCycleVisual.tsx` to drop all
   SVG overlays entirely — now just the image, a lean transform (±10° from
   ±45° tilt, `Animated.timing` 200ms, `Easing.out(Easing.quad)`, pivoted
   at bottom-center via `transformOrigin: "50% 100%"`), and an opacity fade
   (1.0 connected / 0.6 offline, animated).
3. **Background seam, round 1** — you reported a visible black rectangle
   behind the bike. Root cause: my own component had `backgroundColor:
   "#050508"` on a box that didn't match the surrounding `GlassCard`'s
   default translucent fill, creating a visible seam. Moved the background
   onto the card itself (`HomeScreen.tsx`'s `telemetryCard` style) and made
   the image container fully transparent. I explicitly did **not** run a
   background-removal script against the PNG for this, since I'd already
   proven it was already transparent — doing so risked damaging real
   detail (visor highlights, glow) via naive color-threshold matting.
4. **Background seam, round 2** — the `#050508` card override still didn't
   match the STATUS/LIVE READING cards' own background exactly. Removed the
   override entirely so `telemetryCard` inherits `GlassCard`'s default
   styling like every other card. Verified live — now visually identical to
   the STATUS card (same translucent fill + dot texture).

Every step of §2.8 was verified live on the emulator via screenshot,
including temporary hardcoded `isLinked`/`tilt` overrides to preview the
connected/leaning state (always reverted immediately after, with a
typecheck + reload to confirm the revert).

═══════════════════════════════════════════
## 3. OUTSTANDING ISSUES
═══════════════════════════════════════════

- **Sensor needs reflashing** (see §2.7) — and even after reflashing,
  **I have not independently confirmed live telemetry is flowing.** You
  reported success, but I lost the USB connection before I could verify.
  Reconnect and re-check `[BLE-PACKET]` logs / the Home screen's live
  Impact/Rotation/Lean tiles.
- **Light Cycle card background** — **[CORRECTED]**: as of the end of this
  session this was fixed and verified live (§2.8, round 2) — it matches the
  STATUS card exactly. Not an open item unless something regressed since.
- **WhatsApp template + rider name retest** — **[CORRECTED]**: this was
  retested after the profile fix, multiple times, and confirmed working
  (§2.3) — Metro logs show `"Kevin"` in the message body on live sends
  after the fix landed. Not an open item, though real end-to-end delivery
  (does it arrive on Bobby's phone, not just get accepted by Twilio) is
  still worth a manual check if you haven't looked at your own WhatsApp.
- **Third WhatsApp template** — see §2.6; I don't have visibility into a
  third template if one exists.
- **`Debug window removal`** — see §2.2; not something I did this session.
  Worth confirming whether this happened elsewhere or is still pending.
- **`assets/images/my video.mp4`** — see §4; this file does not exist in
  the repo as of this session.

═══════════════════════════════════════════
## 4. ASSETS IN PROJECT
═══════════════════════════════════════════

Checked `assets/images/` directly at the end of this session:

```
assets/images/
├── .DS_Store
└── lightcycle.png   (367,721 bytes, 1379×752, RGBA, verified transparent background)
```

- **`assets/images/lightcycle.png`** — the current Light Cycle base image,
  a front-facing Tron-style rider render with a genuinely transparent
  background (verified via direct alpha-channel sampling, not assumption).
  In active use by `src/components/LightCycleVisual.tsx`.
- **`assets/images/my video.mp4`** — **does not exist.** No `.mp4` file of
  any name exists anywhere under `assets/`. If a looping Firefly video was
  generated, it hasn't been saved into this repo yet — nothing to
  integrate until it's actually placed in the project.

═══════════════════════════════════════════
## 5. PRODUCTION READINESS CHECKLIST (Play Store)
═══════════════════════════════════════════

Not a full audit — this is what's directly known from this session plus
what's inherited unresolved from `PROJECT_CONTEXT.md`'s prior pass (that
doc covers Angel Partners too; only the Angel-relevant items are repeated
here).

**Blocking, from this session:**
- [ ] Reflash the physical sensor with current `CrashDetector.ino` and
      **independently confirm** live telemetry actually streams (§2.7) —
      currently unverified by me.
- [ ] Confirm real WhatsApp delivery end-to-end (Twilio accepting the send
      is confirmed; whether it lands on the recipient's phone is not).
- [ ] Decide whether `angel_emergency_alert`'s Meta review status has
      cleared "Under Review" — if it's still pending, sends may start
      failing again the moment Meta finishes reviewing it, depending on
      the outcome.

**Blocking, inherited from `PROJECT_CONTEXT.md` (not touched this
session, status as of 2026-08-08, unverified whether still current):**
- [ ] Privacy Policy for the Play Console listing — was not present in-repo
      as of the last audit.
- [ ] EAS production build config — no `eas.json` existed; releases are
      local Gradle builds only (this session's two release APKs were built
      this way, via `./gradlew assembleRelease`, signed with the existing
      release keystore).
- [ ] Permissions audit against Play's sensitive-permissions review —
      partially addressed this session (location scope was deliberately
      narrowed to reduce review risk, see §2.1), but not a full audit.
- [ ] Store listing assets (screenshots, description, etc.) — no evidence
      any exist in-repo.

**Explicitly deferred this session, by your own call:**
- Background/"Always" location and true background crash detection (BLE
  background mode, a `TaskManager` location task, Android foreground
  service, iOS `UIBackgroundModes`) — scoped out in favor of
  foreground-only, see §2.1. Would need to be built before the app can
  honestly claim any background protection capability.

═══════════════════════════════════════════
## REPO
═══════════════════════════════════════════

- Angel: `/Users/salvinomadison/Desktop/Angel`
- Only one commit landed during this session:
  `958e569` — "fix: use fixed Twilio Content template SID for guardian
  WhatsApp alerts"
- Everything else described above (§2.1–2.8) is **uncommitted** in the
  working tree as of this note. Run `git status` before doing anything
  destructive.
