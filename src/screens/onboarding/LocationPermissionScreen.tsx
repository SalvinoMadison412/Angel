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
 * exactly the kind of thing that gets a rider to tap Deny.
 *
 * On grant: also requests background permission (so a crash alert can
 * still attach a location if the app isn't foregrounded) and starts the
 * live position watch (see locationTracking.ts) so crash detection has a
 * cached fix instantly instead of waiting on a fresh one.
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

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      await SecureStore.setItemAsync(LOCATION_PERMISSION_STATUS_KEY, status);

      if (status === "granted") {
        // Best-effort — a rider who grants foreground but declines
        // background still gets everything the foreground grant enables;
        // this only adds coverage for a crash while backgrounded.
        try {
          await Location.requestBackgroundPermissionsAsync();
        } catch (err) {
          console.warn("[onboarding] failed to request background location permission", err);
        }
        await refreshLocationPermissionStatus();
        onContinue();
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
          Angel needs your location to send it to your guardians if you're in a crash. Without this, we can't tell
          them where you are.
        </Text>

        <PillButton title="OPEN SETTINGS" onPress={() => Linking.openSettings()} style={styles.cta} />
        <Text style={styles.skipLink} onPress={handleContinueAnyway}>
          Continue anyway
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stepBody}>
      <Text style={[type.title, styles.heading]}>Share your location</Text>
      <Text style={[type.body, styles.copy]}>
        When a crash is confirmed, Angel attaches your GPS coordinates to the alert sent to guardians and
        responders — it's how they find you.
      </Text>

      <GlassCard accentBorder>
        <Text style={[type.kicker, styles.accentText]}>WHY WE ASK</Text>
        <Text style={[type.bodySmall, styles.copy, styles.consentCopy]}>
          Location is only captured at the moment of a confirmed crash alert — Angel never tracks or stores your
          location otherwise.
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
