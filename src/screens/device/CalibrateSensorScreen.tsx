import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text } from "react-native";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { useCrashDetector, useDevice } from "../../hooks";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

type Status = "idle" | "calibrating" | "success" | "error";

// How long to wait for the calibration_complete notification after a
// successful calibrate() write before giving up — BLE notifications can
// occasionally be missed, so this must not wait forever.
const CONFIRMATION_TIMEOUT_MS = 5000;

// TEMP DIAGNOSTIC LOGGING — see crashDetectorBle.ts's bleOpLog for why.
function calibrateLog(...args: unknown[]) {
  console.log(`[CALIBRATE][${new Date().toISOString()}]`, ...args);
}

/**
 * Reused for both first-time setup (pushed by DeviceSetupScreen right
 * after a successful pair, with `mandatory: true`) and later recalibration
 * (reachable from the Device tab, no param) — the only difference is copy
 * plus whether it can be skipped, driven by whether the device's stored
 * `calibrated` flag is already true.
 *
 * Calibration is asynchronous on the firmware side: the calibrate() write
 * just acks receipt, and the device reports whether it actually finished
 * and stored a reference separately, via a calibration_complete
 * notification — see services/bluetooth/types.ts. So "success" here is
 * driven by that notification arriving, not by the write resolving.
 *
 * `mandatory` blocks the skip button and back navigation so uncalibrated
 * tilt data can't slip through unnoticed — but only while nothing has gone
 * wrong yet. Once a calibration attempt actually fails (including timing
 * out waiting for confirmation), the escape hatches come back so a
 * genuinely broken sensor doesn't trap the rider on this screen with no
 * way out.
 */
