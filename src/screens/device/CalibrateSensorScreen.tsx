import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text } from "react-native";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { useCrashDetector, useDevice } from "../../hooks";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

type Status = "idle" | "calibrating" | "success" | "error";

/**
 * Reused for both first-time setup (pushed by DeviceSetupScreen right
 * after a successful pair, with `mandatory: true`) and later recalibration
 * (reachable from the Device tab, no param) — the only difference is copy
 * plus whether it can be skipped, driven by whether the device's stored
 * `calibrated` flag is already true.
 *
 * `mandatory` blocks the skip button and back navigation so uncalibrated
 * tilt data can't slip through unnoticed — but only while nothing has gone
 * wrong yet. Once a calibration attempt actually fails, the escape hatches
 * come back so a genuinely broken sensor doesn't trap the rider on this
 * screen with no way out.
 */
export function CalibrateSensorScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "CalibrateSensor">>();
  const mandatory = route.params?.mandatory ?? false;
  const { connectionState, calibrate } = useCrashDetector();
  const { data: device, ensureDevice, setCalibrated } = useDevice();

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRecalibration = Boolean(device?.calibrated);
  const connected = connectionState === "connected";
  const canLeave = !mandatory || status === "error";

  useEffect(() => {
    if (canLeave) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [canLeave]);

  const handleCalibrate = async () => {
    setStatus("calibrating");
    setErrorMessage(null);
    try {
      await calibrate();
      if (!device) {
        await ensureDevice.mutateAsync();
      }
      await setCalibrated.mutateAsync(true);
      setStatus("success");
    } catch (err) {
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

      {!connected && status !== "success" && (
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

          <PillButton title="CALIBRATE" onPress={handleCalibrate} disabled={!connected} style={styles.cta} />
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
          <PillButton title="RETRY" onPress={handleCalibrate} disabled={!connected} style={styles.cta} />
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
  successText: { color: colors.success },
  errorLabel: { color: colors.danger },
});
