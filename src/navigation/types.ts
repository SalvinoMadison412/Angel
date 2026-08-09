import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CompositeNavigationProp, NavigatorScreenParams } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CrashEvent } from "../services/bluetooth";
import { GuardianInput } from "../hooks/useGuardians";

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
  // Accepts nested tab params (e.g. { screen: "Guardians" }) so a screen
  // popping back to Tabs can land on a specific tab instead of always
  // resetting to whichever tab is listed first in AppTabs.tsx.
  Tabs: NavigatorScreenParams<AppTabParamList> | undefined;
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
  // Full-screen, back-blocked WhatsApp sandbox opt-in step — pushed as a
  // real stack screen (not an in-place modal component) specifically so it
  // covers the bottom tab bar too and can't be escaped by tapping a tab;
  // see GuardianOptInScreen.tsx for why that matters. `pendingGuardianInput`
  // present means this is gating a brand-new guardian's save (the screen
  // performs the actual insert itself once resolved); absent means it's a
  // re-invite for an already-saved, still-pending guardian (nothing to
  // write, just closes).
  GuardianOptIn: { guardianName: string; pendingGuardianInput?: GuardianInput };
  // TEMP DIAGNOSTIC — remove once the calibration_complete investigation is
  // resolved. See screens/debug/DiagnosticScreen.tsx.
  Diagnostic: undefined;
};

export type RootStackNavigation = NativeStackNavigationProp<RootStackParamList>;

export type AppTabNavigation<T extends keyof AppTabParamList = keyof AppTabParamList> = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, T>,
  RootStackNavigation
>;
