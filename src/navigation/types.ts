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
  LiveIncident: { incidentId: string };
  // The Angel Partners real-time ticket status screen — see
  // ActiveTicketScreen.tsx. Not yet navigated to from anywhere (CrashAlertScreen
  // still goes to LiveIncident); wiring that up is a later prompt.
  ActiveTicket: { ticketId: string };
  // Severity-1 events only — see shouldTriggerAlert in emergencyPipeline.ts.
  EmergencyCountdown: CrashEvent;
  EmergencyAlertSent: { guardianNames: string[] };
  GuardianForm: { guardianId?: string };
  // TEMP DIAGNOSTIC — remove once the calibration_complete investigation is
  // resolved. See screens/debug/DiagnosticScreen.tsx.
  Diagnostic: undefined;
};

export type RootStackNavigation = NativeStackNavigationProp<RootStackParamList>;

export type AppTabNavigation<T extends keyof AppTabParamList = keyof AppTabParamList> = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, T>,
  RootStackNavigation
>;
