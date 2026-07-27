import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard, GyroDial, PillButton, ScreenBackground, ScreenHeader, StepProgress } from "../../components";
import { useDevice } from "../../hooks";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation } from "../../navigation/types";

type Axis = { pitch: number; roll: number; yaw: number };

export function CalibrationWizard() {
  const navigation = useNavigation<RootStackNavigation>();
  const { saveCalibration } = useDevice();

  const [step, setStep] = useState(1);
  const [live, setLive] = useState<Axis>({ pitch: 3.4, roll: -1.8, yaw: 12.6 });
  const [calibrating, setCalibrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zeroed, setZeroed] = useState(false);

  useEffect(() => {
    if (step !== 2 || calibrating || zeroed) return;
    const id = setInterval(() => {
      setLive((prev) => ({
        pitch: clampSmall(prev.pitch + (Math.random() - 0.5) * 0.6),
        roll: clampSmall(prev.roll + (Math.random() - 0.5) * 0.6),
        yaw: clampSmall(prev.yaw + (Math.random() - 0.5) * 1.2, 20),
      }));
    }, 500);
    return () => clearInterval(id);
  }, [step, calibrating, zeroed]);

  const handleCalibrate = () => {
    setCalibrating(true);
    setProgress(0);
    const id = setInterval(() => {
      setProgress((p) => {
        const next = p + 8;
        if (next >= 100) {
          clearInterval(id);
          setCalibrating(false);
          setZeroed(true);
          return 100;
        }
        return next;
      });
    }, 120);
  };

  const handleFinish = async () => {
    await saveCalibration.mutateAsync({ x: -live.pitch, y: -live.roll, z: -live.yaw });
    navigation.goBack();
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        right={step === 1 ? <Text style={styles.skip} onPress={() => setStep(2)}>SKIP</Text> : undefined}
      />
      <View style={styles.progressWrap}>
        <StepProgress steps={3} current={step} />
        <Text style={[type.kicker, styles.stepLabel]}>STEP {step} OF 3</Text>
      </View>

      {step === 1 && (
        <View style={styles.stepBody}>
          <Text style={[type.title, styles.heading]}>Mount the device</Text>
          <Text style={[type.body, styles.copy]}>
            Fix Angel to the frame near the seat post, sensor face up. Once it's mounted securely, we'll zero the
            axes to your bike's resting angle.
          </Text>
          <PillButton title="CONTINUE" onPress={() => setStep(2)} style={styles.cta} />
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepBody}>
          <Text style={[type.title, styles.heading]}>Zero the axes</Text>
          <Text style={[type.body, styles.copy]}>
            Every mount sits at a different angle. Park the bike upright on level ground, keep it still, and Angel
            will learn its own zero.
          </Text>

          <GlassCard style={styles.dialCard}>
            <View style={styles.dialHeader}>
              <Text style={[type.kicker, styles.dim]}>GYRO // IMU-6050</Text>
              <Text style={[type.kicker, zeroed ? styles.zeroedText : styles.dim]}>
                {zeroed ? "ZEROED" : calibrating ? "SAMPLING…" : "AWAITING ZERO"}
              </Text>
            </View>
            <View style={styles.dialWrap}>
              <GyroDial pitch={live.pitch} roll={live.roll} yaw={live.yaw} />
            </View>
          </GlassCard>

          <AxisBar label="X — PITCH" value={live.pitch} progress={progress} />
          <AxisBar label="Y — ROLL" value={live.roll} progress={progress} />
          <AxisBar label="Z — YAW" value={live.yaw} progress={progress} />

          <Text style={[type.kicker, styles.instruction]}>KEEP THE BIKE UPRIGHT AND COMPLETELY STILL</Text>

          <PillButton
            title={zeroed ? "CONTINUE" : "CALIBRATE NOW"}
            onPress={zeroed ? () => setStep(3) : handleCalibrate}
            loading={calibrating}
            style={styles.cta}
          />
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepBody}>
          <Text style={[type.title, styles.heading]}>Locked in</Text>
          <Text style={[type.body, styles.copy]}>
            These offsets are saved to your device profile and applied to every future reading.
          </Text>

          <GlassCard style={styles.dialCard}>
            <AxisSummary label="X — PITCH" value={-live.pitch} />
            <AxisSummary label="Y — ROLL" value={-live.roll} />
            <AxisSummary label="Z — YAW" value={-live.yaw} />
          </GlassCard>

          <PillButton title="FINISH" onPress={handleFinish} loading={saveCalibration.isPending} style={styles.cta} />
        </View>
      )}
    </ScreenBackground>
  );
}

function clampSmall(v: number, max = 6) {
  return Math.max(-max, Math.min(max, v));
}

function AxisBar({ label, value, progress }: { label: string; value: number; progress: number }) {
  return (
    <GlassCard style={styles.axisCard}>
      <View style={styles.axisRow}>
        <Text style={[type.kicker, styles.dim]}>{label}</Text>
        <Text style={[type.statValue, styles.axisValue]}>{value.toFixed(2)}°</Text>
      </View>
      <View style={styles.axisTrack}>
        <View style={[styles.axisFill, { width: `${progress}%` }]} />
      </View>
    </GlassCard>
  );
}

function AxisSummary({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[type.kicker, styles.dim]}>{label}</Text>
      <Text style={[type.body, styles.summaryValue]}>{value.toFixed(2)}°</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  progressWrap: { marginBottom: spacing.xl },
  stepLabel: { color: colors.textDim, textAlign: "center", marginTop: spacing.md },
  skip: { color: colors.textMuted, fontFamily: type.button.fontFamily, fontSize: 12, letterSpacing: 1.5 },
  stepBody: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  heading: { color: colors.text },
  copy: { color: colors.textMuted },
  dim: { color: colors.textDim },
  dialCard: { alignItems: "center" },
  dialHeader: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  zeroedText: { color: colors.success },
  dialWrap: { marginTop: spacing.lg },
  axisCard: {},
  axisRow: { flexDirection: "row", justifyContent: "space-between" },
  axisValue: { color: colors.text, fontSize: 18 },
  axisTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glassBorder,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  axisFill: { height: 4, backgroundColor: colors.text },
  instruction: { color: colors.textDim, textAlign: "center" },
  cta: { marginTop: spacing.md },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: spacing.sm,
  },
  summaryValue: { color: colors.text },
});
