import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useGuardians } from "../../hooks";
import { sendGuardianAlert } from "../../services/emergency";
import { colors, fontFamily, spacing, type } from "../../theme";
import { RootStackNavigation } from "../../navigation/types";

type Phase = "sending" | "sent" | "error";

/**
 * Reached only from HomeScreen's "I NEED HELP NOW" button — a rider-
 * initiated alert with no sensor event and no cancel countdown behind it,
 * unlike EmergencyCountdownScreen/EmergencyAlertSentScreen which follow a
 * detected crash. Sends immediately on mount, reusing the same
 * guardians-only SMS path (sendGuardianAlert) as the severity-1 countdown
 * flow, with a synthetic severity-1 event standing in for a sensor reading.
 */
export function GuardianNotifiedScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const { session } = useAuth();
  const { data: guardians } = useGuardians();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("sending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sentOnMount = useRef(false);

  const sendAlert = async () => {
    if (!session?.user.id) {
      setPhase("error");
      setErrorMessage("Not signed in — can't send the alert.");
      return;
    }
    setPhase("sending");
    setErrorMessage(null);
    try {
      // Synthetic event only to satisfy the shared signature — source
      // "manual" tells sendGuardianAlert to null out every sensor field on
      // the crash ticket it opens for partners.
      const { ticketId } = await sendGuardianAlert({
        event: {
          severity: 1,
          trigger: "impact",
          impactG: 0,
          gyroDps: 0,
          tilt: 0,
          still: true,
          calibrated: false,
          receivedAt: Date.now(),
        },
        userId: session.user.id,
        source: "manual",
      });
      if (ticketId) {
        navigation.replace("ActiveTicket", { ticketId });
        return;
      }
      setPhase("sent");
    } catch (err) {
      console.warn("[emergency] failed to send manual guardian alert", err);
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to send the alert.");
    }
  };

  useEffect(() => {
    if (sentOnMount.current) return;
    sentOnMount.current = true;
    sendAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blocks the hardware back button only while actively sending — same
  // reasoning as EmergencyCountdownScreen: no escaping mid-send, but a
  // sent/error result is safe to back out of.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => phase === "sending");
    return () => subscription.remove();
  }, [phase]);

  const guardianNames = (guardians ?? []).map((g) => g.name);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.center}>
        {phase === "sending" && (
          <>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.title}>Alerting your guardians…</Text>
          </>
        )}
        {phase === "sent" && (
          <>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.title}>
              Alert sent to {guardianNames.length} contact{guardianNames.length === 1 ? "" : "s"}
            </Text>
            {guardianNames.length > 0 && (
              <View style={styles.namesWrap}>
                {guardianNames.map((name) => (
                  <Text key={name} style={styles.name}>
                    {name}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
        {phase === "error" && (
          <>
            <Text style={styles.errorMark}>!</Text>
            <Text style={styles.title}>Couldn't send the alert</Text>
            {errorMessage && <Text style={styles.errorCopy}>{errorMessage}</Text>}
            <Pressable
              onPress={sendAlert}
              style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
              hitSlop={8}
            >
              <Text style={styles.retryButtonText}>TRY AGAIN</Text>
            </Pressable>
          </>
        )}
      </View>

      <Pressable
        onPress={() => navigation.popToTop()}
        disabled={phase === "sending"}
        style={({ pressed }) => [
          styles.homeButton,
          pressed && styles.homeButtonPressed,
          phase === "sending" && styles.homeButtonDisabled,
        ]}
        hitSlop={8}
      >
        <Text style={styles.homeButtonText}>RETURN HOME</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  checkmark: { color: colors.success, fontSize: 56 },
  errorMark: { color: colors.accent, fontSize: 56, fontFamily: fontFamily.headingBold },
  title: {
    color: colors.text,
    fontFamily: fontFamily.headingBold,
    fontSize: 24,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  namesWrap: { marginTop: spacing.xl, alignItems: "center", gap: spacing.sm },
  name: { color: colors.textMuted, ...type.body },
  errorCopy: { color: colors.textMuted, textAlign: "center", marginTop: spacing.md, ...type.bodySmall },
  retryButton: {
    marginTop: spacing.xl,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryButtonPressed: { opacity: 0.85 },
  retryButtonText: { color: colors.accent, fontFamily: type.button.fontFamily, fontSize: 14, letterSpacing: 2 },
  homeButton: {
    backgroundColor: colors.text,
    borderRadius: 28,
    paddingVertical: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButtonPressed: { opacity: 0.85 },
  homeButtonDisabled: { opacity: 0.4 },
  homeButtonText: {
    color: colors.bg,
    fontFamily: type.button.fontFamily,
    fontSize: 16,
    letterSpacing: 2,
  },
});
