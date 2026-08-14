import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import React, { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton } from "../../components";
import { refreshLocationPermissionStatus } from "../../services/location/locationTracking";
import { colors, spacing, type } from "../../theme";

// Same key OnboardingScreen used to write directly before this screen
// existed — kept so a resumed onboarding session (or anything else reading
// it later) still finds the status under the name it always has.
const LOCATION_PERMISSION_STATUS_KEY = "onboardingLocationPermissionStatus";

interface Props {
  onContinue: () => void;
}

/**
 * Shown once, right before the OS location dialog — the bare system prompt
 * gives no reason, and "why is a crash app asking for my location" is
 * exactly the kind of thing that gets a rider to tap Deny. First step of
 * onboarding on purpose — location is core to what this app does, so a
 * rider should decide on it before investing time in the rest of setup.
 *
 * Foreground-only, deliberately: Angel does not request "Always"/background
 * location. Crash detection itself only runs while the app is foregrounded
 * (react-native-ble-plx's isBackgroundEnabled is off, and there's no
 * TaskManager background location task), so a background grant would do
 * nothing but sit on the rider's device — and both app stores expect a
 * background-location request to come with an actual background use, not
 * just a "just in case." Revisit this (and this screen) together if
 * background crash detection ever ships.
 *
 * On grant: also checks whether the OS granted Precise vs Approximate
 * accuracy (Android 12+ / iOS 14+ both let a user pick) and nudges toward
 * Settings if not, since Approximate isn't accurate enough to actually find
 * someone after a crash. Then starts the live position watch (see
 * locationTracking.ts) so crash detection has a cached fix instantly
 * instead of waiting on a fresh one.
 *
 * On denial: does NOT silently continue — shows a blocking explanation
 * with a path to Settings, since "why is a crash app asking for my
 * location" unanswered is exactly what produces the accidental Deny this
 * screen exists to prevent. "Continue anyway" is still available (this
 * can't be a hard gate — a rider must be able to use the rest of the app),
 * but leaves the permission denied, which useLocationPermission's
 * subscribers (the Home screen warning banner) reflect afterward.
 */
export function LocationPermissionScreen({ onContinue }: Props) {
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);
  const [imprecise, setImprecise] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      await SecureStore.setItemAsync(LOCATION_PERMISSION_STATUS_KEY, result.status);

      if (result.status === "granted") {
        const isImprecise = result.android?.accuracy === "coarse" || result.ios?.accuracy === "reduced";
        await refreshLocationPermissionStatus();
        if (isImprecise) {
          setImprecise(true);
        } else {
          onContinue();
        }
      } else {
        setDenied(true);
      }
    } catch (err) {
      console.warn("[onboarding] failed to request location permission", err);
      setDenied(true);
    } finally {
      setRequesting(false);
    }
  };

  const handleContinueAnyway = () => {
    // Leaves status as denied — refreshLocationPermissionStatus (called on
    // every app foreground, see RootNavigator) picks it up from here on,
    // and the Home screen banner reflects it.
    onContinue();
  };

  if (denied) {
    return (
      <View style={styles.stepBody}>
        <Text style={[type.title, styles.heading]}>Location is off</Text>
        <Text style={[type.body, styles.copy]}>
          Angel needs your precise location to send your exact position to guardians in a crash emergency. Without
          this, we can't tell them where you are.
        </Text>

        <PillButton title="OPEN SETTINGS" onPress={() => Linking.openSettings()} style={styles.cta} />
        <Text style={styles.skipLink} onPress={handleContinueAnyway}>
          Continue anyway
        </Text>
      </View>
    );
  }

  if (imprecise) {
    return (
      <View style={styles.stepBody}>
        <Text style={[type.title, styles.heading]}>Precise location is off</Text>
        <Text style={[type.body, styles.copy]}>
          Angel only has your approximate location — that's not accurate enough for guardians to actually find you
          after a crash. Turn on Precise Location for Angel in Settings.
        </Text>

        <PillButton title="OPEN SETTINGS" onPress={() => Linking.openSettings()} style={styles.cta} />
        <Text style={styles.skipLink} onPress={onContinue}>
          Continue anyway
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stepBody}>
      <Text style={[type.title, styles.heading]}>Share your location</Text>
      <Text style={[type.body, styles.copy]}>
        Angel needs your precise location to send your exact position to guardians in a crash emergency — it's how
        they find you.
      </Text>

      <GlassCard accentBorder>
        <Text style={[type.kicker, styles.accentText]}>WHY WE ASK</Text>
        <Text style={[type.bodySmall, styles.copy, styles.consentCopy]}>
          Location is only captured at the moment of a confirmed crash alert — Angel never tracks or stores your
          location otherwise. When the system prompt appears, choose "Precise" (or "Always Allow Precise Location")
          so guardians get your exact position, not just your general area.
        </Text>
      </GlassCard>

      <PillButton title="ENABLE LOCATION" onPress={handleEnable} loading={requesting} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  stepBody: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  heading: { color: colors.text },
  copy: { color: colors.textMuted },
  consentCopy: { marginTop: spacing.md },
  accentText: { color: colors.accent },
  cta: { marginTop: spacing.sm },
  skipLink: { color: colors.textDim, textAlign: "center", ...type.bodySmall },
});
