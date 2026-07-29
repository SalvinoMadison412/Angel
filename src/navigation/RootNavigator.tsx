import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer, DarkTheme, useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
import { AppTabs } from "./AppTabs";
import { AuthNavigator } from "./AuthNavigator";
import { AnimatedSplash } from "../components";
import { OnboardingScreen } from "../screens/onboarding/OnboardingScreen";
import { DeviceSetupScreen } from "../screens/device/DeviceSetupScreen";
import { CalibrateSensorScreen } from "../screens/device/CalibrateSensorScreen";
import { CrashAlertScreen } from "../screens/crash/CrashAlertScreen";
import { EmergencyCountdownScreen } from "../screens/crash/EmergencyCountdownScreen";
import { EmergencyAlertSentScreen } from "../screens/crash/EmergencyAlertSentScreen";
import { LiveIncidentScreen } from "../screens/incident/LiveIncidentScreen";
import { GuardianFormScreen } from "../screens/guardians/GuardianFormScreen";
import { DiagnosticScreen } from "../screens/debug/DiagnosticScreen";
import { RootStackNavigation, RootStackParamList } from "./types";
import { useAuth } from "../hooks/useAuth";
import { useCrashDetector } from "../hooks/useCrashDetector";
import { useDevice } from "../hooks/useDevice";
import { useProfile } from "../hooks/useProfile";
import { CrashEvent } from "../services/bluetooth";
import { DEFAULT_COUNTDOWN_SECONDS, shouldTriggerAlert } from "../services/emergency";
import { colors } from "../theme";

// The animation's own on-screen time — kept in sync with AnimatedSplash's
// internal timeline (ring + trace draw-in, then a small settle pulse).
const SPLASH_MIN_DURATION_MS = 1300;
const SPLASH_REDUCED_MOTION_DURATION_MS = 200;
// If auth is still resolving once the animation's minimum duration is up,
// wait a little longer rather than cutting the splash short — but capped,
// so a slow network doesn't turn a 1.3s splash into an open-ended wait.
const SPLASH_AUTH_GRACE_MS = 400;
const SPLASH_FADE_MS = 250;

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, border: colors.divider },
};

// Listens for crash events from both the real sensor and the mock stream
// (the Home screen's dev "simulate crash" panel feeds the mock one) and
// routes every event to a fullscreen alert — severity >= 2 goes to the full
// responder-dispatch flow, severity 1 to the lighter guardians-only
// countdown (see shouldTriggerAlert). Each destination screen logs its own
// outcome locally for the calibration work described in
// firmware/README.md, same as before.
function CrashDetectorListener() {
  const navigation = useNavigation<RootStackNavigation>();
  const real = useCrashDetector({ mock: false });
  const mock = useCrashDetector({ mock: true });
  const { data: device, setCalibrated } = useDevice();
  const handledReceivedAt = useRef<number | null>(null);

  useEffect(() => {
    const candidates = [real.lastEvent, mock.lastEvent].filter((e): e is CrashEvent => Boolean(e));
    const event = candidates.sort((a, b) => b.receivedAt - a.receivedAt)[0];
    if (!event || handledReceivedAt.current === event.receivedAt) return;
    handledReceivedAt.current = event.receivedAt;

    // The stored calibration flag can go stale in either direction — most
    // notably, a remount without recalibrating resets it to false on the
    // firmware side. Every event is a fresh chance to notice that and keep
    // the persistent "not calibrated" status (Device tab, setup flow)
    // honest without the rider having to do anything.
    if (device && device.calibrated !== event.calibrated) {
      setCalibrated.mutate(event.calibrated);
    }

    if (shouldTriggerAlert(event)) {
      navigation.navigate("CrashAlert", { ...event, totalSeconds: DEFAULT_COUNTDOWN_SECONDS });
    } else {
      navigation.navigate("EmergencyCountdown", event);
    }
  }, [real.lastEvent, mock.lastEvent, navigation, device, setCalibrated]);

  // A calibrate() write's ack isn't the authoritative "done" signal — the
  // device confirms separately, asynchronously, once calibration actually
  // finishes and is stored. Mirrors the same-purpose sync above for crash
  // events, just from a dedicated channel instead of piggybacking on one.
  useEffect(() => {
    if (!real.calibrationConfirmation || !device) return;
    if (device.calibrated !== real.calibrationConfirmation.calibrated) {
      setCalibrated.mutate(real.calibrationConfirmation.calibrated);
    }
  }, [real.calibrationConfirmation, device, setCalibrated]);

  return null;
}

function AppNavigator() {
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={AppTabs} />
        <Stack.Screen name="DeviceSetup" component={DeviceSetupScreen} />
        <Stack.Screen name="CalibrateSensor" component={CalibrateSensorScreen} />
        <Stack.Screen name="CrashAlert" component={CrashAlertScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="EmergencyCountdown"
          component={EmergencyCountdownScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="EmergencyAlertSent" component={EmergencyAlertSentScreen} />
        <Stack.Screen name="LiveIncident" component={LiveIncidentScreen} />
        <Stack.Screen name="GuardianForm" component={GuardianFormScreen} />
        <Stack.Screen name="Diagnostic" component={DiagnosticScreen} />
      </Stack.Navigator>
      <CrashDetectorListener />
    </>
  );
}

export function RootNavigator() {
  const { session, initializing } = useAuth();
  const profile = useProfile();

  // `null` until we know — the min-duration timer waits for this so it
  // never starts counting against the wrong duration.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const [authGraceExpired, setAuthGraceExpired] = useState(false);
  const [splashUnmounted, setSplashUnmounted] = useState(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && setReduceMotion(enabled))
      .catch(() => mounted && setReduceMotion(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    const duration = reduceMotion ? SPLASH_REDUCED_MOTION_DURATION_MS : SPLASH_MIN_DURATION_MS;
    const timer = setTimeout(() => setMinDurationElapsed(true), duration);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  // Not signed in yet (auth resolving) or signed in but the profile row
  // hasn't loaded yet — either way we don't know which of Auth/Onboarding/
  // App to show, so this counts the same as "still resolving" for the
  // splash gate.
  const stillResolving = initializing || (Boolean(session) && profile.isLoading);

  useEffect(() => {
    // Concurrent with the animation, not after it — this only ever adds
    // waiting time if resolving is the slower of the two, and even then
    // only up to the capped grace window.
    if (!minDurationElapsed || !stillResolving) return;
    const timer = setTimeout(() => setAuthGraceExpired(true), SPLASH_AUTH_GRACE_MS);
    return () => clearTimeout(timer);
  }, [minDurationElapsed, stillResolving]);

  const showSplash = !minDurationElapsed || (stillResolving && !authGraceExpired);

  useEffect(() => {
    if (showSplash || splashUnmounted) return;
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: SPLASH_FADE_MS,
      useNativeDriver: true,
    }).start(() => setSplashUnmounted(true));
  }, [showSplash, splashUnmounted, splashOpacity]);

  const needsOnboarding = Boolean(session) && Boolean(profile.data) && !profile.data?.onboarding_completed;

  return (
    <NavigationContainer theme={navTheme}>
      {!session ? <AuthNavigator /> : needsOnboarding ? <OnboardingScreen /> : <AppNavigator />}
      {!splashUnmounted && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}>
          <AnimatedSplash reduceMotion={!!reduceMotion} />
        </Animated.View>
      )}
    </NavigationContainer>
  );
}
