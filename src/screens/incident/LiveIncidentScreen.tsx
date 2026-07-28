import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton, RouteMap, ScreenBackground, ScreenHeader, Tag } from "../../components";
import { useIncident, useIncidentEvents, useResponders } from "../../hooks";
import { etaMinutes, haversineKm } from "../../lib/geo";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

const SEVERITY_LABELS: Record<number, string> = {
  1: "MINOR",
  2: "MODERATE",
  3: "ELEVATED",
  4: "SEVERE",
  5: "CRITICAL",
};

const TYPE_LABELS: Record<string, string> = {
  gig_partner: "GIG PARTNER",
  auto: "AUTO",
  car_uber: "CAR / UBER",
};

export function LiveIncidentScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "LiveIncident">>();
  const { incidentId } = route.params;

  const { data: incident } = useIncident(incidentId);
  const { data: events } = useIncidentEvents(incidentId);
  const { data: responders } = useResponders();
  const [callNote, setCallNote] = useState<string | null>(null);

  const responder = useMemo(
    () => responders?.find((r) => r.id === incident?.assigned_responder_id),
    [responders, incident?.assigned_responder_id]
  );

  const distanceKm = useMemo(() => {
    if (!incident?.lat || !incident?.lng || !responder) return null;
    return haversineKm({ lat: incident.lat, lng: incident.lng }, { lat: responder.lat, lng: responder.lng });
  }, [incident, responder]);

  const handleShare = () => {
    if (!incident) return;
    Share.share({
      message: `I need help — track my Angel incident here: https://angel.app/i/${incident.id.slice(0, 8)} (lat ${incident.lat?.toFixed(4)}, lng ${incident.lng?.toFixed(4)})`,
    });
  };

  if (!incident) {
    return (
      <ScreenBackground contentStyle={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading incident…</Text>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.popToTop()} />
      <View style={styles.headerBlock}>
        <Text style={[type.kicker, styles.dim]}>INCIDENT #{incident.id.slice(0, 4).toUpperCase()}</Text>
        <View style={styles.severityRow}>
          <Text style={[type.body, styles.severityLine]}>
            SEVERITY {incident.severity} · {SEVERITY_LABELS[incident.severity]}
          </Text>
          {incident.calibrated === false && <Tag label="SENSOR UNCALIBRATED" variant="outline" />}
        </View>
      </View>

      <View style={styles.mapWrap}>
        <RouteMap
          riderLat={incident.lat ?? 12.9716}
          riderLng={incident.lng ?? 77.5946}
          responderLat={responder?.lat ?? incident.lat ?? 12.9716}
          responderLng={responder?.lng ?? incident.lng ?? 77.5946}
        />
      </View>

      <GlassCard style={styles.responderCard}>
        {responder ? (
          <>
            <View style={styles.responderTopRow}>
              <View>
                <Text style={[type.kicker, styles.accentText]}>
                  {TYPE_LABELS[responder.type]} · EN ROUTE
                </Text>
                <Text style={styles.responderName}>{responder.name}</Text>
                <Text style={[type.bodySmall, styles.responderMeta]}>
                  {responder.platform_label?.toUpperCase()} · {responder.rating?.toFixed(1)} ★ ·{" "}
                  {responder.vehicle_label}
                </Text>
              </View>
              {distanceKm !== null && (
                <View style={styles.etaBlock}>
                  <Text style={styles.etaValue}>{etaMinutes(distanceKm)}</Text>
                  <Text style={[type.label, styles.etaUnit]}>MIN · {distanceKm.toFixed(1)} KM</Text>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <PillButton
                title="CALL RESPONDER"
                variant="inverse"
                onPress={() => setCallNote("Mock responder — no live line yet.")}
                style={styles.actionButton}
              />
              <PillButton title="SHARE LIVE PIN" variant="outline" onPress={handleShare} style={styles.actionButton} />
            </View>
            {callNote && <Text style={styles.callNote}>{callNote}</Text>}
          </>
        ) : (
          <Text style={styles.waiting}>Waiting for the nearest partner to accept…</Text>
        )}
      </GlassCard>

      <View style={styles.timeline}>
        {(events ?? []).map((event) => (
          <View key={event.id} style={styles.timelineRow}>
            <View style={[styles.timelineDot, event.label.toLowerCase().includes("accepted") && styles.timelineDotAccent]} />
            <Text style={[type.bodySmall, styles.timelineLabel]}>{event.label}</Text>
            <Text style={styles.timelineTime}>
              {new Date(event.occurred_at).toLocaleTimeString("en-IN", { hour12: false })}
            </Text>
          </View>
        ))}
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  loadingWrap: { alignItems: "center", justifyContent: "center" },
  loadingText: { color: colors.textMuted },
  headerBlock: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  dim: { color: colors.textDim },
  severityRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  severityLine: { color: colors.text },
  mapWrap: { paddingHorizontal: spacing.xl },
  responderCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg },
  responderTopRow: { flexDirection: "row", justifyContent: "space-between" },
  accentText: { color: colors.accent },
  responderName: { color: colors.text, fontFamily: type.title.fontFamily, fontSize: 20, marginTop: spacing.sm },
  responderMeta: { color: colors.textMuted, marginTop: spacing.xs },
  etaBlock: { alignItems: "flex-end" },
  etaValue: { color: colors.text, fontFamily: type.display.fontFamily, fontSize: 32 },
  etaUnit: { color: colors.textDim },
  waiting: { color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  actionButton: { flex: 1 },
  callNote: { color: colors.textDim, ...type.bodySmall, marginTop: spacing.md, textAlign: "center" },
  timeline: { paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.md },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  timelineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  timelineDotAccent: { backgroundColor: colors.accent },
  timelineLabel: { color: colors.textMuted, flex: 1 },
  timelineTime: { color: colors.textDim, fontFamily: type.label.fontFamily, fontSize: 11 },
});
