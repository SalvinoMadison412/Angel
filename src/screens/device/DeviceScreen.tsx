import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, Tag } from "../../components";
import { useCrashDetector, useDevice } from "../../hooks";
import { colors, radius, spacing, type } from "../../theme";
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
  const { data: device, ensureDevice, saveBikeInfo } = useDevice();
  const { connectionState, pairedDevice } = useCrashDetector();

  const isPaired = device?.pairing_status === "paired";
  const bleConnected = connectionState === "connected";

  const [bikeMake, setBikeMake] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const bikeInitialized = useRef(false);

  useEffect(() => {
    if (bikeInitialized.current || !device) return;
    bikeInitialized.current = true;
    setBikeMake(device.bike_make ?? "");
    setBikeModel(device.bike_model ?? "");
  }, [device]);

  const handleSaveBike = () => {
    saveBikeInfo.mutate({ bikeMake: bikeMake.trim() || null, bikeModel: bikeModel.trim() || null });
  };

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
        <Text style={[type.kicker, styles.dim]}>BIKE</Text>
        <Text style={[type.bodySmall, styles.hint, styles.bikeHint]}>
          Links this bike to whichever sensor you pair — purely organizational.
        </Text>
        <TextInput
          value={bikeMake}
          onChangeText={setBikeMake}
          placeholder="Make (e.g. Honda)"
          placeholderTextColor={colors.textDim}
          style={[styles.input, styles.fieldSpacing]}
          underlineColorAndroid="transparent"
        />
        <TextInput
          value={bikeModel}
          onChangeText={setBikeModel}
          placeholder="Model (e.g. Activa 125)"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          underlineColorAndroid="transparent"
        />
        <PillButton
          title="SAVE"
          variant="outline"
          onPress={handleSaveBike}
          loading={saveBikeInfo.isPending}
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
  bikeHint: { marginTop: spacing.sm, marginBottom: spacing.md },
  input: {
    ...type.body,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.glassFillRaised,
  },
  fieldSpacing: { marginBottom: spacing.md },
});
