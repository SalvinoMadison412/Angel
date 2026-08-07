import * as Location from "expo-location";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PillButton, ScreenBackground, ShieldPinIcon } from "../../components";
import { setLocationPermissionAsked } from "../../lib/locationPermissionStorage";
import { colors, spacing, type } from "../../theme";

interface Props {
  /** Called once the rider has been asked (Allow or Not Now) — RootNavigator uses this to swap to the main app. */
  onDone: () => void;
}

/**
 * Shown once, right after onboarding and before the rider ever lands on
 * Home — a rationale screen ahead of the OS location permission dialog,
 * since asking cold with no context reads as a generic permission popup
 * rather than the safety feature it actually is. Gated by
 * lib/locationPermissionStorage so it never shows twice; RootNavigator
 * skips straight past it (to Home, where a warning banner takes over) once
 * that flag is set, regardless of whether the rider allowed or declined.
 */
export function LocationPermissionScreen({ onDone }: Props) {
  const [loading, setLoading] = useState(false);

  const finish = async () => {
    await setLocationPermissionAsked();
    onDone();
  };

  const handleAllow = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        // Best-effort — background location isn't required for foreground
        // access to be useful, so a decline/error here shouldn't block
        // finishing this screen.
        try {
          await Location.requestBackgroundPermissionsAsync();
        } catch (err) {
          console.warn("[location-permission] background permission request failed", err);
        }
      }
    } catch (err) {
      console.warn("[location-permission] foreground permission request failed", err);
    } finally {
      setLoading(false);
      await finish();
    }
  };

  const handleNotNow = () => {
    finish();
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <View style={styles.iconWrap}>
        <ShieldPinIcon color={colors.accent} size={72} />
      </View>

      <Text style={[type.title, styles.heading]}>Your location could save your life</Text>

      <Text style={[type.body, styles.paragraph]}>
        If Angel detects a crash, your precise location is immediately sent to your emergency guardians on WhatsApp —
        so they know exactly where to find you.
      </Text>
      <Text style={[type.body, styles.paragraph]}>
        Without location access, your guardians will be alerted but won't know where you are. In a real emergency,
        every second matters.
      </Text>
      <Text style={[type.body, styles.paragraph]}>
        Angel only uses your location at the moment a crash is detected. It is never tracked, stored, or shared at
        any other time.
      </Text>

      <PillButton title="ALLOW LOCATION ACCESS" onPress={handleAllow} loading={loading} style={styles.cta} />
      <Text style={styles.notNow} onPress={handleNotNow}>
        Not now
      </Text>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
    alignItems: "center",
    flexGrow: 1,
  },
  iconWrap: { marginTop: spacing.xl, marginBottom: spacing.xl },
  heading: { color: colors.text, textAlign: "center" },
  paragraph: { color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
  cta: { width: "100%", marginTop: "auto", marginBottom: spacing.lg },
  notNow: { ...type.bodySmall, color: colors.textDim, textDecorationLine: "underline" },
});
