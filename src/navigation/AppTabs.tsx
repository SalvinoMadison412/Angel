import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { colors, fontFamily } from "../theme";
import { HomeScreen } from "../screens/home/HomeScreen";
import { DeviceScreen } from "../screens/device/DeviceScreen";
import { GuardiansScreen } from "../screens/guardians/GuardiansScreen";
import { SubscriptionScreen } from "../screens/plan/SubscriptionScreen";
import { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

const LABELS: Record<keyof AppTabParamList, string> = {
  Home: "HOME",
  Device: "DEVICE",
  Guardians: "GUARDIANS",
  Plan: "PLAN",
};

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarShowIcon: false,
        tabBarLabel: ({ color }) => (
          <Text style={[styles.label, { color }]}>{LABELS[route.name as keyof AppTabParamList]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Device" component={DeviceScreen} />
      <Tab.Screen name="Guardians" component={GuardiansScreen} />
      <Tab.Screen name="Plan" component={SubscriptionScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg,
    borderTopColor: colors.divider,
    borderTopWidth: 1,
  },
  label: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
});
