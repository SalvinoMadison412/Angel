const { withAndroidManifest } = require("@expo/config-plugins");

// SYSTEM_ALERT_WINDOW ("draw over other apps") gets pulled into the merged
// manifest by an autolinked dependency's own AndroidManifest.xml, even
// though nothing in this app calls Settings.canDrawOverlays or uses any
// overlay UI. It's a sensitive permission Play Console flags for review, so
// strip it explicitly rather than ship it unused.
function withoutSystemAlertWindow(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    let permissions = manifest["uses-permission"];
    if (!Array.isArray(permissions)) permissions = manifest["uses-permission"] = [];

    // Drop our own copy (if any config/plugin already added one) and add a
    // tools:node="remove" entry — that's what actually wins against an
    // autolinked library's own AndroidManifest.xml re-adding it during
    // Gradle's manifest merge; simply omitting/filtering the entry here
    // would not by itself override a library-declared permission.
    permissions = permissions.filter((perm) => perm.$["android:name"] !== "android.permission.SYSTEM_ALERT_WINDOW");
    permissions.push({
      $: {
        "android:name": "android.permission.SYSTEM_ALERT_WINDOW",
        "tools:node": "remove",
      },
    });
    manifest["uses-permission"] = permissions;

    return config;
  });
}

module.exports = withoutSystemAlertWindow;
