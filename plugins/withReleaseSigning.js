const { withAppBuildGradle, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Wires android/app/build.gradle's `release` build type to a real upload
// keystore instead of the RN template's debug-keystore default. The
// keystore itself lives outside android/ (which `expo prebuild` regenerates
// from scratch and is gitignored) at <project root>/keystores/ — this
// plugin copies it in and rewrites the signing block on every prebuild so
// the wiring survives a clean regeneration.
//
// keystores/keystore.properties (gitignored, never commit) supplies
// storeFile/storePassword/keyAlias/keyPassword. If it's missing, this
// plugin is a no-op and the release build falls back to the debug keystore
// exactly as before, so a fresh clone without the keystore still builds.
function withReleaseSigning(config) {
  config = withDangerousMod(config, [
    "android",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const keystoreDir = path.join(projectRoot, "keystores");
      const propsPath = path.join(keystoreDir, "keystore.properties");
      if (!fs.existsSync(propsPath)) return config;

      const props = Object.fromEntries(
        fs
          .readFileSync(propsPath, "utf8")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
          .map((line) => {
            const idx = line.indexOf("=");
            return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
          })
      );

      const srcKeystore = path.join(keystoreDir, props.storeFile);
      const destDir = path.join(config.modRequest.platformProjectRoot, "app");
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcKeystore, path.join(destDir, props.storeFile));

      return config;
    },
  ]);

  return withAppBuildGradle(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const propsPath = path.join(projectRoot, "keystores", "keystore.properties");
    if (!fs.existsSync(propsPath)) return config;

    const props = Object.fromEntries(
      fs
        .readFileSync(propsPath, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const idx = line.indexOf("=");
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        })
    );

    let contents = config.modResults.contents;

    const releaseSigningBlock = `        release {
            storeFile file('${props.storeFile}')
            storePassword '${props.storePassword}'
            keyAlias '${props.keyAlias}'
            keyPassword '${props.keyPassword}'
        }`;

    // Insert the `release` signingConfig alongside the existing `debug` one.
    contents = contents.replace(
      /signingConfigs\s*\{([\s\S]*?)\n {4}\}/,
      (match, inner) => `signingConfigs {${inner}\n${releaseSigningBlock}\n    }`
    );

    // Point buildTypes.release at it instead of the debug config — anchored
    // on the enableShrinkResources line right after, which only appears in
    // the release block, so this can't accidentally also match debug's.
    contents = contents.replace(
      /signingConfig signingConfigs\.debug(\s*\n\s*def enableShrinkResources)/,
      "signingConfig signingConfigs.release$1"
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withReleaseSigning;
