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
