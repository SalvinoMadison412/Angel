# Angel / Angel Partners — Pre-Release QA Report

**Date:** 2026-08-04
**Apps tested:** `Angel` (rider app, `com.angel.crashdetection`) and `Angel Partners` (responder app, `com.angel.partners`)
**Builds tested:** Local `app-release.apk` built from each repo's current working tree (Angel: built 2026-08-01; Angel Partners: rebuilt during this session from current source, see note on `devBypass.ts` below).
**Backend:** shared Supabase project `vqkwdwbzbwjplxqpqsuj` (live, migrations current as of 2026-08-04).
**Devices:** 3 Android emulators, all API level matching the single system image available in this environment (`android-37.1`, "Android 17.0"):
  - **Pixel 10** — standard phone, 1080×2424 — primary device, full functional + visual pass
  - **Small Phone** — 720×1280 — visual/layout spot-check
  - **Pixel Tablet** — 2560×1600 — visual/layout spot-check

## Scope note (read this first)

This was scoped down from the original ask in agreement with the user, for two structural reasons discovered at the start of the session:

1. **No dedicated Android automation tool was available.** Everything below was driven by hand through raw `adb`/`uiautomator` commands (screenshots + coordinate taps), not a purpose-built device-control tool. This is slower and less exhaustive than the iOS-simulator-equivalent tooling, so coverage is broad and representative rather than literally every sub-screen and every widget.
2. **Only one Android system image was available in this environment** (a single non-standard API level). The three emulators above give real device-*size* coverage (phone / small phone / tablet) but **not** multi-OS-version coverage (no Android 12/14/16 comparison was possible). Portrait/landscape testing is moot for these apps — both `app.json`s lock `orientation: "portrait"` — see Bug #6 for what actually happens on the tablet despite that lock.

Given what was found (four critical, ship-blocking backend/config bugs in the first hour of testing — see below), the majority of remaining session time went into root-causing those precisely rather than mechanically clicking through every remaining low-value screen (subscription plan picker, guardian add/edit form, training module reader, etc.). Those screens were **mapped but not individually clicked through** — see the "Not individually tested" list at the end.

---

## Bug list

### Category A — Functional / Broken flows (Critical)

#### 1. `angel-partners` ships with a hardcoded dev-bypass flag in the release build
- **App:** Angel Partners
- **Screen:** All (root navigation gate)
- **Severity:** Critical
- **File:** `src/config/devBypass.ts:9`
- **Description:** `export const BYPASS_AUTH = true;` is hardcoded in the file, with the code's own comment reading `// TODO: remove before production`. While true, `RootNavigator` skips SignIn/SignUp, Training, and PendingApproval entirely and renders the full app against a hardcoded `MOCK_PARTNER` (`id: "dev-partner-001"`, a non-UUID string). This was the state of the release APK as originally built for this session.
- **Consequence:** Anyone who installs the current release build lands directly in the main app as "Dev Partner" with no login, no training, no admin approval. It also breaks real ticket interactions — the mock partner's non-UUID id can't be used in any real Postgres query against `crash_tickets.accepted_by` (a `uuid` column), which the code itself works around by silencing those queries (see `usePartner.ts`, `useTickets.ts` comments).
- **Repro:** Install `angel-partners`'s current release APK fresh and launch it. No sign-in screen appears.
- **Screenshot:** [`bug_partners_devbypass_ghosttext.png`](qa_screenshots/bug_partners_devbypass_ghosttext.png) — first launch, straight to "Dev" / OFF DUTY home screen.

#### 2. Partner sign-up is completely broken — every attempt fails with an RLS error
- **App:** Angel Partners
- **Screen:** Sign Up
- **Severity:** Critical
- **Description:** Completing the real sign-up form (Full Name / Phone / Email / Password → SIGN UP) successfully creates the `auth.users` row (Supabase Auth account), but the very next step — inserting the corresponding `public.partners` row — fails with **`new row violates row-level security policy for table "partners"`**. The user is left with a real login that has no partner profile and can never proceed past this error.
- **Root cause (likely):** `useAuth.tsx`'s `signUp()` calls `supabase.auth.signUp()` immediately followed by `supabase.from("partners").insert(...)` on the same client. If the project has email confirmation behavior that delays session establishment even slightly, the insert runs unauthenticated (`auth.uid()` is null), which fails the `partners_insert_own` policy (`auth.uid() = user_id`).
- **Consequence:** **No new partner can ever sign up through the app as currently deployed.** This blocks the entire responder onboarding funnel.
- **Repro:** Fresh install → Sign Up → fill valid fields → submit. (Note: Supabase also rejects `@example.com` addresses as "invalid" — use a real deliverable domain when testing.)
- **Screenshot:** [`bug_partners_signup_rls_error.png`](qa_screenshots/bug_partners_signup_rls_error.png)
- **Evidence account created (orphaned, no partner row until manually fixed):** `auth.users.id = dffdf9dd-6bcb-4a60-a0ab-da676ff429ba`

