import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBarIcon, TabBarIconName } from "../components";
import { colors, fontFamily } from "../theme";
import { HomeScreen } from "../screens/home/HomeScreen";
import { DeviceScreen } from "../screens/device/DeviceScreen";
import { GuardiansScreen } from "../screens/guardians/GuardiansScreen";
import { ProfileNavigator } from "./ProfileNavigator";
import { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

const LABELS: Record<keyof AppTabParamList, string> = {
  Home: "HOME",
  Device: "DEVICE",
  Guardians: "GUARDIANS",
  Profile: "PROFILE",
};

const ICONS: Record<keyof AppTabParamList, TabBarIconName> = {
  Home: "home",
  Device: "device",
  Guardians: "guardians",
  Profile: "profile",
};

// Just the icon plus its label, with a hair of breathing room — the default
// bottom-tab height adds a good deal more, which is what turned the bar into
// a visible black slab above the content.
const TAB_CONTENT_HEIGHT = 50;

export function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // The inset is added as padding rather than absorbed into the bar so
        // the icons sit clear of the gesture pill instead of behind it.
        tabBarStyle: [styles.tabBar, { height: TAB_CONTENT_HEIGHT + insets.bottom, paddingBottom: insets.bottom }],
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarIcon: ({ color, size }) => (
          <TabBarIcon name={ICONS[route.name as keyof AppTabParamList]} color={color} size={size} />
        ),
        tabBarLabel: ({ color }) => (
          <Text style={[styles.label, { color }]}>{LABELS[route.name as keyof AppTabParamList]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Device" component={DeviceScreen} />
      <Tab.Screen name="Guardians" component={GuardiansScreen} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Floats over the screen rather than sitting in its own strip, sized to
  // hug the icons. ScreenBackground pads content by the bar's height so
  // nothing ends up stranded underneath it.
  tabBar: {
    position: "absolute",
    backgroundColor: colors.bg,
    borderTopWidth: 0,
    elevation: 0,
    paddingTop: 4,
  },
  label: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
  },
});
