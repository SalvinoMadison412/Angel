const { withFinalizedMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// expo-location's own bundled AndroidManifest.xml unconditionally declares
// ACCESS_COARSE_LOCATION, and react-native-ble-plx's config plugin
// separately injects a `uses-permission-sdk-23` ACCESS_COARSE_LOCATION (it
// needs *some* location permission granted for BLE scan results on
// pre-Android-12 devices — ACCESS_FINE_LOCATION, which Angel already
// requests, satisfies that same OS check, so this doesn't weaken BLE
// scanning). A withAndroidManifest mod here isn't enough to remove either:
// ble-plx's addition happens inside its own withAndroidManifest mod, and
// mod execution order isn't plugin-list order — it's a fixed precedence
// (dangerous mods run FIRST, before the manifest is even written; ordinary
// manifest mods all run at the same precedence in registration order; ONLY
// a `finalized` mod is guaranteed to run after the manifest has been
// written to disk). So this uses withFinalizedMod and patches the
// already-written file directly. Angel only ever requests fine location
// (see requestLocationForegroundPermission) and wants the OS permission
// dialog to reflect that — with only ACCESS_FINE_LOCATION actually
// declared, Android has nothing to offer an "approximate" toggle for.
function withoutCoarseLocation(config) {
  return withFinalizedMod(config, [
    "android",
    (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/AndroidManifest.xml"
      );
      let contents = fs.readFileSync(manifestPath, "utf8");

      if (!contents.includes('xmlns:tools="http://schemas.android.com/tools"')) {
        contents = contents.replace(
          '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
          '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"'
        );
      }

      for (const tag of ["uses-permission", "uses-permission-sdk-23"]) {
        const selfClosing = new RegExp(
          `\\s*<${tag} android:name="android\\.permission\\.ACCESS_COARSE_LOCATION"[^>]*/>`,
          "g"
        );
        contents = contents.replace(selfClosing, "");
      }

      contents = contents.replace(
        "</manifest>",
        '  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" tools:node="remove"/>\n' +
          '  <uses-permission-sdk-23 android:name="android.permission.ACCESS_COARSE_LOCATION" tools:node="remove"/>\n</manifest>'
      );

      fs.writeFileSync(manifestPath, contents);
      return config;
    },
  ]);
}

module.exports = withoutCoarseLocation;
