import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { AppTabs } from "./AppTabs";
import { AuthNavigator } from "./AuthNavigator";
import { CalibrationWizard } from "../screens/device/CalibrationWizard";
import { CrashAlertScreen } from "../screens/crash/CrashAlertScreen";
import { LiveIncidentScreen } from "../screens/incident/LiveIncidentScreen";
import { GuardianFormScreen } from "../screens/guardians/GuardianFormScreen";
import { RootStackParamList } from "./types";
import { useAuth } from "../hooks/useAuth";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, border: colors.divider },
};

function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={AppTabs} />
      <Stack.Screen name="Calibration" component={CalibrationWizard} />
      <Stack.Screen name="CrashAlert" component={CrashAlertScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="LiveIncident" component={LiveIncidentScreen} />
      <Stack.Screen name="GuardianForm" component={GuardianFormScreen} />
    </Stack.Navigator>
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
