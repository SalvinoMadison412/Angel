# Firebase Phone Auth setup (India phone login)

Angel's phone login now goes through Firebase Phone Auth (reliable OTP
delivery to Indian numbers) instead of Supabase's built-in phone provider.
Firebase issues the OTP and an ID token; the app exchanges that ID token for
a real Supabase session. None of this works until you complete the manual
steps below — there is no way to script Firebase console / Supabase
dashboard setup from this repo.

## 1. Create/select a Firebase project

1. https://console.firebase.google.com → create a project (or reuse one).
2. Add an Android app with package name **`com.angel.crashdetection`**
   (must match `app.json`'s `expo.android.package` exactly).
3. Download the generated `google-services.json`.
4. Copy it to the repo root as `google-services.json` (same folder as
   `app.json`) — replacing `google-services.json.example`. This file is
   gitignored; every dev/CI machine needs its own copy.
5. Authentication → Sign-in method → enable **Phone**.
6. Authentication → Settings → add your test device / SHA-1 fingerprint if
   you hit reCAPTCHA/Play Integrity issues in dev builds (release builds
   using Play Integrity generally don't need this).

## 2. Turn on Supabase's Firebase third-party auth integration

Supabase needs to trust Firebase-issued ID tokens before
`supabase.auth.signInWithIdToken({ provider: 'firebase', ... })` will work.

1. Supabase Dashboard → project `vqkwdwbzbwjplxqpqsuj` → Authentication →
   Sign In / Providers → **Third Party Auth**.
2. Add integration → **Firebase Auth** → paste your Firebase **Project ID**
   (not the project number).
3. Save.

Until this is done, `signInWithIdToken` will fail with an "issuer not
trusted" style error even though the Firebase side is fully working.

## 3. Rebuild the native app

Firebase requires native modules — this cannot run in Expo Go.

```bash
npx expo prebuild --platform android --clean
npx expo run:android
```

## 4. What changed in code

- `src/lib/firebase.ts` — thin wrapper around `@react-native-firebase/auth`.
- `src/hooks/useAuth.tsx` — `sendOtp`/`verifyOtp` now call Firebase
  (`signInWithPhoneNumber` / `confirm`), then exchange the resulting
  Firebase ID token for a Supabase session via `signInWithIdToken`.
- `PhoneEntryScreen` / `OtpScreen` — UI unchanged, only what's underneath
  `sendOtp`/`verifyOtp` changed.
- Google OAuth (`src/lib/oauth.ts`) — untouched, still goes straight through
  Supabase.

### Note on the "nonce" requirement

The original spec asked for a nonce to be passed alongside the ID token.
Nonce-based replay protection is for flows where *your app* generates the
nonce, hashes it into the auth request, and gets it echoed back inside the
ID token (Sign in with Apple / Google id_token flow). Firebase's phone-auth
`ConfirmationResult.confirm()` doesn't expose a way to inject a custom nonce
claim into the token it returns, so there's nothing to pass — Supabase's
Firebase third-party integration instead verifies the token's signature
against Firebase's JWKS and checks `aud` against the Firebase Project ID
configured in step 2. No nonce param is sent; this is expected, not a
shortcut.
