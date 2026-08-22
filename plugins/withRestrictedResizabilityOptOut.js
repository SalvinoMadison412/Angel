const { withAndroidManifest } = require("@expo/config-plugins");

// Android 16 (API 36) ignores orientation/resizability/aspect-ratio locks on
// large screens (foldables, tablets, >=600dp) — Play Console flags this as a
// warning for any app that locks orientation, which Angel does deliberately
// (it's read while mounted on a motorcycle; rotating mid-ride is undesirable,
// not a missing feature). This adds Android's own documented temporary
// opt-out property so the phone-only portrait lock keeps working everywhere,
// including large screens, instead of undertaking a landscape/tablet
// redesign this app doesn't need. The opt-out stops applying once targeting
// API 37 — revisit orientation handling before that upgrade.
function withRestrictedResizabilityOptOut(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];

    let properties = application.property;
    if (!Array.isArray(properties)) properties = application.property = [];

    properties = properties.filter(
      (prop) => prop.$["android:name"] !== "android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY"
    );
    properties.push({
      $: {
        "android:name": "android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY",
        "android:value": "true",
      },
    });
    application.property = properties;

    return config;
  });
}

module.exports = withRestrictedResizabilityOptOut;
