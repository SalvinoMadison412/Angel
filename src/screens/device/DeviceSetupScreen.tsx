import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader, Tag } from "../../components";
import { useCrashDetector } from "../../hooks";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation } from "../../navigation/types";

const STATE_LABEL: Record<string, string> = {
  disconnected: "NOT PAIRED",
  scanning: "SCANNING…",
  connecting: "CONNECTING…",
  connected: "CONNECTED",
  error: "ERROR",
};

export function DeviceSetupScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const {
    connectionState,
    errorMessage,
    discoveredDevices,
    pairedDevice,
    scan,
    connect,
    forgetDevice,
    checkAndroidLocationServicesDisabled,
  } = useCrashDetector();

  const [hasScanned, setHasScanned] = useState(false);
  const [locationServicesOff, setLocationServicesOff] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const stopScanRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopScanRef.current?.(), []);

  const handleScan = () => {
    setHasScanned(true);
    setLocationServicesOff(false);
    stopScanRef.current?.();
    stopScanRef.current = scan();
  };

  // If a scan comes back empty, Android often means "location services are
  // off" rather than "no device nearby" — the OS silently returns zero BLE
  // scan results in that case even with permission granted. Only check
  // after an actual scan attempt, so this doesn't show before the user has
  // done anything.
  useEffect(() => {
    if (!hasScanned || connectionState !== "disconnected" || discoveredDevices.length > 0) return;
    checkAndroidLocationServicesDisabled().then(setLocationServicesOff);
  }, [hasScanned, connectionState, discoveredDevices.length, checkAndroidLocationServicesDisabled]);

  const handleConnect = async (id: string, name: string) => {
    stopScanRef.current?.();
    setConnectingId(id);
    try {
      await connect(id, name);
    } finally {
      setConnectingId(null);
    }
  };

  const handleForget = async () => {
    await forgetDevice();
  };

  const isPaired = Boolean(pairedDevice) && connectionState !== "disconnected";
  const tagVariant = connectionState === "connected" ? "accent" : connectionState === "error" ? "outline" : "neutral";

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader title="PAIR DEVICE" onBack={() => navigation.goBack()} />

      <GlassCard style={styles.statusCard}>
        <Text style={[type.kicker, styles.dim]}>CRASHDETECTOR</Text>
        <View style={styles.statusRow}>
          <Text style={[type.title, styles.statusText]}>{STATE_LABEL[connectionState]}</Text>
          <Tag
            label={connectionState === "error" ? "ERROR" : connectionState === "connected" ? "READY" : "—"}
            variant={tagVariant}
          />
        </View>
        {pairedDevice && (
          <Text style={[type.bodySmall, styles.dim, styles.pairedName]}>Paired with {pairedDevice.name}</Text>
        )}
        {connectionState === "error" && errorMessage && (
          <Text style={[type.bodySmall, styles.errorText]}>{errorMessage}</Text>
        )}
      </GlassCard>

      {!isPaired && (
        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>WHY WE NEED THIS</Text>
          <Text style={[type.body, styles.copy]}>
            Angel scans for your CrashDetector sensor over Bluetooth Low Energy. Android requires location
            permission to perform any BLE scan — Angel does not use it to track your location for this step,
            only to discover nearby Bluetooth devices, which the OS ties to the location permission.
          </Text>
        </GlassCard>
      )}

      {!isPaired && (
        <PillButton
          title={connectionState === "scanning" ? "SCANNING…" : "SCAN FOR DEVICE"}
          onPress={handleScan}
          loading={connectionState === "scanning"}
          disabled={connectionState === "scanning"}
        />
      )}

      {!isPaired && connectionState === "disconnected" && discoveredDevices.length === 0 && locationServicesOff && (
        <GlassCard accentBorder>
          <Text style={[type.bodySmall, styles.copy]}>
            No devices found. On Android, BLE scanning also requires Location Services to be turned on in system
            settings — not just the app permission. Check that toggle and scan again.
          </Text>
        </GlassCard>
      )}

      {discoveredDevices.length > 0 && !isPaired && (
        <GlassCard style={styles.listCard} padded={false}>
          {discoveredDevices.map((device, index) => (
            <View key={device.id} style={[styles.deviceRow, index > 0 && styles.deviceRowDivider]}>
              <View>
                <Text style={[type.body, styles.statusText]}>{device.name}</Text>
                <Text style={[type.bodySmall, styles.dim]}>{device.id}</Text>
              </View>
              {connectingId === device.id ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.connectLink} onPress={() => handleConnect(device.id, device.name)}>
                  CONNECT
                </Text>
              )}
            </View>
          ))}
        </GlassCard>
      )}

      {isPaired && (
        <PillButton title="FORGET DEVICE" variant="outline" onPress={handleForget} />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  statusCard: {},
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  statusText: { color: colors.text },
  dim: { color: colors.textDim },
  pairedName: { marginTop: spacing.sm },
  errorText: { color: colors.danger, marginTop: spacing.sm },
  copy: { color: colors.textMuted },
  listCard: { paddingVertical: spacing.sm },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  deviceRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  connectLink: {
    color: colors.accent,
    fontFamily: type.button.fontFamily,
    fontSize: 12,
    letterSpacing: 1,
  },
});
