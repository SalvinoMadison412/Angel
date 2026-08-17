# Angel — Google Play Submission Reference

Consolidated technical reference for filling out the Play Console listing, data safety form, and content rating questionnaire. Compiled from the actual app config and source — not from Play Console itself, since none of these forms are filled in yet as of this writing. Sections marked **⚠ needs your input** are business/judgment decisions I can't make for you.

**Last verified against repo:** 2026-08-17

---

## 1. App identity

| Field | Value | Source |
|---|---|---|
| App name | Angel | [app.json](app.json) |
| Package / applicationId | `com.angel.crashdetection` | [android/app/build.gradle:90-92](android/app/build.gradle) |
| Slug | `angel-crash-detection` | [app.json](app.json) |
| Version name | 1.0.0 | [android/app/build.gradle:96](android/app/build.gradle) |
| Version code | 1 | [android/app/build.gradle:95](android/app/build.gradle) |
| Platform | **Android only** — no iOS target, no `ios/` directory | [README.md](README.md) |
| JS engine | Hermes, New Architecture enabled | [android/gradle.properties](android/gradle.properties) |

## 2. What the app does (for the listing / reviewer notes)

Angel pairs over Bluetooth Low Energy with a wearable crash-sensor device (custom ESP32 + accelerometer/gyroscope, see [firmware/](firmware/)). The sensor detects a possible crash and pushes a BLE notification to the phone. The app then runs a cancel-countdown; if not cancelled, it captures the rider's location and automatically alerts the rider's stored emergency contacts ("guardians") by WhatsApp message and automated phone call (via Twilio), and — depending on crash severity — opens a dispatch ticket that a trained responder in the companion **Angel Partners** app can accept and navigate to.

This app is one half of a two-app platform sharing one Supabase backend; Angel Partners (`com.angel.partners`) is a separate submission, not covered by this document.

## 3. SDK / build target

| Field | Value | Source |
|---|---|---|
| Target SDK | **35** (Android 15) — resolved default, no override in this repo | `expo-modules-autolinking` `ExpoRootProjectPlugin.kt`, no `libs.versions.toml` override found |
| Min SDK | **24** (Android 7.0) — resolved default, no override | same plugin default |
| Compile SDK | **35** — resolved default, no override | same plugin default |
| Expo SDK | ~57.0.8 | [package.json](package.json) |
| React Native | 0.86.0 | [package.json](package.json) |

⚠ **Confirm against the actual signed AAB before submitting** — these are plugin defaults traced through source, not read off a built artifact. Play Console will show you the resolved target SDK on the release page; if it doesn't say 35, something in the build pipeline is overriding it.

Play's current requirement (as of 2026) is that new apps/updates target the SDK version for the latest major Android release or one version behind — 35 should be compliant, but check Play Console's "release readiness" warnings on your first upload, since this policy floor moves roughly once a year.

## 4. Permissions requested (from the built manifest)

Pulled from [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml) after `expo prebuild`:

| Permission | Why it's requested |
|---|---|
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Attach rider location to a crash alert |
| `ACCESS_BACKGROUND_LOCATION` | Keep an accurate location fix if a crash happens while the phone is locked — see §6, this is **not yet reflected in the privacy policy** |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | Support the background location watch above |
| `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` | Pair with and read data from the wearable crash sensor |
| `POST_NOTIFICATIONS` | Local alert to the rider if a crash is detected while backgrounded |
| `VIBRATE` | Haptic feedback (crash alert / countdown) |
| `INTERNET` | Supabase/Twilio network calls |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` (maxSdk 32 only, legacy) | Pre-Android-13 photo picker compatibility |
| `CAMERA`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` | **Explicitly removed** (`tools:node="remove"`) — pulled in transitively by a dependency but stripped because the app doesn't use them. Worth calling out in "App content" if Play's automated scan flags a dependency that still references them. |

This list should map directly onto the **Data safety** form's "does your app collect X" checkboxes — location (precise, background) and Bluetooth device data are the two categories most likely to need justification text in the form.

## 5. Content rating & target audience ⚠ needs your input

Nothing in the repo commits you to an answer here — the content-rating questionnaire and Target Audience section are filled in live in Play Console, not stored in app config. What the app's actual behavior supports:

