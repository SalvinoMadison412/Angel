import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GlassCard, HoloMotorcycle, ScreenBackground, StatTile } from "../../components";
import { useCrashDetector, useCurrentSubscription, useDevice, useGuardians } from "../../hooks";
import { daysLeft } from "../../hooks/useSubscription";
import { CrashEvent, impactToGForce } from "../../services/bluetooth";
import { colors, fontFamily, spacing, type } from "../../theme";
import { AppTabNavigation } from "../../navigation/types";

// Rough scaling so each debug severity button lands roughly where the
// firmware's own threshold ladder (see firmware/README.md) would place it —
// not meant to be exact, just plausible enough to exercise every band.
function mockMetricsForSeverity(severity: number) {
  return {
    impact: 15000 + severity * 4500,
    gyro: 9000 + severity * 3200,
    tilt: 20 + severity * 9,
    still: severity >= 3,
    calibrated: true, // debug panel always simulates a calibrated sensor
  };
}

const formatReadingTime = (receivedAt: number) => new Date(receivedAt).toLocaleTimeString("en-IN", { hour12: false });

// The firmware only notifies once per detected impact, not on a continuous
// stream (see firmware/CrashDetector/CrashDetector.ino) — so these tiles show
// the most recent real reading, not a live gauge. Never render a value that
// didn't come from an actual BLE payload.
type ReadingTile = { kind: "empty"; message: string } | { kind: "value"; value: string; unit: string; caption: string };

function gForceTile(lastEvent: CrashEvent | null, connected: boolean): ReadingTile {
  if (!lastEvent) return { kind: "empty", message: connected ? "No readings yet" : "No device connected" };
  return {
    kind: "value",
    value: impactToGForce(lastEvent.impact).toFixed(2),
    unit: "G",
    caption: `LAST IMPACT · ${formatReadingTime(lastEvent.receivedAt)}`,
  };
}

function leanTile(lastEvent: CrashEvent | null, connected: boolean): ReadingTile {
  if (!lastEvent) return { kind: "empty", message: connected ? "No readings yet" : "No device connected" };
  if (!lastEvent.calibrated) return { kind: "empty", message: "Not calibrated" };
  return {
    kind: "value",
    value: String(Math.round(lastEvent.tilt)),
    unit: "DEG",
    caption: `LAST IMPACT · ${formatReadingTime(lastEvent.receivedAt)}`,
  };
}

export function HomeScreen() {
  const navigation = useNavigation<AppTabNavigation<"Home">>();
  const { data: device } = useDevice();
  const { data: guardians } = useGuardians();
  const { data: subscription } = useCurrentSubscription();
  const { connectionState, lastEvent } = useCrashDetector();
  const { simulateCrash } = useCrashDetector({ mock: true });

  const isLinked = device?.pairing_status === "paired";
  const isConnected = connectionState === "connected";

  const gTile = gForceTile(lastEvent, isConnected);
  const lTile = leanTile(lastEvent, isConnected);
  const leanDeg = lastEvent && lastEvent.calibrated ? lastEvent.tilt / 4 : 0;

  // Feeds the mock BLE stream rather than writing an incident directly —
  // this exercises the exact same app-root listener → CrashAlertScreen →
  // emergencyPipeline path a real sensor would, just without a physical
  // crash. See src/services/bluetooth/mockCrashDetectorBle.ts. Deliberately
  // kept separate from the real `useCrashDetector()` above so a debug tap
  // never shows up as a "real" reading on this screen.
  const handleSimulateCrash = (severity: number) => {
    simulateCrash?.({ severity: severity as 1 | 2 | 3 | 4 | 5, ...mockMetricsForSeverity(severity) });
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
          You're protected. The sensor watches impact and lean at 100 Hz on-device and only reports back when it
          detects one.
        </Text>
      </GlassCard>

      <GlassCard style={styles.telemetryCard} padded={false}>
        <View style={styles.telemetryHeader}>
          <Text style={[type.kicker, styles.dimText]}>LIGHT-CYCLE // TELEMETRY</Text>
          <Text style={[type.kicker, isConnected ? styles.sensorOk : styles.dimText]}>
            {isConnected ? "SENSOR OK" : "SENSOR OFFLINE"}
          </Text>
        </View>
        <View style={styles.motifWrap}>
          <HoloMotorcycle leanDeg={leanDeg} />
        </View>
      </GlassCard>

      <View style={styles.statRow}>
        <StatTile
          label="G-FORCE"
          value={gTile.kind === "value" ? gTile.value : gTile.message}
          unit={gTile.kind === "value" ? gTile.unit : undefined}
          caption={gTile.kind === "value" ? gTile.caption : undefined}
          empty={gTile.kind === "empty"}
        />
        <StatTile
          label="LEAN"
          value={lTile.kind === "value" ? lTile.value : lTile.message}
          unit={lTile.kind === "value" ? lTile.unit : undefined}
          caption={lTile.kind === "value" ? lTile.caption : undefined}
          empty={lTile.kind === "empty"}
        />
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

      <Pressable onPress={() => navigation.navigate("Profile", { screen: "Plan" })}>
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
          Tap a severity to simulate a crash signal from the device. Severity 1 is logged but stays below the
          alert threshold, so nothing appears on screen — that's expected.
        </Text>
        <View style={styles.severityRow}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              style={styles.severityButton}
              onPress={() => handleSimulateCrash(level)}
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
