import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton } from "../../components";
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
 * exactly the kind of thing that gets a rider to tap Deny. Both buttons
 * advance; declining doesn't block onboarding (see captureCurrentLocation
 * in emergencyPipeline.ts, which re-requests at alert time as a fallback).
 */
export function LocationPermissionScreen({ onContinue }: Props) {
  const [requesting, setRequesting] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      await SecureStore.setItemAsync(LOCATION_PERMISSION_STATUS_KEY, status);
    } catch (err) {
      console.warn("[onboarding] failed to request location permission", err);
    } finally {
      setRequesting(false);
      onContinue();
    }
  };

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
      <PillButton title="SKIP FOR NOW" variant="outline" onPress={onContinue} disabled={requesting} />
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
});