#### 3. Signing in with a real, approved partner account hangs forever on "Loading…"
- **App:** Angel Partners
- **Screen:** Post-sign-in loading screen
- **Severity:** Critical
- **Description:** After working around Bug #2 (manually inserting a `partners` row for a test account via direct DB access), signing in with that real, approved (`is_approved = true`) account gets stuck on the app's generic `Loading…` screen **indefinitely**. Confirmed reproducible across **4 separate cold launches** with stable, verified network connectivity (ping and DNS both healthy throughout) and waits of up to 25 seconds each. The Angel app, running in parallel on the same device/network, remained fully responsive the entire time, ruling out a general environment/network problem.
- **Likely cause:** The `usePartner()` react-query call (`.from("partners").select("*").eq("user_id", userId).maybeSingle()`) appears to hang rather than reject, and neither `useQuery`'s `retry: 1` nor any UI-level timeout ever fires because a hung `fetch()` never resolves or rejects. There is no timeout/fallback affordance in `LoadingScreen` — if the initial fetch stalls for any reason, the user is stuck with no error, no retry button, and no way forward except force-closing the app.
- **Consequence:** **The real (non-bypass) sign-in path is unusable.** Combined with Bug #1 and Bug #2, every documented way of using this app as a real partner is currently broken.
- **Screenshot:** [`bug_partners_signin_stuck_loading.png`](qa_screenshots/bug_partners_signin_stuck_loading.png)

