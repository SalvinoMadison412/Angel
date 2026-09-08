# Angel Platform — Project Context

Written at the end of a QA-and-fix session covering both apps. Intended to let a fresh Claude Code session pick up with full context. Everything below is either directly verified in this session or clearly marked as unverified/inherited.

## 1. App overview

Two-wheeler crash-detection platform, two separate Expo/React Native/TypeScript apps sharing one Supabase backend:

- **Angel** (this repo, `/Users/salvinomadison/Desktop/Angel`) — rider-facing app, package `com.angel.crashdetection`. Pairs over BLE with a crash sensor wired into the motorcycle's battery, runs a cancel-countdown when a crash is detected, and — depending on severity — texts the rider's guardians and/or creates a dispatch ticket for a real-world responder.
- **Angel Partners** (sibling repo, `/Users/salvinomadison/Desktop/angel-partners`, package `com.angel.partners`) — responder-facing app. Trained "partners" go on/off duty, get a full-screen alert when a nearby severity 2–5 ticket opens, accept it, and navigate to the rider.
- Riders and partners are **separate, unrelated auth accounts** (Angel: phone OTP or Google OAuth; Angel Partners: email/password) against the same `auth.users` table in one Supabase project. There is no shared login.

**Tech stack:** Expo SDK ~57 (`~57.0.8` Angel / `~57.0.9` Angel Partners), React Native 0.86.x, TypeScript, `@tanstack/react-query` for data fetching, `@react-navigation` (native-stack + bottom-tabs), Supabase (Postgres + Auth + Realtime), `expo-secure-store` for session persistence, `react-native-maps` (Angel Partners only, for the active-response map), `react-native-ble-plx` (Angel only, for the sensor). Both are release-built as native Android APKs via Gradle (dev-client required — neither runs in Expo Go, due to native modules).

**Supabase project:** `vqkwdwbzbwjplxqpqsuj`. All schema migrations for both apps live in **this repo** (`Angel/supabase/migrations/`), even the ones that only affect Angel Partners — there's no separate migrations folder in the angel-partners repo.

**Hardware (Angel only, not touched this session):** Arduino Nano ESP32-S3 + GY-BMI160 accelerometer/gyroscope over I2C, custom sketch scores crash severity on-device, pushes to the app over BLE.

## 2. Architecture notes

### Angel (rider app)

```
RootNavigator
 ├─ !session              → AuthNavigator (PhoneEntry, Otp)
 ├─ session && !onboarding_completed → OnboardingScreen (4-step wizard)
 └─ else                  → AppNavigator
     ├─ Tabs (AppTabs: Home, Device, Guardians, Profile→Plan)
     ├─ DeviceSetup, CalibrateSensor
     ├─ CrashAlert (severity 2–5) / EmergencyCountdown (severity 1)
     ├─ EmergencyAlertSent
     ├─ ActiveTicket (real crash_tickets flow) / LiveIncident (legacy mock-responder fallback)
     ├─ GuardianForm
     └─ Diagnostic (TEMP, marked for removal)
```

Key behavior: a severity ≥2 crash event inserts a `crash_tickets` row (the real Angel Partners integration) **and separately** creates an `incidents` row + assigns a mock `responders` row (a legacy/parallel system, unrelated schema). Which of `ActiveTicket` / `LiveIncident` the rider sees depends solely on whether the `crash_tickets` insert succeeded. Severity 1 never touches either — it's guardian-SMS-only via the `notify-guardians` edge function.

`src/` layout: `components/`, `hooks/`, `lib/` (supabase client, secureStorage, oauth, geo, crashSignals), `navigation/`, `screens/{auth,crash,debug,device,guardians,home,incident,onboarding,plan,profile}/`, `services/{bluetooth,emergency,notifications,payments}/`, `theme/`, `types/`.

### Angel Partners (responder app)

```
RootNavigator
 ├─ BYPASS_AUTH (src/config/devBypass.ts) — if true, skips everything below
 │   and renders AppNavigator directly against a hardcoded MOCK_PARTNER.
 │   Currently true in the working tree (pre-existing, not changed this
 │   session — see §3).
 ├─ !session               → AuthNavigator (SignIn, SignUp)
 ├─ session && !partner.is_approved → PreApprovalNavigator (Training, ModuleReader, PendingApproval)
 └─ else                   → AppNavigator
     ├─ Tabs (AppTabs: Home, History, Profile)
     ├─ ActiveResponse (map + actions once a ticket is accepted)
     ├─ TicketAlert (full-screen modal, 45s countdown, fires on new open ticket while on duty)
     └─ HistoryDetail
```

Ticket flow: `IncomingTicketListener` (mounted inside `AppNavigator`) subscribes via Supabase Realtime to `crash_tickets` INSERTs where `status='open'`, but only while `partner.is_active`. Accepting a ticket is a conditional `UPDATE ... WHERE accepted_by IS NULL` (race-safe against two partners accepting at once).

`src/` layout: `components/`, `config/` (devBypass.ts), `hooks/`, `lib/`, `navigation/`, `screens/{alert,auth,history,home,profile,response,training}/`, `services/`, `theme/`, `types/`, `utils/`.

