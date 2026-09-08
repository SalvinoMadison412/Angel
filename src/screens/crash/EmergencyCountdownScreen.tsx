import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, PillButton, RadialCountdown, ScreenBackground, SeverityMeter } from "../../components";
import { useAuth, useGuardians } from "../../hooks";
import { initialsFor } from "../../hooks/useGuardians";
import {
  EMERGENCY_COUNTDOWN_SECONDS,
  cancelCrashEvent,
  sendGuardianAlert,
  subscribeCountdownCancel,
} from "../../services/emergency";
import { dismissCountdownNotification, presentCountdownNotification } from "../../services/notifications";
import { remainingCountdownSeconds, triggerDescription } from "../../lib/crashSignals";
import { colors, radius, severityColor, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

// Local to this screen on purpose — not the shared SEVERITY_LABELS/
// triggerHeadline in lib/crashSignals.ts (those still back CrashAlertScreen,
// severity 2-5, unchanged). Only severity-1 events ever reach this screen,
// but the full map is kept for whichever trigger/severity combination
// actually arrives.
const SEVERITY_LABELS: Record<number, string> = {
  1: "MINOR",
  2: "MODERATE",
  3: "SERIOUS",
  4: "SEVERE",
  5: "CRITICAL",
};

function triggerHeadline(trigger: "impact" | "tilt"): string {
  return trigger === "impact" ? "HARD IMPACT" : "TILT DETECTED";
}

type Phase = "counting" | "sending" | "error";

export function EmergencyCountdownScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "EmergencyCountdown">>();
  const event = route.params;

  const { session } = useAuth();
  const { data: guardians } = useGuardians();
  const insets = useSafeAreaInsets();

  const [secondsLeft, setSecondsLeft] = useState(() =>
    remainingCountdownSeconds(event.receivedAt, EMERGENCY_COUNTDOWN_SECONDS)
  );
  const [phase, setPhase] = useState<Phase>("counting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resolvedRef = useRef(false);

  const sendAlert = async () => {
    setPhase("sending");
    setErrorMessage(null);

    // The countdown is over (or being skipped early via "SEND HELP NOW")
    // and the alert is firing — the ticking cancel notification no longer
    // applies. Dismissed up front, before the network call below, so it
    // disappears the instant sending actually starts.
    dismissCountdownNotification().catch((err) =>
      console.warn("[notifications] failed to dismiss countdown notification on send", err)
    );

    if (!session?.user.id) {
      // Shouldn't happen — this screen only exists behind an authenticated
      // session — but there's no rider to attribute the alert to.
      setPhase("error");
      setErrorMessage("Not signed in — can't send the alert.");
      return;
    }
    try {
      const { ticketId } = await sendGuardianAlert({ event, userId: session.user.id, source: "crash" });
      if (ticketId) {
        navigation.replace("ActiveTicket", { ticketId });
      } else {
        navigation.replace("EmergencyAlertSent", { guardianNames: (guardians ?? []).map((g) => g.name) });
      }
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
    // Fires the moment the countdown starts (this effect's first run, on
    // mount) and again every tick after — see countdownNotification.ts for
    // why re-posting under the same identifier every second is safe (no
    // repeat heads-up/sound on Android).
    presentCountdownNotification(secondsLeft, EMERGENCY_COUNTDOWN_SECONDS).catch((err) =>
      console.warn("[notifications] failed to present countdown notification", err)
    );
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

  // Three heavy pulses on mount only, so the rider feels this even if the
  // phone isn't in view.
  useEffect(() => {
    const pulse = async () => {
      for (let i = 0; i < 3; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (i < 2) await new Promise((resolve) => setTimeout(resolve, 200));
      }
    };
    pulse();
  }, []);

  const handleOkay = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    dismissCountdownNotification().catch((err) =>
      console.warn("[notifications] failed to dismiss countdown notification on cancel", err)
    );
    await cancelCrashEvent(event);
    navigation.goBack();
  };

  // A "CANCEL ALERT" tap on the countdown notification is handled globally
  // in RootNavigator, which has no direct reference to this screen —
  // subscribing here runs the exact same cancel path a rider tapping "I'M
  // OK" in-app would. resolvedRef's guard inside handleOkay means whichever
  // fires first (notification or in-app button) wins and the other becomes
  // a no-op.
  useEffect(() => {
    const unsubscribe = subscribeCountdownCancel(() => {
      handleOkay();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "SEND HELP NOW" just calls the same sendAlert the countdown itself
  // calls on expiry — tapped early (phase === "counting"), it must set
  // resolvedRef first so the countdown's own expiry effect doesn't also
  // fire a concurrent send; tapped as a retry after a failed send, the ref
  // is already set from the first attempt and this just re-invokes sendAlert.
  const handleSendNow = () => {
    if (phase === "counting") {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
    }
    sendAlert();
  };

  const detectedAt = useMemo(
    () => new Date(event.receivedAt).toLocaleTimeString("en-IN", { hour12: false }),
    [event.receivedAt]
  );

  const sending = phase === "sending";
  const chipGuardians = (guardians ?? []).slice(0, 3);
  const extraCount = Math.max(0, (guardians?.length ?? 0) - chipGuardians.length);

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.topBarText}>⚠ CRASH DETECTED</Text>
        <Text style={styles.topBarTime}>{detectedAt}</Text>
      </View>

      <ScreenBackground backgroundColor={colors.bg} contentStyle={styles.content} edges={["bottom"]}>
        <View style={styles.severitySection}>
          <View style={styles.severityHeaderRow}>
            <Text style={[type.kicker, styles.dim]}>SEVERITY</Text>
            <Text style={[type.kicker, { color: event.calibrated ? severityColor(event.severity) : colors.textMuted }]}>
              {SEVERITY_LABELS[event.severity]}
            </Text>
          </View>
          <SeverityMeter severity={event.severity} />

          <View
            style={[styles.triggerBadge, event.trigger === "impact" ? styles.triggerBadgeImpact : styles.triggerBadgeTilt]}
          >
            <Text style={[type.kicker, event.trigger === "impact" ? styles.triggerTextImpact : styles.triggerTextTilt]}>
              {triggerHeadline(event.trigger)}
            </Text>
          </View>
          <Text style={[type.bodySmall, styles.triggerCopy]}>{triggerDescription(event.trigger)}</Text>

          <Text style={[type.label, styles.metaRow]}>
            IMPACT {event.impactG.toFixed(2)}G   ROTATION {event.gyroDps.toFixed(0)}°/S   LEAN{" "}
            {event.calibrated ? `${event.tilt.toFixed(0)}°` : "—"}
            {event.still ? "   STILL" : ""}
          </Text>
          <Text style={[type.bodySmall, styles.caveat]}>
            Severity is an estimate based on sensor readings — a rough 1-5 triage signal, not a medical diagnosis.
          </Text>
        </View>

        <View style={styles.countdownWrap}>
          <RadialCountdown secondsLeft={Math.max(0, secondsLeft)} totalSeconds={EMERGENCY_COUNTDOWN_SECONDS} />
        </View>

        <Text style={[type.body, styles.copy]}>Guardians will be alerted when the timer ends.</Text>

        {phase === "error" && <Text style={styles.errorCopy}>{errorMessage}</Text>}

        <View style={styles.chipRow}>
          {chipGuardians.map((g) => (
            <Avatar key={g.id} initials={initialsFor(g.name)} accent />
          ))}
          {extraCount > 0 && (
            <View style={styles.extraChip}>
              <Text style={styles.extraChipText}>+{extraCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <PillButton title="I'M OK — CANCEL ALERT" variant="inverse" onPress={handleOkay} disabled={phase !== "counting"} />
          <PillButton title="SEND HELP NOW" variant="outline" onPress={handleSendNow} loading={sending} />
        </View>
      </ScreenBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    backgroundColor: colors.accent,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarText: { color: "#FFFFFF", fontFamily: type.button.fontFamily, fontSize: 13, letterSpacing: 1.5 },
  topBarTime: { color: "rgba(255,255,255,0.85)", fontFamily: type.label.fontFamily, fontSize: 12 },
  content: { padding: spacing.xl, alignItems: "center", gap: spacing.xl, flexGrow: 1 },
  severitySection: { width: "100%" },
  severityHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  dim: { color: colors.textDim },
  triggerBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  triggerBadgeImpact: { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted },
  triggerBadgeTilt: { borderColor: "rgba(255,176,32,0.5)", backgroundColor: "rgba(255,176,32,0.14)" },
  triggerTextImpact: { color: colors.accent },
  triggerTextTilt: { color: "#FFB020" },
  triggerCopy: { color: colors.textMuted, marginTop: spacing.sm },
  metaRow: { color: colors.textMuted, marginTop: spacing.md },
  caveat: { color: colors.textDim, marginTop: spacing.sm },
  countdownWrap: { marginTop: spacing.lg },
  copy: { color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.lg },
  errorCopy: { color: colors.accent, textAlign: "center", paddingHorizontal: spacing.lg, ...type.bodySmall },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  extraChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.glassFillRaised,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  extraChipText: { color: colors.textMuted, fontFamily: type.kicker.fontFamily, fontSize: 12 },
  actions: { width: "100%", gap: spacing.md, marginTop: "auto" },
});
