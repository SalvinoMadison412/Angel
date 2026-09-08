import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CompositeNavigationProp, NavigatorScreenParams } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CrashEvent } from "../services/bluetooth";

export type AuthStackParamList = {
  PhoneEntry: undefined;
  Otp: { phone: string };
};

export type AuthStackNavigation = NativeStackNavigationProp<AuthStackParamList>;

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Plan: undefined;
  Settings: undefined;
  EditProfile: undefined;
  Insurance: undefined;
};

export type ProfileStackNavigation = NativeStackNavigationProp<ProfileStackParamList>;

export type AppTabParamList = {
  Home: undefined;
  Device: undefined;
  Guardians: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  DeviceSetup: undefined;
  // `mandatory` drives whether the screen can be skipped — true right after
  // a first connect to an uncalibrated device, absent/false for voluntary
  // recalibration from the Device tab.
  CalibrateSensor: { mandatory?: boolean } | undefined;
  CrashAlert: CrashEvent & { totalSeconds: number };
  // The post-crash "guardians notified" confirmation + crash-location map —
  // see ActiveTicketScreen.tsx. CrashAlertScreen.dispatch() navigates here
  // on a successful crash_tickets insert, falling back to
  // EmergencyAlertSent otherwise. No partner-matching UI in v1 — see the
  // v2 TODOs in ActiveTicketScreen.tsx and CrashAlertScreen.tsx.
  ActiveTicket: { ticketId: string };
  // Severity-1 events only — see shouldTriggerAlert in emergencyPipeline.ts.
  EmergencyCountdown: CrashEvent;
  EmergencyAlertSent: { guardianNames: string[] };
  // Rider-initiated "I NEED HELP NOW" from HomeScreen — no CrashEvent behind
  // it, see GuardianNotifiedScreen.tsx.
  GuardianNotified: undefined;
  GuardianForm: { guardianId?: string };
};

export type RootStackNavigation = NativeStackNavigationProp<RootStackParamList>;

export type AppTabNavigation<T extends keyof AppTabParamList = keyof AppTabParamList> = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, T>,
  RootStackNavigation
>;
