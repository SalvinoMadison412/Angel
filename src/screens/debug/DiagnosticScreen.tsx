import { useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard, ScreenBackground, ScreenHeader } from "../../components";
import { useCrashDetector, useCrashDetectorTelemetry } from "../../hooks";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation } from "../../navigation/types";

// TEMP DIAGNOSTIC SCREEN — shows the raw values the app has actually
// received from the device over BLE, live, updating the instant a new
// notification arrives (same useCrashDetector() hook every other screen
// uses — nothing special-cased here). Built to answer one question
// directly, on-device: is data from the Arduino actually reaching the app
// at all. Originally built for the calibration_complete investigation;
// also covers telemetry now — if this stays empty while isLinked is true,
// see the MTU/truncation diagnostics in crashDetectorBle.ts's
// handleNotification (logcat tag [BLE-PACKET]).
export function DiagnosticScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const { isLinked, isReconnecting, lastEvent, fault, calibrationConfirmation } = useCrashDetector();
  const telemetry = useCrashDetectorTelemetry();

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader title="RAW BLE DIAGNOSTIC" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <Text style={[type.bodySmall, styles.hint]}>
          This screen updates live as raw messages arrive over BLE. Leave it open, then trigger the sensor (tap it,
          or tap Recalibrate) and watch for a new value below.
        </Text>

        <Section title="CONNECTION">
          <Row label="isLinked" value={String(isLinked)} />
          <Row label="isReconnecting" value={String(isReconnecting)} />
        </Section>

        <Section title="LAST TELEMETRY (type: telemetry)">
          {telemetry ? (
            <>
              <Row label="impactG" value={telemetry.impactG.toFixed(3)} />
              <Row label="gyroDps" value={telemetry.gyroDps.toFixed(1)} />
              <Row label="tilt" value={telemetry.tilt.toFixed(1)} />
              <Row label="still" value={String(telemetry.still)} />
              <Row label="calibrated" value={String(telemetry.calibrated)} />
              <Row label="receivedAt" value={new Date(telemetry.receivedAt).toLocaleTimeString("en-IN", { hour12: false })} />
            </>
          ) : (
            <Text style={styles.empty}>
              {isLinked ? "Connected, but no telemetry received yet — check logcat for [BLE-PACKET]" : "Nothing received yet"}
            </Text>
          )}
        </Section>

        <Section title="LAST CRASH EVENT (type: crash)">
          {lastEvent ? (
            <>
              <Row label="trigger" value={lastEvent.trigger} />
              <Row label="severity" value={String(lastEvent.severity)} />
              <Row label="impactG" value={lastEvent.impactG.toFixed(3)} />
              <Row label="gyroDps" value={lastEvent.gyroDps.toFixed(1)} />
              <Row label="tilt" value={lastEvent.tilt.toFixed(1)} />
              <Row label="still" value={String(lastEvent.still)} />
              <Row label="calibrated" value={String(lastEvent.calibrated)} />
              <Row label="receivedAt" value={new Date(lastEvent.receivedAt).toLocaleTimeString("en-IN", { hour12: false })} />
            </>
          ) : (
            <Text style={styles.empty}>Nothing received yet</Text>
          )}
        </Section>

        <Section title="LAST CALIBRATION CONFIRMATION (type: calibration_complete)">
          {calibrationConfirmation ? (
            <>
              <Row label="calibrated" value={String(calibrationConfirmation.calibrated)} />
              <Row
                label="receivedAt"
                value={new Date(calibrationConfirmation.receivedAt).toLocaleTimeString("en-IN", { hour12: false })}
              />
            </>
          ) : (
            <Text style={styles.empty}>Nothing received yet</Text>
          )}
        </Section>

        <Section title="LAST FAULT (type: fault)">
          {fault ? (
            <>
              <Row label="reason" value={fault.reason} />
              <Row label="receivedAt" value={new Date(fault.receivedAt).toLocaleTimeString("en-IN", { hour12: false })} />
            </>
          ) : (
            <Text style={styles.empty}>Nothing received yet</Text>
          )}
        </Section>
      </View>
    </ScreenBackground>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard style={styles.section}>
      <Text style={[type.kicker, styles.sectionTitle]}>{title}</Text>
      {children}
    </GlassCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  body: { paddingHorizontal: spacing.xl, gap: spacing.lg, marginTop: spacing.md },
  hint: { color: colors.textMuted },
  section: {},
  sectionTitle: { color: colors.accent, marginBottom: spacing.md },
  empty: { color: colors.textDim, ...type.bodySmall },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  rowLabel: { color: colors.textDim, fontFamily: type.label.fontFamily, fontSize: 12 },
  rowValue: { color: colors.text, fontFamily: type.label.fontFamily, fontSize: 12 },
});
