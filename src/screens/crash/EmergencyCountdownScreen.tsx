import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useGuardians } from "../../hooks";
import { EMERGENCY_COUNTDOWN_SECONDS, cancelCrashEvent, sendGuardianAlert } from "../../services/emergency";
import { SEVERITY_LABELS, triggerHeadline } from "../../lib/crashSignals";
import { fontFamily, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

// Deep, urgent red — deliberately distinct from the app's dark theme
// (colors.bg/colors.accent) so this screen reads unmistakably as an
// emergency the instant it appears, not just another dark screen.
const EMERGENCY_RED = "#3A0000";

type Phase = "counting" | "sending" | "error";

export function EmergencyCountdownScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "EmergencyCountdown">>();
  const event = route.params;

  const { session } = useAuth();
  const { data: guardians } = useGuardians();
  const insets = useSafeAreaInsets();

  const [secondsLeft, setSecondsLeft] = useState(EMERGENCY_COUNTDOWN_SECONDS);
  const [phase, setPhase] = useState<Phase>("counting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resolvedRef = useRef(false);

  const sendAlert = async () => {
    setPhase("sending");
    setErrorMessage(null);
    if (!session?.user.id) {
      // Shouldn't happen — this screen only exists behind an authenticated
      // session — but there's no rider to attribute the alert to.
      setPhase("error");
      setErrorMessage("Not signed in — can't send the alert.");
      return;
    }
    try {
      await sendGuardianAlert({ event, userId: session.user.id });
      navigation.replace("EmergencyAlertSent", { guardianNames: (guardians ?? []).map((g) => g.name) });
    } catch (err) {
      console.warn("[emergency] failed to send guardian alert", err);
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to send the alert.");
    }
  };

  useEffect(() => {
    if (resolvedRef.current) return;
    if (secondsLeft <= 0) {
      resolvedRef.current = true;
      sendAlert();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // Fullscreen and non-dismissable — no back button, no swipe (the stack
  // screen itself also sets gestureEnabled: false, see RootNavigator).
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, []);

  const handleOkay = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    await cancelCrashEvent(event);
    navigation.goBack();
  };

  const detectedAt = useMemo(
    () => new Date(event.receivedAt).toLocaleTimeString("en-IN", { hour12: false }),
    [event.receivedAt]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚠ POSSIBLE CRASH DETECTED</Text>
        <Text style={styles.headerMeta}>
          {SEVERITY_LABELS[event.severity]} · SEVERITY {event.severity}/5 · {triggerHeadline(event.trigger)} ·{" "}
          {detectedAt}
        </Text>
      </View>

      <View style={styles.center}>
        {phase === "counting" && (
          <>
            <Text style={styles.countdownValue}>{secondsLeft}</Text>
            <Text style={styles.countdownLabel}>SECONDS</Text>
            <Text style={styles.copy}>
              Guardians will be texted your location automatically if you don't respond.
            </Text>
          </>
        )}
        {phase === "sending" && (
          <>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.sendingText}>Sending alert to guardians…</Text>
          </>
        )}
        {phase === "error" && (
          <>
            <Text style={styles.errorTitle}>Couldn't send the alert</Text>
            <Text style={styles.errorCopy}>{errorMessage}</Text>
          </>
        )}
      </View>

      {phase === "counting" && (
        <Pressable
          onPress={handleOkay}
          style={({ pressed }) => [styles.okayButton, pressed && styles.okayButtonPressed]}
          hitSlop={8}
        >
          <Text style={styles.okayButtonText}>I'M OKAY</Text>
        </Pressable>
      )}
      {phase === "error" && (
        <Pressable
          onPress={sendAlert}
          style={({ pressed }) => [styles.okayButton, pressed && styles.okayButtonPressed]}
          hitSlop={8}
        >
          <Text style={styles.okayButtonText}>RETRY SENDING</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: EMERGENCY_RED, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  header: { alignItems: "center" },
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: type.button.fontFamily,
    fontSize: 15,
    letterSpacing: 1.5,
  },
  headerMeta: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: type.label.fontFamily,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  countdownValue: {
    color: "#FFFFFF",
    fontFamily: fontFamily.headingBold,
    fontSize: 148,
    lineHeight: 156,
  },
  countdownLabel: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: fontFamily.monoMedium,
    fontSize: 16,
    letterSpacing: 4,
    marginTop: spacing.sm,
  },
  copy: {
    color: "rgba(255,255,255,0.85)",
    ...type.body,
    textAlign: "center",
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  sendingText: {
    color: "#FFFFFF",
    ...type.body,
    marginTop: spacing.lg,
  },
  errorTitle: {
    color: "#FFFFFF",
    fontFamily: fontFamily.headingBold,
    fontSize: 24,
  },
  errorCopy: {
    color: "rgba(255,255,255,0.85)",
    ...type.body,
    textAlign: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  okayButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  okayButtonPressed: {
    opacity: 0.85,
  },
  okayButtonText: {
    color: EMERGENCY_RED,
    fontFamily: type.button.fontFamily,
    fontSize: 22,
    letterSpacing: 2,
  },
});