- No user-generated content, no chat, no ads, no in-app purchases, no gambling-adjacent mechanics
- Collects real emergency contact info, precise/background location, and (optionally) medical data (blood group, conditions) — this is a **health/safety-adjacent, real-world-emergency-dispatch app**, not general-audience entertainment
- [PRIVACY_POLICY.md:61](PRIVACY_POLICY.md) already states "not directed at children under 13"

Given that, a "children" or "young teens" Target Audience selection would misrepresent the app — but the exact minimum age (16+, 18+, etc.) and IARC questionnaire answers are yours to set. Happy to draft answers to the actual IARC question list if you paste them in.

## 6. Privacy policy status ⚠ action needed

Policy exists at [PRIVACY_POLICY.md](PRIVACY_POLICY.md) / [privacy-policy.html](privacy-policy.html) / [PRIVACY_POLICY.docx](PRIVACY_POLICY.docx), last dated 2026-08-10. **One confirmed inconsistency that will likely fail Play's data-safety cross-check:**

> The policy states *"Foreground GPS location is captured at the moment a crash alert is triggered... We do not track or store your location at any other time."*
> But the app requests `ACCESS_BACKGROUND_LOCATION` and the `expo-location` plugin config in [app.json](app.json) says: *"Angel needs to keep watching your location in the background so a crash that happens while your phone is locked still gets an accurate location attached."*

This needs to be fixed in the policy before submission — Play's review explicitly checks that background location use is disclosed. Not yet fixed as of this document.

Also confirm: is `privacy-policy.html` hosted somewhere public? Play Console requires a live URL, not a bundled file — I don't have visibility into whether this HTML file is deployed anywhere.

## 7. Store listing assets

| Asset | Status |
|---|---|
| App icon | Exists — [assets/icon.png](assets/icon.png), adaptive icon layers present |
| Feature graphic (1024×500) | **Not found anywhere in the repo** — needs to be created, this is a Play-only asset |
| Screenshots (≥2 required) | [qa_screenshots/](qa_screenshots/) has real in-app captures across phone and tablet sizes, but they're QA-labeled (e.g. `bug_partners_signin_stuck_loading.png`), not curated for the store — pick/relabel a clean subset before upload |
| Short description | Not written anywhere in the repo |
| Full description | Not written anywhere in the repo |
| AI-generated content disclosure | Unknown — not something derivable from the repo, this is about how you produced the assets |

## 8. Category & deceptive-behavior check

- No category selection stored in the repo (Play Console dropdown, not app config) ⚠ needs your input
- Source/docs grep shows no references to competitor apps, other platforms, or Apple/iOS branding — app is Android-only by design, nothing to flag here

## 9. Reviewer access ⚠ action needed

Angel's rider login is **phone OTP or Google OAuth only** — no email/password path exists in this app (Angel Partners is separate and does use email/password). There is currently no standing demo account: the only test accounts on record ([angel_qa_report.md:52,162](angel_qa_report.md)) were ad hoc Supabase rows for Partners QA, explicitly marked safe-to-delete, not meant for Play review.

Since a reviewer can't complete a live OTP or OAuth flow blind, pick one before submitting:
1. Supply a real phone number in the "App access" instructions the reviewer can receive an OTP on, or
2. Submit a walkthrough video of login → crash detection → guardian alert (more typical for OTP-only apps)

## 10. Backend / third-party data processors

For the Data safety form's "third parties" section:

| Service | Data shared | Purpose |
|---|---|---|
| Supabase | Account, profile, location, sensor/incident records, guardian info | Database, auth, storage, backend functions |
| Twilio | Guardian name/phone, alert message + Google Maps link | WhatsApp message + automated call to guardians on unconfirmed crash |
| Google | Name/email (if Google Sign-In used) | Optional auth provider |

Full breakdown already written in [PRIVACY_POLICY.md](PRIVACY_POLICY.md) §"Third parties" — this table is just the Play-form-shaped summary of the same facts.

---

## Open items before submission

1. Fix background-location disclosure in privacy policy (§6)
2. Confirm privacy policy is hosted at a public URL
3. Create feature graphic (1024×500)
4. Curate ≥2 real store screenshots from [qa_screenshots/](qa_screenshots/) or capture fresh ones
5. Write short + full store description
6. Decide reviewer access plan (real OTP number vs. demo video)
7. Confirm target SDK 35 against the actual built AAB, not just plugin defaults
8. Fill in Play Console: category, content rating questionnaire, target audience