export function CalibrateSensorScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "CalibrateSensor">>();
  const mandatory = route.params?.mandatory ?? false;
  // `isLinked` is debounced (see useCrashDetector) so a sub-2s reconnect
  // blip doesn't yank this screen's UI or fail an in-progress attempt —
  // only a drop that outlasts the grace window counts as really gone.
  const { isLinked, calibrate, calibrationConfirmation } = useCrashDetector();
  const { data: device, ensureDevice, setCalibrated } = useDevice();

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Marks when the current attempt started waiting for a confirmation, so a
  // confirmation left over from an earlier attempt (or from before this
  // screen even mounted) isn't mistaken for this one's result.
  const waitStartedAtRef = useRef<number | null>(null);
  // Reentrancy guard — belt-and-suspenders alongside the button only ever
  // being rendered outside "calibrating": a double-tap on the same gesture
  // can fire before React commits the status change that hides it.
  const inFlightRef = useRef(false);

  const isRecalibration = Boolean(device?.calibrated);
  const canLeave = !mandatory || status === "error";

  useEffect(() => {
    if (status !== "calibrating") inFlightRef.current = false;
  }, [status]);

  useEffect(() => {
    if (canLeave) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [canLeave]);

  // The authoritative "did it actually work" signal — fires when a fresh
  // calibration_complete notification arrives while we're waiting on one.
  useEffect(() => {
    if (status !== "calibrating" || !calibrationConfirmation) return;
    if (waitStartedAtRef.current === null || calibrationConfirmation.receivedAt < waitStartedAtRef.current) {
      calibrateLog(
        `calibrationConfirmation received but IGNORED — stale (receivedAt=${calibrationConfirmation.receivedAt}, waitStartedAt=${waitStartedAtRef.current})`
      );
      return;
    }

    if (calibrationConfirmation.calibrated) {
      calibrateLog(`calibrationConfirmation received: calibrated=true — SUCCESS`);
      if (!device || !device.calibrated) {
        setCalibrated.mutate(true);
      }
      setStatus("success");
    } else {
      calibrateLog(`calibrationConfirmation received: calibrated=false — device-reported FAILURE`);
      // The device itself is telling us the average didn't take (e.g. it
      // moved mid-sample) — a real failure, not a dropped notification.
      setStatus("error");
      setErrorMessage("The sensor reported calibration didn't take — keep the bike completely still and try again.");
    }
  }, [calibrationConfirmation, status, device, setCalibrated]);

  // Don't wait forever for a notification that might never arrive.
  useEffect(() => {
    if (status !== "calibrating") return;
    const timer = setTimeout(() => {
      calibrateLog(`CONFIRMATION TIMEOUT — no calibration_complete within ${CONFIRMATION_TIMEOUT_MS}ms`);
      setStatus("error");
      setErrorMessage(
        "No confirmation came back from the sensor — the signal may have been missed. Check it's still nearby and try again."
      );
    }, CONFIRMATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // No point waiting out the full timeout if the link itself already died —
  // but only once a drop is confirmed past the debounce grace window, not
  // on every momentary blip (that's the whole point of `isLinked`).
  useEffect(() => {
    if (status !== "calibrating" || isLinked) return;
    calibrateLog(`CONNECTION LOST mid-wait (isLinked went false while status=calibrating) — failing attempt`);
    setStatus("error");
    setErrorMessage("Connection to the sensor was lost before calibration finished. Reconnect and try again.");
  }, [status, isLinked]);

  const handleCalibrate = async () => {
    if (inFlightRef.current) {
      calibrateLog(`handleCalibrate() called but IGNORED — already in flight`);
      return; // already calibrating — ignore a stray double-tap
    }
    calibrateLog(`handleCalibrate() START — isLinked=${isLinked}`);
    inFlightRef.current = true;
    setStatus("calibrating");
    setErrorMessage(null);
    waitStartedAtRef.current = Date.now();
    try {
      calibrateLog(`calling calibrate() (the GATT write)`);
      await calibrate();
      calibrateLog(`calibrate() write acked — now waiting for calibration_complete notification`);
      if (!device) {
        await ensureDevice.mutateAsync();
      }
      // Deliberately no setStatus("success") here — the write ack only
      // means the device received the command, not that calibration
      // finished. The effects above resolve this from here.
    } catch (err) {
      calibrateLog(`calibrate() write REJECTED:`, err instanceof Error ? err.message : err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Calibration failed — check the sensor is connected.");
    }
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader
        title={isRecalibration ? "RECALIBRATE SENSOR" : "CALIBRATE SENSOR"}
        onBack={canLeave ? () => navigation.goBack() : undefined}
      />

      {mandatory && (status === "idle" || status === "calibrating") && (
        <GlassCard accentBorder>
          <Text style={[type.kicker, styles.accentText]}>REQUIRED BEFORE YOU RIDE</Text>
          <Text style={[type.bodySmall, styles.copy, styles.hint]}>
            Tilt readings are meaningless without this — calibrate now so a crash reading can be trusted.
          </Text>
        </GlassCard>
      )}

      {!isLinked && status !== "success" && (
        <GlassCard accentBorder>
          <Text style={[type.body, styles.copy]}>
            The sensor isn't connected right now. Reconnect it before calibrating — the calibration write needs an
            active connection to the device.
          </Text>
        </GlassCard>
      )}

      {status === "idle" && (
        <>
          <GlassCard>
            <Text style={[type.kicker, styles.dim]}>{isRecalibration ? "RECALIBRATION" : "BEFORE YOU START"}</Text>
            <Text style={[type.body, styles.copy]}>
              Mount the sensor on your bike now if you haven't already. Once it's in its final position, park the
              bike upright on level ground, stay off it, and tap Calibrate.
            </Text>
            {isRecalibration && (
              <Text style={[type.bodySmall, styles.dim, styles.hint]}>
                Recalibrating replaces the sensor's stored reference — only do this once it's remounted where you
                want it to stay for good.
              </Text>
            )}
          </GlassCard>

          <PillButton title="CALIBRATE" onPress={handleCalibrate} disabled={!isLinked} style={styles.cta} />
          {canLeave && <PillButton title="SKIP FOR NOW" variant="ghost" onPress={() => navigation.goBack()} />}
        </>
      )}

      {status === "calibrating" && (
        <GlassCard style={styles.centeredCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[type.title, styles.holdStill]}>Hold still…</Text>
          <Text style={[type.bodySmall, styles.dim, styles.centeredText]}>
            The sensor is averaging samples — keep the bike upright and don't touch it for a second.
          </Text>
        </GlassCard>
      )}

      {status === "success" && (
        <>
          <GlassCard style={styles.centeredCard}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={[type.title, styles.successText]}>Calibration complete</Text>
            <Text style={[type.bodySmall, styles.dim, styles.centeredText]}>
              The sensor now reports tilt relative to this mounting position.
            </Text>
          </GlassCard>
          <PillButton title="DONE" onPress={() => navigation.goBack()} style={styles.cta} />
        </>
      )}

      {status === "error" && (
        <>
          <GlassCard accentBorder>
            <Text style={[type.kicker, styles.errorLabel]}>CALIBRATION FAILED</Text>
            <Text style={[type.body, styles.copy]}>{errorMessage}</Text>
          </GlassCard>
          <PillButton title="RETRY" onPress={handleCalibrate} disabled={!isLinked} style={styles.cta} />
          <PillButton title="SKIP FOR NOW" variant="ghost" onPress={() => navigation.goBack()} />
        </>
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  dim: { color: colors.textDim },
  accentText: { color: colors.accent },
  copy: { color: colors.textMuted },
  hint: { marginTop: spacing.md },
  cta: { marginTop: spacing.sm },
  centeredCard: { alignItems: "center", paddingVertical: spacing.xxl },
  centeredText: { textAlign: "center", marginTop: spacing.sm },
  holdStill: { color: colors.text, marginTop: spacing.lg },
  checkmark: { color: colors.success, fontSize: 40, fontFamily: type.display.fontFamily },
  successText: { color: colors.success, marginTop: spacing.md },
  errorLabel: { color: colors.danger },
});
