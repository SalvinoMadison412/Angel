import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { PhoneLoginScreen } from "../screens/auth/PhoneLoginScreen";
import { OTPVerifyScreen } from "../screens/auth/OTPVerifyScreen";
import { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
    </Stack.Navigator>
  );
}
