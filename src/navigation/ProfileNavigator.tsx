import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { SubscriptionScreen } from "../screens/plan/SubscriptionScreen";
import { ProfileStackParamList } from "./types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Plan" component={SubscriptionScreen} />
    </Stack.Navigator>
  );
}
