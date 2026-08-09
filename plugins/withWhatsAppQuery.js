const { withAndroidManifest } = require("@expo/config-plugins");

// Android 11+ (API 30+) package visibility means Linking.canOpenURL() can't
// see whether WhatsApp is actually installed unless the manifest declares a
// <queries> entry for its scheme — without this, canOpenURL("whatsapp://…")
// silently returns false even when WhatsApp is present, which would make
// GuardianOptInModal always fall back to the "WhatsApp not installed" copy
// path regardless of reality. See https://developer.android.com/training/package-visibility.
function withWhatsAppQuery(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    let queries = manifest.queries;
    if (!Array.isArray(queries)) queries = manifest.queries = [{}];
    const query = queries[0] ?? (queries[0] = {});

    let intents = query.intent;
    if (!Array.isArray(intents)) intents = query.intent = [];

    const alreadyPresent = intents.some((intent) =>
      (intent.data ?? []).some((d) => d.$?.["android:scheme"] === "whatsapp")
    );
    if (!alreadyPresent) {
      intents.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": "whatsapp" } }],
      });
    }

    return config;
  });
}

module.exports = withWhatsAppQuery;
