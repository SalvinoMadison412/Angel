import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, PillButton, RadialCountdown, ScreenBackground, SeverityMeter } from "../../components";
import { useAssignResponder, useCancelIncident, useGuardians, useIncident, useLocation, useResponders } from "../../hooks";
import { responderTypesForSeverity } from "../../hooks/useResponders";
import { notificationService } from "../../services/notifications";
import { etaMinutes, haversineKm } from "../../lib/geo";
import { colors, severityColor, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";
import { initialsFor } from "../../hooks/useGuardians";

const SEVERITY_LABELS: Record<number, string> = {
  1: "MINOR",
  2: "MODERATE",
  3: "ELEVATED",
  4: "SEVERE",
  5: "CRITICAL",
};

export function CrashAlertScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "CrashAlert">>();
  const { incidentId, severity, totalSeconds } = route.params;

  const { data: incident } = useIncident(incidentId);
  const { data: guardians } = useGuardians();
  const { data: responders } = useResponders(responderTypesForSeverity(severity));
  const { coords } = useLocation();
  const cancelIncident = useCancelIncident();
  const assignResponder = useAssignResponder();
  const insets = useSafeAreaInsets();

  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [resolving, setResolving] = useState(false);
  const resolvedRef = useRef(false);

  const detectedAt = useMemo(
    () => new Date(incident?.created_at ?? Date.now()).toLocaleTimeString("en-IN", { hour12: false }),
    [incident?.created_at]
  );
  const impactG = useMemo(() => (1.4 + severity * 1.3 + Math.random() * 0.4).toFixed(1), [severity]);
  const leanDeg = useMemo(() => Math.round(18 + severity * 13 + Math.random() * 6), [severity]);

  const dispatch = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolving(true);

    await notificationService.logEvent(incidentId, "Crash confirmed — countdown expired");
    if (incident) {
      await notificationService.notifyGuardians(incident, guardians ?? []);
    }

    const nearest = (responders ?? [])
      .map((r) => ({ r, distanceKm: haversineKm(coords, { lat: r.lat, lng: r.lng }) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];

    if (nearest) {
      await assignResponder.mutateAsync({ incidentId, responderId: nearest.r.id });
      await notificationService.logEvent(
        incidentId,
        `Nearest partner accepted, ${nearest.distanceKm.toFixed(1)} km out · ETA ${etaMinutes(nearest.distanceKm)} min`
      );
    }

    navigation.replace("LiveIncident", { incidentId });
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

  // `gestureEnabled: false` on this screen's stack options only blocks iOS's
  // swipe-back gesture — Android's hardware/gesture back button is a
  // separate input path and isn't covered by it. Block it too, so the
  // alert can only be dismissed via the cancel/dispatch buttons.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, []);

  const handleCancel = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    await cancelIncident.mutateAsync(incidentId);
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
            <Text style={[type.kicker, { color: severityColor(severity) }]}>{SEVERITY_LABELS[severity]}</Text>
          </View>
          <SeverityMeter severity={severity} />
          <Text style={[type.label, styles.metaRow]}>
            LEVEL {severity} / 5   IMPACT {impactG} G   LEAN {leanDeg}°
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
  metaRow: { color: colors.textMuted, marginTop: spacing.md },
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
