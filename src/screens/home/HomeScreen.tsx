import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GlassCard, HoloMotorcycle, ScreenBackground, StatTile } from "../../components";
import { useCreateIncident, useCurrentSubscription, useDevice, useGuardians, useLocation } from "../../hooks";
import { daysLeft } from "../../hooks/useSubscription";
import { sensorDataSource, SensorReading } from "../../services/sensors";
import { colors, fontFamily, spacing, type } from "../../theme";
import { AppTabNavigation } from "../../navigation/types";

export function HomeScreen() {
  const navigation = useNavigation<AppTabNavigation<"Home">>();
  const { data: device } = useDevice();
  const { data: guardians } = useGuardians();
  const { data: subscription } = useCurrentSubscription();
  const { coords } = useLocation();
  const createIncident = useCreateIncident();

  const [reading, setReading] = useState<SensorReading | null>(null);

  useEffect(() => {
    const unsubscribe = sensorDataSource.subscribe(setReading);
    return unsubscribe;
  }, []);

  const isLinked = device?.pairing_status === "paired";

  const handleSimulateCrash = async (severity: number) => {
    const incident = await createIncident.mutateAsync({
      deviceId: device?.id ?? null,
      severity,
      lat: coords.lat,
      lng: coords.lng,
    });
    navigation.navigate("CrashAlert", { incidentId: incident.id, severity, totalSeconds: 30 });
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[type.wordmark, styles.wordmark]}>ANGEL</Text>
        <View style={[styles.statusPill, isLinked ? styles.statusPillOn : styles.statusPillOff]}>
          <View style={[styles.statusDot, { backgroundColor: isLinked ? colors.success : colors.textDim }]} />
          <Text style={[type.kicker, styles.statusText]}>{isLinked ? "DEVICE LINKED" : "DEVICE NOT PAIRED"}</Text>
        </View>
      </View>

      <GlassCard style={styles.statusCard}>
        <Text style={[type.kicker, styles.dimText]}>STATUS</Text>
        <View style={styles.statusHeadingRow}>
          <View style={styles.pulseDot} />
          <Text style={[type.title, styles.statusHeading]}>SYSTEM ACTIVE</Text>
        </View>
        <Text style={[type.body, styles.statusBody]}>
          You're protected. Impact, lean angle and speed are being monitored at 100 Hz.
        </Text>
      </GlassCard>

      <GlassCard style={styles.telemetryCard} padded={false}>
        <View style={styles.telemetryHeader}>
          <Text style={[type.kicker, styles.dimText]}>LIGHT-CYCLE // TELEMETRY</Text>
          <Text style={[type.kicker, styles.sensorOk]}>SENSOR OK</Text>
        </View>
        <View style={styles.motifWrap}>
          <HoloMotorcycle leanDeg={reading ? reading.leanAngleDeg / 4 : 0} />
        </View>
      </GlassCard>

      <View style={styles.statRow}>
        <StatTile label="G-FORCE" value={(reading?.gForce ?? 0).toFixed(2)} unit="G" />
        <StatTile label="LEAN" value={String(reading?.leanAngleDeg ?? 0)} unit="DEG" />
        <StatTile label="SPEED" value={String(reading?.speedKmh ?? 0)} unit="KM/H" />
      </View>

      <Pressable onPress={() => navigation.navigate("Guardians")}>
        <GlassCard style={styles.listRow}>
          <View style={styles.listRowInner}>
            <View>
              <Text style={[type.body, styles.listTitle]}>Emergency Contacts</Text>
              <Text style={[type.bodySmall, styles.listSubtitle]}>{(guardians?.length ?? 0)} GUARDIANS · READY</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </View>
        </GlassCard>
      </Pressable>

      <Pressable onPress={() => navigation.navigate("Plan")}>
        <GlassCard style={styles.listRow}>
          <View style={styles.listRowInner}>
            <View>
              <Text style={[type.body, styles.listTitle]}>Plan Details</Text>
              <Text style={[type.bodySmall, styles.listSubtitle]}>
                {subscription ? `${subscription.tier}-MONTH · ${daysLeft(subscription.end_date)} DAYS LEFT` : "NO ACTIVE PLAN"}
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </View>
        </GlassCard>
      </Pressable>

      <GlassCard style={styles.debugCard}>
        <Text style={[type.kicker, styles.dimText]}>DEBUG · SIMULATE DEVICE SIGNAL</Text>
        <Text style={[type.bodySmall, styles.debugCopy]}>
          Tap a severity to simulate a crash signal from the device.
        </Text>
        <View style={styles.severityRow}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              style={styles.severityButton}
              onPress={() => handleSimulateCrash(level)}
              disabled={createIncident.isPending}
            >
              <Text style={styles.severityButtonText}>{level}</Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: { color: colors.text, fontSize: 18 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  statusPillOn: { borderColor: "rgba(61,220,151,0.4)", backgroundColor: "rgba(61,220,151,0.08)" },
  statusPillOff: { borderColor: colors.glassBorder, backgroundColor: colors.glassFillRaised },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: colors.textMuted },
  statusCard: {},
  dimText: { color: colors.textDim },
  statusHeadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text },
  statusHeading: { color: colors.text },
  statusBody: { color: colors.textMuted, marginTop: spacing.md },
  telemetryCard: { paddingTop: spacing.lg },
  telemetryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  sensorOk: { color: colors.accent },
  motifWrap: { alignItems: "center", paddingVertical: spacing.xl },
  statRow: { flexDirection: "row", gap: spacing.md },
  listRow: {},
  listRowInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listTitle: { color: colors.text, fontFamily: fontFamily.bodySemiBold },
  listSubtitle: { color: colors.textDim, marginTop: 4 },
  arrow: { color: colors.textMuted, fontSize: 18 },
  debugCard: { borderStyle: "dashed" as const, borderColor: colors.glassBorder },
  debugCopy: { color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.md },
  severityRow: { flexDirection: "row", gap: spacing.sm },
  severityButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  severityButtonText: { color: colors.accent, fontFamily: type.button.fontFamily, fontSize: 16 },
});
