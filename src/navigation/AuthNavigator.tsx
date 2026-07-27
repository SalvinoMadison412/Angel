import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { PhoneEntryScreen } from "../screens/auth/PhoneEntryScreen";
import { OtpScreen } from "../screens/auth/OtpScreen";
import { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
    </Stack.Navigator>
  );
}
