// Dynamic config layered on top of app.json — app.json stays in place and
// supplies the static base (icon, splash, permissions, existing plugins,
// etc.); Expo passes its contents in as `config` here. Do NOT delete/rename
// app.json — without it `config` would only be inferred from package.json,
// silently dropping everything below.
//
// This file exists solely to inject the Android Google Maps SDK key from an
// env var at prebuild time (process.env only resolves correctly here, in
// Node/build-time code — writing process.env.X directly into app.json would
// bake the literal string "process.env.X" into AndroidManifest.xml).
import "dotenv/config";

// Twilio WhatsApp sandbox opt-in (Section 5 of the privacy/security pass):
// EXPO_PUBLIC_TWILIO_WHATSAPP_NUMBER and EXPO_PUBLIC_TWILIO_JOIN_MESSAGE
// need no wiring here — unlike GOOGLE_MAPS_API_KEY below, which has to be
// injected into native Android config at prebuild time, anything with the
// EXPO_PUBLIC_ prefix is already inlined directly into the JS bundle by
// Expo's build tooling (see src/lib/supabase.ts reading
// EXPO_PUBLIC_SUPABASE_URL the same way, with no app.config.js involvement
// either) — GuardianFormScreen/GuardiansScreen just read
// process.env.EXPO_PUBLIC_TWILIO_WHATSAPP_NUMBER directly.
//
// TWILIO_AUTH_TOKEN deliberately does NOT appear anywhere in this file. It
// is read only inside supabase/functions/twilio-status-webhook (a Deno
// process on Supabase's infrastructure, not this Node build step or the RN
// bundle) via a Supabase Edge Function secret. If a future change ever adds
// `process.env.TWILIO_AUTH_TOKEN` to this file, that is a bug — it would
// either bake the token into a build artifact or crash the build (this file
// runs in Node at prebuild time, has no access to Supabase secrets, and
// dotenv/config only loads this project's own .env, which — see
// .env.example — is documented to never carry a real value client code
// could read).
export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    ],
  ],
});
