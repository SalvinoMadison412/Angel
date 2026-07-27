import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

export type AuthStackParamList = {
  PhoneEntry: undefined;
  Otp: { phone: string };
};

export type AuthStackNavigation = NativeStackNavigationProp<AuthStackParamList>;

export type AppTabParamList = {
  Home: undefined;
  Device: undefined;
  Guardians: undefined;
  Plan: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  Calibration: undefined;
  CrashAlert: { incidentId: string; severity: number; totalSeconds: number };
  LiveIncident: { incidentId: string };
  GuardianForm: { guardianId?: string };
};

export type RootStackNavigation = NativeStackNavigationProp<RootStackParamList>;

export type AppTabNavigation<T extends keyof AppTabParamList = keyof AppTabParamList> = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, T>,
  RootStackNavigation
>;
