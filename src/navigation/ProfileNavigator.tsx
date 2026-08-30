import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { SettingsScreen } from "../screens/profile/SettingsScreen";
import { EditProfileScreen } from "../screens/profile/EditProfileScreen";
import { InsuranceScreen } from "../screens/profile/InsuranceScreen";
import { SubscriptionScreen } from "../screens/plan/SubscriptionScreen";
import { ProfileStackParamList } from "./types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Plan" component={SubscriptionScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Insurance" component={InsuranceScreen} />
    </Stack.Navigator>
  );
}
