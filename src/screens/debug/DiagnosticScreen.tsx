import { useNavigation } from "@react-navigation/native";
import React, { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { useCrashDetector, useCrashDetectorTelemetry, usePermissionSnapshot } from "../../hooks";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation } from "../../navigation/types";
import { publishInAppAlert } from "../../services/notifications/inAppAlertBus";
import { presentCrashConfirmedAlertForPreview, presentSpeedAlertForPreview } from "../../services/notifications/angelAlerts";
import { dismissCountdownNotification, presentCountdownNotification } from "../../services/notifications/countdownNotification";
import { triggerDebugPermissionBanner } from "../../services/permissions/debugBanner";

const COUNTDOWN_PREVIEW_TOTAL_SECONDS = 10;

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
  const permissions = usePermissionSnapshot();
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drives the real presentCountdownNotification() on a short local tick —
  // not a real CrashEvent, just enough to see the notification actually
  // count down and confirm CANCEL ALERT works from the shade. Stops itself
  // at zero; the STOP button below also clears it early.
  const startCountdownPreview = () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    let secondsLeft = COUNTDOWN_PREVIEW_TOTAL_SECONDS;
    presentCountdownNotification(secondsLeft, COUNTDOWN_PREVIEW_TOTAL_SECONDS);
    countdownTimer.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        dismissCountdownNotification();
        return;
      }
      presentCountdownNotification(secondsLeft, COUNTDOWN_PREVIEW_TOTAL_SECONDS);
    }, 1000);
  };

  const stopCountdownPreview = () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    dismissCountdownNotification();
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader title="RAW BLE DIAGNOSTIC" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <Text style={[type.bodySmall, styles.hint]}>
          This screen updates live as raw messages arrive over BLE. Leave it open, then trigger the sensor (tap it,
          or tap Recalibrate) and watch for a new value below.
        </Text>

        {/* __DEV__-gated on top of this screen's own __DEV__-only entry point
            (see the "VIEW RAW BLE DATA" button in DeviceScreen.tsx) — belt
            and suspenders, since this fires real local notifications and a
            fake permission-revoked banner that a production build should
            never be able to trigger. */}
        {__DEV__ && (
          <Section title="NOTIFICATION PREVIEW">
            <Text style={[type.bodySmall, styles.hint, styles.previewHint]}>
              Fires each notification/banner exactly as production code would — check title, body, icon, color, and
              placement against the AGENTS.md spec.
            </Text>
            <PillButton
              title="TEST CRASH NOTIFICATION"
              variant="outline"
              onPress={() => presentCrashConfirmedAlertForPreview()}
              style={styles.testButton}
            />
            <PillButton
              title="TEST SPEED ALERT"
              variant="outline"
              onPress={() => presentSpeedAlertForPreview()}
              style={styles.testButton}
            />
            <PillButton
              title="TEST IN-APP BANNER (CRASH)"
              variant="outline"
              onPress={() =>
                publishInAppAlert(
                  "crash",
                  "⚠️ ANGEL — CRASH DETECTED",
                  "A crash has been detected. Guardian alert sent. Tap to open Angel."
                )
              }
              style={styles.testButton}
            />
            <PillButton
              title="TEST IN-APP BANNER (SPEED)"
              variant="outline"
              onPress={() =>
                publishInAppAlert("speed", "🏎️ ANGEL — SPEED ALERT", "You are riding above 80 km/h. Ride safe.")
              }
              style={styles.testButton}
            />
            <PillButton
              title="TEST PERMISSION BANNER"
              variant="outline"
              onPress={() => triggerDebugPermissionBanner()}
              style={styles.testButton}
            />
            <PillButton
              title="TEST COUNTDOWN NOTIFICATION (10S)"
              variant="outline"
              onPress={startCountdownPreview}
              style={styles.testButton}
            />
            <PillButton
              title="STOP COUNTDOWN NOTIFICATION"
              variant="outline"
              onPress={stopCountdownPreview}
              style={styles.testButton}
            />
          </Section>
        )}

        <Section title="PERMISSIONS">
          <Row label="notifications" value={String(permissions.notifications)} />
          <Row label="locationForeground" value={String(permissions.locationForeground)} />
          <Row label="locationForegroundPrecise" value={String(permissions.locationForegroundPrecise)} />
          <Row label="locationBackground" value={String(permissions.locationBackground)} />
          <Row label="bluetooth" value={String(permissions.bluetooth)} />
        </Section>

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
  testButton: { marginTop: spacing.sm },
  previewHint: { marginBottom: spacing.sm },
  empty: { color: colors.textDim, ...type.bodySmall },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  rowLabel: { color: colors.textDim, fontFamily: type.label.fontFamily, fontSize: 12 },
  rowValue: { color: colors.text, fontFamily: type.label.fontFamily, fontSize: 12 },
});
