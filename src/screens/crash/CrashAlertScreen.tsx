import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, PillButton, RadialCountdown, ScreenBackground, SeverityMeter } from "../../components";
import { useAssignResponder, useAuth, useDevice, useGuardians, useResponders } from "../../hooks";
import { responderTypesForSeverity } from "../../hooks/useResponders";
import { cancelCrashEvent, confirmIncident } from "../../services/emergency";
import { notificationService } from "../../services/notifications";
import { etaMinutes, haversineKm } from "../../lib/geo";
import { colors, radius, severityColor, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";
import { initialsFor } from "../../hooks/useGuardians";
import { SEVERITY_LABELS, remainingCountdownSeconds, triggerDescription, triggerHeadline } from "../../lib/crashSignals";

export function CrashAlertScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "CrashAlert">>();
  const { severity, trigger, impactG, gyroDps, tilt, still, calibrated, receivedAt, totalSeconds } = route.params;
  const event = useMemo(
    () => ({ severity, trigger, impactG, gyroDps, tilt, still, calibrated, receivedAt }),
    [severity, trigger, impactG, gyroDps, tilt, still, calibrated, receivedAt]
  );

  const { session } = useAuth();
  const { data: device } = useDevice();
  const { data: guardians } = useGuardians();
  const { data: responders } = useResponders(responderTypesForSeverity(severity));
  const assignResponder = useAssignResponder();
  const insets = useSafeAreaInsets();

  const [secondsLeft, setSecondsLeft] = useState(() => remainingCountdownSeconds(receivedAt, totalSeconds));
  const [resolving, setResolving] = useState(false);
  const resolvedRef = useRef(false);

  const detectedAt = useMemo(
    () => new Date(receivedAt).toLocaleTimeString("en-IN", { hour12: false }),
    [receivedAt]
  );

  const dispatch = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolving(true);

    if (!session?.user.id) {
      // Shouldn't happen — this screen only exists behind an authenticated
      // session — but bail safely rather than writing an orphaned incident.
      setResolving(false);
      resolvedRef.current = false;
      return;
    }

    const incident = await confirmIncident({
      event,
      userId: session.user.id,
      deviceId: device?.id ?? null,
      guardians: guardians ?? [],
    });

    const nearest = (responders ?? [])
      .map((r) => ({ r, distanceKm: haversineKm({ lat: incident.lat ?? 0, lng: incident.lng ?? 0 }, { lat: r.lat, lng: r.lng }) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];

    if (nearest) {
      await assignResponder.mutateAsync({ incidentId: incident.id, responderId: nearest.r.id });
      await notificationService.logEvent(
        incident.id,
        `Nearest partner accepted, ${nearest.distanceKm.toFixed(1)} km out · ETA ${etaMinutes(nearest.distanceKm)} min`
      );
    }

    navigation.replace("LiveIncident", { incidentId: incident.id });
  };

  useEffect(() => {
    if (secondsLeft <= 0) {
      dispatch();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // Android's hardware/gesture back button must be blocked explicitly so
  // the alert can only be dismissed via the cancel/dispatch buttons.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, []);

  const handleCancel = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    await cancelCrashEvent(event);
    navigation.goBack();
  };

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
            <Text style={[type.kicker, { color: calibrated ? severityColor(severity) : colors.textMuted }]}>
              {SEVERITY_LABELS[severity]}
            </Text>
          </View>
          <SeverityMeter severity={severity} />

          <View style={[styles.triggerBadge, trigger === "impact" ? styles.triggerBadgeImpact : styles.triggerBadgeTilt]}>
            <Text style={[type.kicker, trigger === "impact" ? styles.triggerTextImpact : styles.triggerTextTilt]}>
              {triggerHeadline(trigger)}
            </Text>
          </View>
          <Text style={[type.bodySmall, styles.triggerCopy]}>{triggerDescription(trigger)}</Text>

          {!calibrated && (
            <View style={styles.uncalibratedBanner}>
              <Text style={[type.kicker, styles.uncalibratedText]}>⚠ SENSOR NOT CALIBRATED</Text>
              <Text style={[type.bodySmall, styles.uncalibratedCopy]}>
                The sensor's mounting reference wasn't set when this was detected — tilt wasn't measurable, so the
                severity above may be off.
              </Text>
            </View>
          )}
          <Text style={[type.label, styles.metaRow]}>
            IMPACT {impactG.toFixed(2)}G   ROTATION {gyroDps.toFixed(0)}°/S   LEAN{" "}
            {calibrated ? `${tilt.toFixed(0)}°` : "—"}
            {still ? "   STILL" : ""}
          </Text>
          <Text style={[type.bodySmall, styles.caveat]}>
            Severity is an estimate based on sensor readings — a rough 1-5 triage signal, not a medical diagnosis.
          </Text>
        </View>

        <View style={styles.countdownWrap}>
          <RadialCountdown secondsLeft={Math.max(0, secondsLeft)} totalSeconds={totalSeconds} />
        </View>

        <Text style={[type.body, styles.copy]}>
          Guardians and nearby responders will be alerted when the timer ends.
        </Text>

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
          <PillButton title="I'M OK — CANCEL ALERT" variant="inverse" onPress={handleCancel} disabled={resolving} />
          <PillButton title="SEND HELP NOW" variant="outline" onPress={dispatch} loading={resolving} />
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
  uncalibratedBanner: {
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  uncalibratedText: { color: colors.accent },
  uncalibratedCopy: { color: colors.textMuted, marginTop: spacing.xs },
  countdownWrap: { marginTop: spacing.lg },
  copy: { color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.lg },
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
