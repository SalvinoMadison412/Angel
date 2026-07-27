import { useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, Tag } from "../../components";
import { useCrashDetector, useDevice } from "../../hooks";
import { colors, spacing, type } from "../../theme";
import { AppTabNavigation } from "../../navigation/types";

const BLE_STATE_LABEL: Record<string, string> = {
  disconnected: "NOT PAIRED",
  scanning: "SCANNING…",
  connecting: "CONNECTING…",
  connected: "CONNECTED",
  error: "CONNECTION ERROR",
};

export function DeviceScreen() {
  const navigation = useNavigation<AppTabNavigation<"Device">>();
  const { data: device, ensureDevice } = useDevice();
  const { connectionState, pairedDevice } = useCrashDetector();

  const isPaired = device?.pairing_status === "paired";
  const bleConnected = connectionState === "connected";

  const handleCalibrate = async () => {
    if (!device) {
      await ensureDevice.mutateAsync();
    }
    navigation.navigate("Calibration");
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <Text style={[type.title, styles.title]}>Device</Text>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>BLUETOOTH</Text>
        <View style={styles.statusRow}>
          <Text style={[type.title, styles.statusText]}>{BLE_STATE_LABEL[connectionState]}</Text>
          <Tag label={bleConnected ? "READY" : "ACTION NEEDED"} variant={bleConnected ? "accent" : "neutral"} />
        </View>
        {pairedDevice && (
          <Text style={[type.bodySmall, styles.dim, styles.pairedName]}>{pairedDevice.name}</Text>
        )}
        <PillButton
          title={pairedDevice ? "MANAGE DEVICE" : "PAIR DEVICE"}
          variant="outline"
          onPress={() => navigation.navigate("DeviceSetup")}
          style={styles.pairButton}
        />
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>PAIRING STATUS</Text>
        <View style={styles.statusRow}>
          <Text style={[type.title, styles.statusText]}>
            {isPaired ? "PAIRED" : device?.pairing_status === "pairing" ? "PAIRING" : "NOT PAIRED"}
          </Text>
          <Tag label={isPaired ? "READY" : "ACTION NEEDED"} variant={isPaired ? "accent" : "neutral"} />
        </View>
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

      <PillButton
        title={isPaired ? "RE-CALIBRATE" : "PAIR & CALIBRATE"}
        onPress={handleCalibrate}
        loading={ensureDevice.isPending}
      />
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  statusText: { color: colors.text },
  pairedName: { marginTop: spacing.xs },
  pairButton: { marginTop: spacing.lg },
  offsetRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md },
  offsetItem: { alignItems: "center" },
  offsetLabel: { color: colors.textMuted, fontFamily: type.kicker.fontFamily, fontSize: 11 },
  offsetValue: { color: colors.text, fontFamily: type.statValue.fontFamily, fontSize: 20, marginTop: 4 },
  hint: { color: colors.textMuted, marginTop: spacing.lg },
});