## 3. Bugs found and fixed this session

Everything below was found and fixed in this session, in this order, each verified on an Android emulator before moving to the next.

### Fixed

**A. Partner signup — 100% failure rate (RLS violation)**
`useAuth.tsx`'s `signUp()` called `supabase.auth.signUp()` then immediately `supabase.from("partners").insert(...)` on the same client. This raced session establishment and, since the Supabase project requires email confirmation, couldn't work at all — there's no usable session at insert time, so `auth.uid()` is null and the `partners_insert_own` RLS policy (`auth.uid() = user_id`) always rejects it.
*Fix:* moved partner-row creation into a `SECURITY DEFINER` trigger on `auth.users` (`supabase/migrations/0008_partner_signup_trigger.sql`), fired via signup metadata (`options.data.app = "angel-partners"`, plus `full_name`/`phone`) so it can't misfire on Angel's rider accounts, which share the same `auth.users` table but never call `.signUp()`. The client no longer inserts into `partners` at all.
*Verified:* fresh signup with a real email completes with no error; DB confirms the `partners` row is created in the same instant as the `auth.users` row.

**B. Partner sign-in — appeared to hang forever on "Loading…"**
Root cause turned out to be the *same bug* as the pre-existing crash-ticket creation failure (see below), not a stalled network request. Diagnostic logging showed `usePartner()`'s query failing instantly, repeatedly, in a tight loop: `partners_select_by_ticket_rider` (an RLS policy on `partners`) subqueries `crash_tickets`, and `crash_tickets`' partner-facing policies subquery `partners` right back — Postgres error `42P17`, infinite recursion. The failure→retry cycle (via `TrainingScreen`, reached briefly on every failed attempt, also calling `usePartner()` and re-triggering `refetchOnMount`) repeated every ~1.2s indefinitely, which is what looked like a hang.
*Fix:* `supabase/migrations/0009_fix_partners_crash_tickets_rls_recursion.sql` — moved the `crash_tickets` lookup inside `partners_select_by_ticket_rider` into a `SECURITY DEFINER` function, which doesn't re-trigger RLS on the table it queries internally, breaking the cycle. This fixes the recursion for **both directions** (any policy touching either table).
*Also added regardless of root cause* (per explicit request): a 15s timeout on every Supabase request (`fetchWithTimeout` wrapper in `angel-partners/src/lib/supabase.ts`), and a timeout+retry UI on `RootNavigator`'s `LoadingScreen` (12s, then "taking longer than expected" + Retry button) so a genuinely stalled request can no longer strand the user with zero affordance.
*Verified:* sign-in now reaches Home in ~3s, stable across relaunches.

**C. Crash-ticket creation — silently failed 100% of the time (pre-existing, found during an earlier QA pass this session, same root cause as B)**
Every severity 2–5 crash from Angel attempted a `crash_tickets` insert that failed with the same `42P17` recursion, so the app silently fell back to the legacy mock `incidents`/`responders` path — Angel Partners never learned a crash happened, with no visible error to the rider. Fixed by the same migration 0009 above (confirmed directly with a manual insert against the real rider account).

**D. UI/visual bugs**
- Angel Home: "impact force" caption under the IMPACT stat was clipping to "impact for…" (`StatTile.tsx` — caption `Text` had `numberOfLines={1}` with no `adjustsFontSizeToFit`, unlike the value text right above it). Fixed to match the existing pattern.
- Angel Partners Home: "You're all set — go on duty to start receiving alerts." banner stayed visible and unchanged even after actually going on duty. Fixed to show duty-appropriate copy conditional on `is_active`.
- Skeleton loaders that appeared stuck on Angel Partners Home: **not an independent bug** — confirmed it was purely a symptom of `BYPASS_AUTH`'s mock partner (whose fake non-UUID id can't back real stat queries); resolves correctly under a real, working account.

**E. Tablet layout — phone-portrait UI stretched full-width on tablets**
Both apps lock `"orientation": "portrait"` in `app.json`, but Android's large-screen compatibility handling can override that specifically on tablets, leaving the single fixed-width phone-portrait column stretched edge-to-edge (e.g. a ~1900px-wide button with huge gaps) instead of any tablet-adapted layout. Fixed by capping and centering content above a 700px width breakpoint (560px max width) in the shared `ScreenBackground` component in **both** apps — both auth and home screens route through it, so this was a one-place fix per app. Verified on a Pixel Tablet emulator for both apps.

### Investigated but NOT fixed (flagged, not silently dropped)

