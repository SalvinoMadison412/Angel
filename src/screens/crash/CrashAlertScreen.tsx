import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, PillButton, RadialCountdown, ScreenBackground, SeverityMeter } from "../../components";
import { useAuth, useDevice, useGuardians } from "../../hooks";
import { cancelCrashEvent, confirmIncident, queuePendingDispatch } from "../../services/emergency";
import { supabase } from "../../lib/supabase";
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
  // TODO: RE-ENABLE FOR V2 — nearest-responder matching removed for the v1
  // Play Store release (guardians-only via WhatsApp).
  // const { data: responders } = useResponders(responderTypesForSeverity(severity));
  // const assignResponder = useAssignResponder();
  const insets = useSafeAreaInsets();

  const [secondsLeft, setSecondsLeft] = useState(() => remainingCountdownSeconds(receivedAt, totalSeconds));
  const [resolving, setResolving] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const resolvedRef = useRef(false);

  // Angel Partners platform — a crash_tickets row is created the moment the
  // countdown starts (not at dispatch), so nearby Partners can see and
  // start responding to an open ticket during the countdown window itself,
  // not only after it expires. Kept as a promise (not a plain id) so
  // handleCancel can await it regardless of whether the insert has already
  // resolved by the time the rider taps cancel. Resolves to null — rather
  // than throwing — on any failure (missing session, denied location,
  // network error): a crash alert must never be blocked or stalled by this.
  const ticketPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (ticketPromiseRef.current) return;
    ticketPromiseRef.current = (async (): Promise<string | null> => {
      if (!session?.user.id || severity < 2) return null;

      let riderLat: number | null = null;
      let riderLng: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const position = await Location.getCurrentPositionAsync({});
          riderLat = position.coords.latitude;
          riderLng = position.coords.longitude;
        }
      } catch (err) {
        console.warn("[crash-ticket] failed to capture location", err);
      }

      try {
        const { data, error } = await supabase
          .from("crash_tickets")
          .insert({
            rider_id: session.user.id,
            severity,
            trigger,
            impact_g: impactG,
            gyro_dps: gyroDps,
            tilt_deg: tilt,
            rider_lat: riderLat,
            rider_lng: riderLng,
            status: "open",
          })
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      } catch (err) {
        console.warn("[crash-ticket] failed to create ticket", err);
        return null;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectedAt = useMemo(
    () => new Date(receivedAt).toLocaleTimeString("en-IN", { hour12: false }),
    [receivedAt]
  );

  const dispatch = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolving(true);
    setDispatchError(null);

    if (!session?.user.id) {
      // Shouldn't happen — this screen only exists behind an authenticated
      // session — but bail safely rather than writing an orphaned incident.
      setResolving(false);
      resolvedRef.current = false;
      return;
    }

    // confirmIncident only throws on its `incidents` insert itself failing
    // (e.g. no connectivity) — everything past that point inside it is
    // already best-effort. Without this try/catch, that throw used to leave
    // the rider stranded here indefinitely: `resolving` stays true forever,
    // both buttons stay disabled, no incident/ticket exists, nothing is
    // queued. Now it queues the dispatch for automatic background retry
    // (see offlineQueue.ts) and re-arms the buttons so the rider isn't
    // stuck waiting on a screen that can't move forward on its own.
    let incident;
    try {
      incident = await confirmIncident({
        event,
        userId: session.user.id,
        deviceId: device?.id ?? null,
        guardians: guardians ?? [],
      });
    } catch (err) {
      console.warn("[crash-ticket] dispatch failed, queuing for retry", err);
      queuePendingDispatch({ event, userId: session.user.id, deviceId: device?.id ?? null });
      setDispatchError(
        "Couldn't reach the server to finish dispatching — this will keep retrying automatically. Try again now if you have signal."
      );
      setResolving(false);
      resolvedRef.current = false;
      return;
    }

    // TODO: RE-ENABLE FOR V2 — nearest-responder matching removed for the
    // v1 Play Store release (guardians-only via WhatsApp).
    // const nearest = (responders ?? [])
    //   .map((r) => ({ r, distanceKm: haversineKm({ lat: incident.lat ?? 0, lng: incident.lng ?? 0 }, { lat: r.lat, lng: r.lng }) }))
    //   .sort((a, b) => a.distanceKm - b.distanceKm)[0];
    //
    // if (nearest) {
    //   await assignResponder.mutateAsync({ incidentId: incident.id, responderId: nearest.r.id });
    //   await notificationService.logEvent(
    //     incident.id,
    //     `Nearest partner accepted, ${nearest.distanceKm.toFixed(1)} km out · ETA ${etaMinutes(nearest.distanceKm)} min`
    //   );
    // }

    // Route to ActiveTicketScreen — a simple "guardians notified" +
    // location confirmation, not a partner-matching flow (see v2 TODO
    // above) — when the crash_tickets insert (kicked off on mount)
    // succeeded; fall back to the guardians-only confirmation if it
    // failed, so a dispatch is never left with nowhere to go.
    const ticketId = await ticketPromiseRef.current;
    if (ticketId) {
      navigation.replace("ActiveTicket", { ticketId });
    } else {
      navigation.replace("EmergencyAlertSent", { guardianNames: (guardians ?? []).map((g) => g.name) });
    }
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

    const ticketId = await ticketPromiseRef.current;
    if (ticketId) {
      const { error } = await supabase
        .from("crash_tickets")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) console.warn("[crash-ticket] failed to close ticket on cancel", error);
    }

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

        <Text style={[type.body, styles.copy]}>Guardians will be alerted when the timer ends.</Text>

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

        {dispatchError && <Text style={[type.bodySmall, styles.dispatchError]}>{dispatchError}</Text>}

        <View style={styles.actions}>
          <PillButton title="I'M OK — CANCEL ALERT" variant="inverse" onPress={handleCancel} disabled={resolving} />
          <PillButton
            title={dispatchError ? "TRY AGAIN" : "SEND HELP NOW"}
            variant="outline"
            onPress={dispatch}
            loading={resolving}
          />
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
  dispatchError: { color: "#FFB020", textAlign: "center", paddingHorizontal: spacing.lg },
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
