import React from "react";
import { SafeAreaView, StyleSheet, Text } from "react-native";
import { useCrashDetector } from "../../hooks";
import { colors } from "../../theme";

// TEMP DEV TOOL — plain raw-sensor readout from the same BLE characteristic
// the rest of the app uses (see useCrashDetector). No polish intended.
export function DebugScreen() {
  const { isLinked, lastEvent } = useCrashDetector();

  return (
    <SafeAreaView style={styles.container}>
      {!isLinked ? (
        <Text style={styles.text}>Not connected</Text>
      ) : (
        <>
          <Text style={styles.text}>Tilt: {lastEvent ? lastEvent.tilt.toFixed(1) : "--"}°</Text>
          <Text style={styles.text}>Impact: {lastEvent ? lastEvent.impactG.toFixed(2) : "--"}g</Text>
          <Text style={styles.text}>Gyro: {lastEvent ? lastEvent.gyroDps.toFixed(1) : "--"}°/s</Text>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 8 },
  text: { color: colors.text, fontSize: 16 },
});
