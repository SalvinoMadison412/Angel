import { useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, Tag } from "../../components";
import { useCrashDetector, useDevice } from "../../hooks";
import { colors, spacing, type } from "../../theme";
import { AppTabNavigation } from "../../navigation/types";

const BLE_STATE_LABEL: Record<string, string> = {
  disconnected: "NOT CONNECTED",
  scanning: "SCANNING…",
  connecting: "CONNECTING…",
  connected: "CONNECTED",
  error: "CONNECTION ERROR",
};

export function DeviceScreen() {
  const navigation = useNavigation<AppTabNavigation<"Device">>();
  const { data: device } = useDevice();
  const { connectionState, isLinked, isReconnecting, pairedDevice, fault } = useCrashDetector();

  // Debounced (see useCrashDetector) so a sub-2s reconnect blip doesn't
  // flip this card's status/label/button between connected and not.
  const bleStatusLabel = isReconnecting ? "RECONNECTING…" : BLE_STATE_LABEL[connectionState];

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <Text style={[type.title, styles.title]}>Device</Text>

      {fault && (
        <GlassCard accentBorder>
          <Text style={[type.kicker, styles.faultTitle]}>⚠ SENSOR NOT RESPONDING</Text>
          <Text style={[type.bodySmall, styles.faultCopy]}>
            Check the device and its mounting — a loose connector or a dead battery are the usual causes. This is a
            device problem, not a crash; no one has been alerted.
          </Text>
        </GlassCard>
      )}

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>BLUETOOTH</Text>
        <View style={styles.statusRow}>
          <Text style={[type.title, styles.statusText]}>{bleStatusLabel}</Text>
          <Tag label={isLinked ? "READY" : "ACTION NEEDED"} variant={isLinked ? "accent" : "neutral"} />
        </View>
        {isLinked && pairedDevice && (
          <Text style={[type.bodySmall, styles.dim, styles.pairedName]}>{pairedDevice.name}</Text>
        )}
        <PillButton
          title={isLinked ? "MANAGE DEVICE" : "PAIR DEVICE"}
          variant="outline"
          onPress={() => navigation.navigate("DeviceSetup")}
          style={styles.pairButton}
        />
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>SENSOR CALIBRATION</Text>
        <View style={styles.statusRow}>
          <Text style={[type.title, styles.statusText]}>{device?.calibrated ? "CALIBRATED" : "NOT CALIBRATED"}</Text>
          <Tag
            label={device?.calibrated ? "READY" : "ACTION NEEDED"}
            variant={device?.calibrated ? "accent" : "neutral"}
          />
        </View>
        <Text style={[type.bodySmall, styles.hint]}>
          {device?.calibrated
            ? "Recalibrate any time the sensor is remounted — a battery swap, a fall that shifts the mount, or a new bike."
            : "Tilt readings from a crash aren't reliable until the sensor's mounting position is calibrated."}
        </Text>
        <PillButton
          title={device?.calibrated ? "RECALIBRATE SENSOR" : "CALIBRATE SENSOR"}
          variant="outline"
          onPress={() => navigation.navigate("CalibrateSensor")}
          style={styles.pairButton}
        />
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>CALIBRATION OFFSETS</Text>
        <View style={styles.offsetRow}>
          <OffsetStat label="X" value={device?.calibration_offset_x ?? 0} />
          <OffsetStat label="Y" value={device?.calibration_offset_y ?? 0} />
          <OffsetStat label="Z" value={device?.calibration_offset_z ?? 0} />
        </View>
        <Text style={[type.bodySmall, styles.hint]}>
          Every mount sits at a different angle. Re-calibrate any time the device is remounted.
        </Text>
      </GlassCard>
    </ScreenBackground>
  );
}

function OffsetStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.offsetItem}>
      <Text style={styles.offsetLabel}>{label}</Text>
      <Text style={styles.offsetValue}>{value.toFixed(2)}°</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  title: { color: colors.text },
  dim: { color: colors.textDim },
  faultTitle: { color: colors.danger },
  faultCopy: { color: colors.textMuted, marginTop: spacing.sm },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // Wrap rather than squeeze: past a certain label length or font scale
    // there isn't room for both, and shrinking the label alone breaks it
    // mid-word. The pill drops to its own line instead.
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statusText: { color: colors.text, flexShrink: 1 },
  pairedName: { marginTop: spacing.xs },
  pairButton: { marginTop: spacing.lg },
  offsetRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md },
  offsetItem: { alignItems: "center" },
  offsetLabel: { color: colors.textMuted, fontFamily: type.kicker.fontFamily, fontSize: 11 },
  offsetValue: { color: colors.text, fontFamily: type.statValue.fontFamily, fontSize: 20, marginTop: 4 },
  hint: { color: colors.textMuted, marginTop: spacing.lg },
});
