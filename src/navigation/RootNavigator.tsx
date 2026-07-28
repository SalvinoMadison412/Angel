import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer, DarkTheme, useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppTabs } from "./AppTabs";
import { AuthNavigator } from "./AuthNavigator";
import { DeviceSetupScreen } from "../screens/device/DeviceSetupScreen";
import { CalibrateSensorScreen } from "../screens/device/CalibrateSensorScreen";
import { CalibrationWizard } from "../screens/device/CalibrationWizard";
import { CrashAlertScreen } from "../screens/crash/CrashAlertScreen";
import { LiveIncidentScreen } from "../screens/incident/LiveIncidentScreen";
import { GuardianFormScreen } from "../screens/guardians/GuardianFormScreen";
import { RootStackNavigation, RootStackParamList } from "./types";
import { useAuth } from "../hooks/useAuth";
import { useCrashDetector } from "../hooks/useCrashDetector";
import { useDevice } from "../hooks/useDevice";
import { CrashEvent } from "../services/bluetooth";
import { DEFAULT_COUNTDOWN_SECONDS, logCrashEventLocally, shouldTriggerAlert } from "../services/emergency";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, border: colors.divider },
};

// Listens for crash events from both the real sensor and the mock stream
// (the Home screen's dev "simulate crash" panel feeds the mock one) and
// routes severity >= 2 straight to the full-screen alert. Below-threshold
// events still get logged locally for the calibration work described in
// firmware/README.md — they just don't interrupt the rider.
function CrashDetectorListener() {
  const navigation = useNavigation<RootStackNavigation>();
  const real = useCrashDetector({ mock: false });
  const mock = useCrashDetector({ mock: true });
  const { data: device, setCalibrated } = useDevice();
  const handledReceivedAt = useRef<number | null>(null);

  useEffect(() => {
    const candidates = [real.lastEvent, mock.lastEvent].filter((e): e is CrashEvent => Boolean(e));
    const event = candidates.sort((a, b) => b.receivedAt - a.receivedAt)[0];
    if (!event || handledReceivedAt.current === event.receivedAt) return;
    handledReceivedAt.current = event.receivedAt;

    // The stored calibration flag can go stale in either direction — most
    // notably, a remount without recalibrating resets it to false on the
    // firmware side. Every event is a fresh chance to notice that and keep
    // the persistent "not calibrated" status (Device tab, setup flow)
    // honest without the rider having to do anything.
    if (device && device.calibrated !== event.calibrated) {
      setCalibrated.mutate(event.calibrated);
    }

    if (shouldTriggerAlert(event)) {
      navigation.navigate("CrashAlert", { ...event, totalSeconds: DEFAULT_COUNTDOWN_SECONDS });
    } else {
      logCrashEventLocally(event, "below_threshold");
    }
  }, [real.lastEvent, mock.lastEvent, navigation, device, setCalibrated]);

  return null;
}

function AppNavigator() {
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={AppTabs} />
        <Stack.Screen name="DeviceSetup" component={DeviceSetupScreen} />
        <Stack.Screen name="CalibrateSensor" component={CalibrateSensorScreen} />
        <Stack.Screen name="Calibration" component={CalibrationWizard} />
        <Stack.Screen name="CrashAlert" component={CrashAlertScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="LiveIncident" component={LiveIncidentScreen} />
        <Stack.Screen name="GuardianForm" component={GuardianFormScreen} />
      </Stack.Navigator>
      <CrashDetectorListener />
    </>
  );
}

export function RootNavigator() {
  const { session, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {session ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