- **Ghost/duplicate tab-bar text** ("Home"/"History") bleeding above the header on Angel Partners: investigated directly — it does not exist anywhere in the app's UI/accessibility tree and is static regardless of navigation state. This points to an emulator/compositor-level rendering artifact (this environment's system image renders via SwiftShader software GPU) rather than an app code bug. No code change was made for this; worth re-checking on real hardware or a different emulator before assuming it's real.
- **`BYPASS_AUTH = true`** (`angel-partners/src/config/devBypass.ts`): still shipping in the release build, exactly as found. This was temporarily flipped to `false` twice during this session purely to test the real auth path (which is how bugs A and B were found/verified), then restored to its original committed value both times. **Not fixed** — wasn't in the requested fix list this session, but it means the release build currently skips real login/approval entirely and renders against a hardcoded mock partner. Flagged as the top outstanding item if you want it addressed next.
- **Mock "nearest responder" fallback shows nonsensical distance/ETA** (observed during an earlier QA pass: "8663.5 km out, ETA 21659 min") — a symptom of bug C's fallback path being reached at all; now that C is fixed, this path should mostly stop being hit for real crashes, but the underlying lack of a sanity bound on the mock-responder distance calc was never addressed directly.

### ⚠️ Discrepancy with prior framing — Maps blank-screen issue

I was asked to document "the Maps blank screen issue (package name mismatch in Google Cloud Console vs actual app package)" as something found and fixed this session. **I have no record of investigating or fixing that in this session, and I did not verify a package-name mismatch in Google Cloud Console** (I have no access to Google Cloud Console at all). What I *can* confirm directly from the code, right now:

```
angel-partners/app.json → expo.android.config.googleMaps.apiKey = "REPLACE_WITH_GOOGLE_MAPS_API_KEY"
```

That's a literal unfilled placeholder — Google Maps (used on `ActiveResponseScreen`) will not render with this in place, which would present as a blank map. This is a real, verifiable, **currently unresolved** issue, but the specific "package name mismatch" diagnosis and any prior fix for it are not something I have evidence for in this session. Worth reconciling — either this was diagnosed/fixed in a different session I don't have context on, or the description doesn't match what's actually in the repo right now.

For reference, Angel's own Maps key (`AndroidManifest.xml`, `com.google.android.geo.API_KEY`) *is* filled in with a real-looking key — only Angel Partners has the placeholder.

## 4. Play Store release prep

**Not assessed this session** — no work was done on this, and I searched the repo for signs of prior progress: no `eas.json` in either repo, no privacy-policy file, no store-listing artifacts found. As far as this repo's contents show, release prep hasn't started. Known open items (generic, not verified against current state):

- Privacy Policy (required for the Play Console listing; not present in-repo)
- EAS production build config (`eas.json` doesn't exist in either repo currently — local Gradle release builds only)
- Permissions audit (both apps request location; Angel Partners requests background location + foreground service; worth a pass against Play's sensitive-permissions review before submission)
- `BYPASS_AUTH = true` (§3) should almost certainly be resolved before any release build ships
- Angel Partners' placeholder Maps API key (§3) needs a real key before the active-response map will work
- The two migrations added this session (0008, 0009) are applied to the **live** Supabase project already (via the Supabase MCP tool), not just written to the migrations folder — no separate deploy step needed for those.

## 5. Conventions / working style observed this session

- Wants a **fully verified fix before moving to the next item** in a numbered list — this was an explicit instruction ("don't move to the next one until the current one is verified working") and shaped the whole session's pacing.
- Wants root causes actually found, not just symptom-patched — explicitly asked to investigate *why* the sign-in query hung rather than only adding a timeout, and the timeout was framed as "regardless of root cause," i.e. a backstop, not a substitute for the real fix.
- Bug reports arrive pre-diagnosed with a specific technical hypothesis (e.g. "race condition... check whether signUp()'s returned session is usable immediately, or whether you need onAuthStateChange") — worth taking seriously as a starting point, but this session found the actual root cause differed from the initial hypothesis for the sign-in bug (it wasn't a hang at all), so verify rather than assume the stated hypothesis is complete.
- Wants a clear final summary: what changed per bug, and explicit confirmation each verification step passed.
- Wants git commits split by logical concern rather than one giant commit — when the working tree had both session work and unrelated pre-existing changes mixed together, splitting them into separate, accurately-described commits was the right call both times this came up.
- Prefers being told directly when something can't be verified or doesn't match rather than having gaps papered over — this doc's §3 discrepancy note and the Play Store section's "not assessed" framing follow that.

## 6. Open questions / pending decisions

1. **`BYPASS_AUTH`** — flip to `false` permanently (real auth now works end-to-end), or intentionally keep for ongoing dev convenience? Currently `true`.
2. **Maps API key** — needs a real Google Maps API key for Angel Partners (`app.json` → `expo.android.config.googleMaps.apiKey`); currently a placeholder. Also needs reconciling: was a "package name mismatch" already diagnosed/fixed elsewhere? Not evidenced in this repo/session.
3. **`website/` directory** (this repo) — 68 files under `website/` are deleted in the working tree, uncommitted, predating this session. User has said to leave it alone for now; still sitting there uncommitted.
4. **Ghost tab-bar text bug** — needs reproduction on real hardware or a different emulator/API image to confirm whether it's a real app bug or an artifact of this session's emulator environment, before spending code-fix effort on it.
5. **Mock responder ETA sanity bound** — not addressed; low priority now that the real `crash_tickets` path works, but still reachable if that insert ever fails again.
6. **Play Store release prep** — essentially unstarted; needs its own scoping pass (privacy policy, EAS config, permissions review, store listing assets).