#### 4. Crash-ticket creation fails 100% of the time — infinite recursion in RLS policy (Postgres error 42P17)
- **App:** Angel (rider side), backend
- **Screen:** Crash Alert dispatch
- **Severity:** Critical — this is the core feature of the two-app product
- **Description:** Triggering any severity 2–5 crash (via Angel's own debug panel, simulating a real BLE crash signal) attempts to insert a row into `public.crash_tickets`. This **always fails** with:
  ```
  code: '42P17'
  message: 'infinite recursion detected in policy for relation "crash_tickets"'
  ```
  captured directly from the app's own console log (`[crash-ticket] failed to create ticket`).
- **Root cause (confirmed by inspecting `pg_policies`):** `public.partners` has a SELECT policy `partners_select_by_ticket_rider` whose condition subqueries `crash_tickets` (`EXISTS (SELECT 1 FROM crash_tickets ct WHERE ct.accepted_by = partners.id AND ct.rider_id = auth.uid())`). Several `crash_tickets` policies (`crash_tickets_select_open_for_partners`, `crash_tickets_accept_for_partners`, `crash_tickets_select_accepted_by_partner`) subquery `partners` right back. Postgres has to evaluate RLS on `partners` while evaluating RLS on `crash_tickets`, which re-triggers RLS on `crash_tickets`, forever — the classic circular-RLS-policy bug.
- **Consequence:** Because the insert fails, the app silently falls back to its legacy **mock-responder path** (`incidents`/`responders` tables) instead — the rider never sees a real ticket, and Angel Partners never learns a crash happened. **The entire advertised "creates a dispatch ticket for a real-world responder" flow is non-functional in production right now**, for every single crash, with no visible error surfaced to the rider (the fallback is seamless enough that a rider would have no idea their crash never reached a real partner).
- **Repro:** Angel app → Home tab → DEBUG panel → tap severity 3, 4, or 5 → SEND HELP NOW.
- **Screenshot of the resulting (broken) fallback state:** [`ticket_03b_check.png`](qa_screenshots/ticket_03b_check.png) — see Bug #5 for why this screen itself is also broken.

#### 5. Mock-fallback "nearest responder" shows nonsensical distance/ETA (8,663 km / 21,659 minutes)
- **App:** Angel
- **Screen:** `LiveIncidentScreen` (the fallback screen reached via Bug #4)
- **Severity:** Major
- **Description:** When the app falls back to the mock `responders` table (because of Bug #4), the "nearest" responder returned is **Fahad K., 8663.5 km out, ETA 21659 min** (~15 days). There is no sanity bound, distance cap, or fallback message for "no responders nearby" — it just displays whatever the haversine calculation produces against the seed data, however absurd.
- **Repro:** Trigger a severity 3+ crash from Angel's debug panel and let it fall through to the mock flow (currently happens every time, see Bug #4).
- **Screenshot:** [`ticket_03b_check.png`](qa_screenshots/ticket_03b_check.png)

#### 6. New open tickets never trigger the partner-side alert (`TicketAlertScreen`) even for an on-duty partner
- **App:** Angel Partners
- **Screen:** Home (on-duty) → expected `TicketAlertScreen`
- **Severity:** Critical
- **Description:** With a partner toggled ON DUTY, and a fresh `crash_tickets` row inserted directly (`status: 'open'`) to bypass Bug #4's broken insert, the full-screen ticket alert modal never appeared — not after 3 seconds, not after 8 more seconds of additional waiting. This is consistent with the same infinite-recursion RLS bug (Bug #4) also blocking the Realtime subscription's authorization check on `crash_tickets` SELECT (Supabase Realtime enforces the same RLS policies used for direct queries), though this wasn't independently confirmed with a Postgres-side trace.
- **Consequence:** Even if Bug #4 is fixed enough for ticket rows to be created, on-duty partners still may not be alerted in real time.
- **Screenshots:** [`ticket_partner_03_onduty.png`](qa_screenshots/ticket_partner_03_onduty.png) (on duty, waiting), [`ticket_partner_04b_wait.png`](qa_screenshots/ticket_partner_04b_wait.png) (8+ seconds after a fresh open ticket was inserted, still no alert)

---

### Category B — UI / Visual bugs

#### 7. Ghost/duplicate tab-bar text bleeds above the header on Angel Partners
- **App:** Angel Partners
- **Screen:** Home, History (seen on both)
- **Severity:** Minor
- **Description:** Faint, overlapping text reading "Home" / "History" renders just above the status bar / app header, behind the real header content. Looks like a leftover tab-bar label from a previous screen not fully unmounting/clipping during transition.
- **Screenshot:** [`bug_partners_devbypass_ghosttext.png`](qa_screenshots/bug_partners_devbypass_ghosttext.png), also visible in [`ticket_partner_01_offduty.png`](qa_screenshots/ticket_partner_01_offduty.png)

#### 8. "impact for…" label is truncated on Angel's Home screen
- **App:** Angel
- **Screen:** Home tab, telemetry card
- **Severity:** Minor
- **Description:** The caption under the IMPACT stat is source-coded as `"impact force"` (`HomeScreen.tsx:124`) but renders clipped with an ellipsis as **"impact for…"** at default font scale — the container is too narrow for the full caption.
- **Screenshot:** [`angel_device_tab.png`](qa_screenshots/angel_device_tab.png) shows the same card family; see also the Home screenshots in the ticket walkthrough section below.

#### 9. "You're all set — go on duty…" helper banner doesn't update once already on duty
- **App:** Angel Partners
- **Screen:** Home
- **Severity:** Minor (copy bug)
- **Description:** The card reading "You're all set — go on duty to start receiving alerts." remains visible and unchanged even after the partner successfully goes ON DUTY, where it no longer makes sense.
- **Screenshot:** [`ticket_partner_03_onduty.png`](qa_screenshots/ticket_partner_03_onduty.png)

#### 10. Angel Partners Home shows lingering empty skeleton loaders
- **App:** Angel Partners
- **Screen:** Home
- **Severity:** Minor
- **Description:** Two grey rounded skeleton placeholders below the duty card never resolve into content or disappear (observed under the dev-bypass mock partner, whose id can't back real stat queries per the code's own comments — likely a direct consequence of Bug #1 rather than an independent bug, but worth a look under a real account once Bugs #2/#3 are fixed).
- **Screenshot:** [`ticket_partner_01_offduty.png`](qa_screenshots/ticket_partner_01_offduty.png)

---

### Category C — Responsive / Device-specific bugs

#### 11. Tablet layout: portrait orientation lock is not honored; phone UI stretches full-width instead of adapting
- **App:** Both Angel and Angel Partners
- **Screen:** All (seen on Sign-in/Home)
- **Severity:** Major
- **Description:** Both apps declare `"orientation": "portrait"` in `app.json`, which should lock the activity to portrait regardless of device. On the Pixel Tablet emulator (2560×1600), both apps instead rendered in **landscape**, with the same fixed phone-style vertical form layout simply stretched to fill the full width — producing a ~1900px-wide "GO ON DUTY" / "SEND OTP" button and large, awkward gaps rather than any tablet-adapted layout. This is consistent with Android 12+'s large-screen compatibility behavior, which can override an app's declared fixed orientation specifically on tablets; the app has no large-screen layout to fall back on when that happens.
- **Screenshots:** [`tablet_angel_home2.png`](qa_screenshots/tablet_angel_home2.png), [`tablet_partners_home.png`](qa_screenshots/tablet_partners_home.png)

#### 12. (Informational — not a bug) Small phone and standard phone render cleanly
- No clipping, overlap, or scaling issues were found on the 720×1280 small-phone profile for the screens checked (Angel sign-in, Angel Partners sign-in) — included here for completeness since the user asked for explicit small-phone coverage.
- **Screenshots:** [`smallphone_angel_home.png`](qa_screenshots/smallphone_angel_home.png), [`smallphone_partners_home.png`](qa_screenshots/smallphone_partners_home.png)

---

## Side-by-side test ticket walkthrough

Per the request, one crash ticket was walked through end-to-end on both apps, with dummy data. **Because of Bug #4 (the RLS recursion bug), the real cross-app flow cannot complete on its own** — what follows shows both (a) what actually happens today, and (b) what the intended flow looks like, reconstructed via direct database inserts that bypass RLS (the same access level a service role has), clearly marked.

| Stage | Angel (rider side) | Angel Partners (responder side) |
|---|---|---|
| **1. Crash detected, countdown running** | Severity 3 "HARD IMPACT" simulated from the debug panel; 10s countdown, live sensor readings shown. [`ticket_01_crash_alert_countdown.png`](qa_screenshots/ticket_01_crash_alert_countdown.png) | N/A yet — ticket doesn't exist until dispatch |
| **2. Dispatch triggered ("SEND HELP NOW")** | Countdown hits 0, dispatch spinner shown. [`ticket_02_dispatching.png`](qa_screenshots/ticket_02_dispatching.png) | — |
| **3a. What *actually* happens today** | Falls back to the mock flow: **Incident #A6F6, "Fahad K.", 8663.5 km out, ETA 21659 min.** No real ticket was ever created (`crash_tickets` insert failed — Bug #4). [`ticket_03b_check.png`](qa_screenshots/ticket_03b_check.png) | Never learns of the crash at all — no ticket exists to alert on, and even a manually-inserted open ticket didn't trigger an alert while on duty (Bug #6). [`ticket_partner_04b_wait.png`](qa_screenshots/ticket_partner_04b_wait.png) |
| **3b. What the intended flow looks like (ticket manually inserted via direct DB access to bypass Bug #4)** | *(`ActiveTicketScreen` could not be captured live — reaching it requires the app's own successful insert, which is what's broken; based on code review it would show "WAITING FOR A PARTNER" with a live map, matching the design in `ActiveTicketScreen.tsx`.)* | Went **ON DUTY** successfully via the dev-bypass mock partner. [`ticket_partner_03_onduty.png`](qa_screenshots/ticket_partner_03_onduty.png) A fresh `status: 'open'` ticket was inserted directly into the DB while on duty to test the real-time alert — **it never fired** (Bug #6), so `TicketAlertScreen`, `ActiveResponseScreen`, and the accept flow could not be exercised live either. |

**Bottom line:** the two apps cannot currently complete a real ticket handoff in either direction. Everything downstream of ticket creation/alerting (accept, active-response map, call rider, mark safe, history) is code-complete per the source (see the navigation map delivered earlier in this session) but **untestable live** until Bugs #4 and #6 are fixed.

---

## What was and wasn't covered

**Covered:** Angel's Home/Device/Guardians/Profile tabs, full crash-alert → dispatch flow (severity 3), Angel Partners' real Sign In/Sign Up, dev-bypass Home/duty-toggle, small-phone and tablet visual spot-checks of both apps' entry screens, backend schema/RLS/migration state.

**Mapped (via source review) but not individually clicked through this session** — no bugs assumed, just not manually verified on-device: Angel's onboarding wizard, device pairing/calibration flow, guardian add/edit form, subscription plan picker, severity-1 emergency countdown/guardian-SMS path, the debug BLE diagnostic screen; Angel Partners' Training/ModuleReader/PendingApproval screens (unreachable while `BYPASS_AUTH=true`, and the real path is blocked by Bugs #2/#3), History/HistoryDetail, Profile's inline training expansion, ActiveResponseScreen, TicketAlertScreen's decline/race-condition states.

**Not tested:** multiple Android OS/API-level coverage (only one system image was available in this environment — see Scope note above).

## Housekeeping note

`angel-partners/src/config/devBypass.ts` was temporarily toggled `false` mid-session to test the real auth path (which is how Bugs #2 and #3 were found), then restored to its original `true` value afterward. This change was never committed. Two test accounts and two test `crash_tickets` rows were created directly in the shared Supabase project for this testing — all clearly labeled (`QA Test Partner`, `salvinokevin7+qapartner1@gmail.com`, etc.) and safe to delete.
