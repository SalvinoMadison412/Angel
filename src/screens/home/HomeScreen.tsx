import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassCard, HoloMotorcycle, ScreenBackground, SeverityMeter, StatTile } from "../../components";
import { useCrashDetector, useCurrentSubscription, useGuardians, useLocationPermissionStatus } from "../../hooks";
import { daysLeft } from "../../hooks/useSubscription";
import { SEVERITY_LABELS, triggerDescription, triggerHeadline } from "../../lib/crashSignals";
import { colors, fontFamily, severityColor, spacing, type } from "../../theme";
import { AppTabNavigation } from "../../navigation/types";

// Rough scaling so each debug severity button lands roughly where the
// firmware's own threshold ladder (see firmware/CrashDetector/CrashDetector.ino)
// would place it — not meant to be exact, just plausible enough to exercise
// every band.
function mockMetricsForSeverity(severity: number) {
  return {
    trigger: "impact" as const,
    impactG: 1 + severity * 0.45,
    gyroDps: 650 + severity * 380,
    tilt: 20 + severity * 9,
    still: severity >= 3,
    calibrated: true, // debug panel always simulates a calibrated sensor
  };
}

const formatReadingTime = (receivedAt: number) => new Date(receivedAt).toLocaleTimeString("en-IN", { hour12: false });

export function HomeScreen() {
  const navigation = useNavigation<AppTabNavigation<"Home">>();
  const { data: guardians } = useGuardians();
  const { data: subscription } = useCurrentSubscription();
  const { isLinked, isReconnecting, telemetry, lastEvent } = useCrashDetector();
  const { simulateCrash, simulateFault, clearSimulatedFault } = useCrashDetector({ mock: true });
  const { granted: locationGranted } = useLocationPermissionStatus();

  // Driven by the live BLE connection state, not the device row's persisted
  // `pairing_status` — that flag reflects setup history and goes stale the
  // moment the sensor actually disconnects, which is exactly the bug this
  // badge exists to avoid. `isLinked` is debounced (see useCrashDetector)
  // so a sub-2s reconnect blip doesn't flash this whole badge off and on.
  const leanDeg = lastEvent && lastEvent.calibrated ? lastEvent.tilt / 4 : 0;
  const connectionLabel = isReconnecting ? "RECONNECTING…" : isLinked ? "DEVICE CONNECTED" : "DEVICE NOT CONNECTED";
  const sensorLabel = isReconnecting ? "RECONNECTING…" : isLinked ? "SENSOR OK" : "SENSOR OFFLINE";

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
          <Text style={[type.kicker, styles.statusText]}>{connectionLabel}</Text>
        </View>
      </View>

      {locationGranted === false && (
        <Pressable onPress={() => Linking.openSettings()}>
          <View style={styles.locationBanner}>
            <Text style={styles.locationBannerText}>
              ⚠️ Location access is off — guardians won't know where to find you if you crash. Tap to enable.
            </Text>
          </View>
        </Pressable>
      )}

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
          <Text style={[type.kicker, isLinked ? styles.sensorOk : styles.dimText]}>{sensorLabel}</Text>
        </View>
        <View style={styles.motifWrap}>
          <HoloMotorcycle leanDeg={leanDeg} />
        </View>
      </GlassCard>

      <GlassCard style={styles.readingCard}>
        <Text style={[type.kicker, styles.dimText]}>LIVE READING</Text>
        {lastEvent ? (
          <>
            <View style={styles.readingSeverityRow}>
              <Text style={[styles.severityNumber, { color: severityColor(lastEvent.severity) }]}>
                {lastEvent.severity}
              </Text>
              <View style={styles.severityTextCol}>
                <Text style={styles.severityLabel}>
                  {SEVERITY_LABELS[lastEvent.severity]} · SEVERITY {lastEvent.severity}/5
                </Text>
                <Text
                  style={[
                    type.bodySmall,
                    lastEvent.trigger === "impact" ? styles.triggerTextImpact : styles.triggerTextTilt,
                  ]}
                >
                  {triggerHeadline(lastEvent.trigger)}
                </Text>
              </View>
            </View>
            <SeverityMeter severity={lastEvent.severity} />
            <Text style={styles.readingCopy}>
              {triggerDescription(lastEvent.trigger)} An estimate based on sensor readings, not a medical diagnosis.
            </Text>
          </>
        ) : isLinked ? (
          <Text style={styles.emptyReading}>No incidents recorded yet</Text>
        ) : (
          <Text style={styles.emptyReading}>No device connected</Text>
        )}

        <View style={styles.metricsRow}>
          <StatTile
            label="IMPACT"
            value={isLinked && telemetry ? telemetry.impactG.toFixed(2) : "--"}
            unit={isLinked && telemetry ? "G" : undefined}
            caption="impact force"
          />
          <StatTile
            label="ROTATION"
            value={isLinked && telemetry ? telemetry.gyroDps.toFixed(0) : "--"}
            unit={isLinked && telemetry ? "°/S" : undefined}
            caption="spin speed"
          />
          <StatTile
            label="LEAN"
            value={
              !isLinked || !telemetry
                ? "--"
                : telemetry.calibrated
                  ? String(Math.round(telemetry.tilt))
                  : "Not calibrated"
            }
            unit={isLinked && telemetry?.calibrated ? "°" : undefined}
            caption={isLinked && telemetry && !telemetry.calibrated ? undefined : "lean angle"}
            empty={isLinked && !!telemetry && !telemetry.calibrated}
          />
        </View>

        <Text style={styles.timestamp}>{isLinked && telemetry ? formatReadingTime(telemetry.receivedAt) : "--"}</Text>
      </GlassCard>

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
          Tap a severity to simulate a crash signal from the device. Severity 1 shows the 30s guardians-only
          countdown; severity 2+ shows the full crash-alert/dispatch flow.
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
        <Text style={[type.bodySmall, styles.debugCopy, styles.debugFaultCopy]}>
          Or simulate a device-health problem — this should never trigger the emergency flow.
        </Text>
        <View style={styles.debugFaultRow}>
          <Pressable style={styles.debugFaultButton} onPress={() => simulateFault?.()}>
            <Text style={styles.debugFaultButtonText}>SIMULATE FAULT</Text>
          </Pressable>
          <Pressable style={styles.debugFaultButton} onPress={() => clearSimulatedFault?.()}>
            <Text style={styles.debugFaultButtonText}>CLEAR FAULT</Text>
          </Pressable>
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
  locationBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,176,32,0.5)",
    backgroundColor: "rgba(255,176,32,0.12)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  locationBannerText: { ...type.bodySmall, color: "#FFB020" },
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
  readingCard: {},
  emptyReading: { color: colors.textDim, marginTop: spacing.md },
  readingSeverityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  severityNumber: { fontFamily: type.display.fontFamily, fontSize: 36 },
  severityTextCol: { flex: 1 },
  severityLabel: { color: colors.text, fontFamily: fontFamily.bodySemiBold, fontSize: 14 },
  triggerTextImpact: { color: colors.accent, marginTop: 2 },
  triggerTextTilt: { color: "#FFB020", marginTop: 2 },
  readingCopy: { color: colors.textMuted, marginTop: spacing.md },
  metricsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  timestamp: { color: colors.textDim, fontFamily: type.label.fontFamily, fontSize: 11, marginTop: spacing.md },
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
  debugFaultCopy: { marginBottom: spacing.sm },
  debugFaultRow: { flexDirection: "row", gap: spacing.sm },
  debugFaultButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.glassFillRaised,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  debugFaultButtonText: { color: colors.textMuted, fontFamily: type.button.fontFamily, fontSize: 11 },
});
