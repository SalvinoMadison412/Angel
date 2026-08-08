import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer, DarkTheme, useNavigation } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Animated, StyleSheet } from "react-native";
import { AppTabs } from "./AppTabs";
import { AuthNavigator } from "./AuthNavigator";
import { AnimatedSplash } from "../components";
import { OnboardingScreen } from "../screens/onboarding/OnboardingScreen";
import { DeviceSetupScreen } from "../screens/device/DeviceSetupScreen";
import { CalibrateSensorScreen } from "../screens/device/CalibrateSensorScreen";
import { CrashAlertScreen } from "../screens/crash/CrashAlertScreen";
import { EmergencyCountdownScreen } from "../screens/crash/EmergencyCountdownScreen";
import { EmergencyAlertSentScreen } from "../screens/crash/EmergencyAlertSentScreen";
import { GuardianNotifiedScreen } from "../screens/crash/GuardianNotifiedScreen";
import { ActiveTicketScreen } from "../screens/incident/ActiveTicketScreen";
import { GuardianFormScreen } from "../screens/guardians/GuardianFormScreen";
import { DiagnosticScreen } from "../screens/debug/DiagnosticScreen";
import { RootStackNavigation, RootStackParamList } from "./types";
import { useAuth } from "../hooks/useAuth";
import { useCrashDetector } from "../hooks/useCrashDetector";
import { useDevice } from "../hooks/useDevice";
import { useProfile } from "../hooks/useProfile";
import { CrashEvent } from "../services/bluetooth";
import { DEFAULT_COUNTDOWN_SECONDS, flushPendingDispatches, shouldTriggerAlert } from "../services/emergency";
import { refreshLocationPermissionStatus } from "../services/location/locationTracking";
import {
  crashEventFromNotificationResponse,
  dismissActiveMonitoringNotification,
  presentActiveMonitoringNotification,
  presentCrashNotification,
} from "../services/notifications";
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

// Same destination decision from two different places below — the live BLE
// listener and a tapped/cold-started notification — so they can't drift.
function navigateToCrashAlert(navigation: RootStackNavigation, event: CrashEvent) {
  if (shouldTriggerAlert(event)) {
    navigation.navigate("CrashAlert", { ...event, totalSeconds: DEFAULT_COUNTDOWN_SECONDS });
  } else {
    navigation.navigate("EmergencyCountdown", event);
  }
}

// Listens for crash events from both the real sensor and the mock stream
// (the Home screen's dev "simulate crash" panel feeds the mock one) and
// routes every event to a fullscreen alert — severity >= 2 goes to the full
// crash-alert/dispatch flow, severity 1 to the lighter guardians-only
// countdown (see shouldTriggerAlert). Each destination screen logs its own
// outcome locally for the calibration work described in
// firmware/README.md, same as before.
//
// Also fires a high-priority local notification whenever a crash arrives
// while the app isn't foregrounded (see presentCrashNotification) — the
// navigate() calls above still queue up the alert screen for whenever the
// app is next opened, but with nothing visibly onscreen while backgrounded,
// the notification (and its own channel-level vibration) is what actually
// gets the rider's attention. No foreground service backs this: if Android
// has already suspended/killed the process before the packet arrives,
// nothing fires until the app is manually reopened.
function CrashDetectorListener() {
  const navigation = useNavigation<RootStackNavigation>();
  const real = useCrashDetector({ mock: false });
  const mock = useCrashDetector({ mock: true });
  const { data: device, setCalibrated } = useDevice();
  const handledReceivedAt = useRef<number | null>(null);

  // A crash dispatch that failed outright while offline (see
  // CrashAlertScreen's dispatch()) gets queued to disk rather than lost —
  // this is where it actually gets retried: once on mount (covers a cold
  // start after the failure) and again every time the app returns to the
  // foreground, since that's the natural moment connectivity is most likely
  // to have come back.
  // Ongoing notification for as long as the real sensor is connected — see
  // presentActiveMonitoringNotification for why this exists (no true
  // foreground service backs BLE listening on this build). Deliberately
  // keyed off the real hook only: the mock stream used by Home's debug
  // panel never actually connects to anything, so it should never surface
  // this.
  useEffect(() => {
    if (real.isLinked) {
      presentActiveMonitoringNotification().catch((err) =>
        console.warn("[notifications] failed to present monitoring notification", err)
      );
    } else {
      dismissActiveMonitoringNotification().catch((err) =>
        console.warn("[notifications] failed to dismiss monitoring notification", err)
      );
    }
  }, [real.isLinked]);

  useEffect(() => {
    flushPendingDispatches().catch((err) => console.warn("[offline-queue] flush on mount failed", err));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        flushPendingDispatches().catch((err) => console.warn("[offline-queue] flush on foreground failed", err));
      }
    });
    return () => subscription.remove();
  }, []);

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

    navigateToCrashAlert(navigation, event);
    if (AppState.currentState !== "active") {
      presentCrashNotification(event).catch((err) =>
        console.warn("[notifications] failed to present crash notification", err)
      );
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

  // Tapping the crash notification (or cold-starting the app from one) must
  // land on the same alert screen a live event would have — reusing the
  // exact severity routing above so the two paths can't disagree.
  useEffect(() => {
    // getLastNotificationResponseAsync() (cold start) and the live listener
    // below both resolve asynchronously and can both fire for the exact
    // same tap — order between them isn't guaranteed. Dedupe by the
    // notification's own request identifier, whichever callback sees it
    // first, rather than assuming one always resolves before the other.
    const handledIds = new Set<string>();
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      const id = response?.notification.request.identifier;
      if (!id || handledIds.has(id)) return;
      handledIds.add(id);
      const event = crashEventFromNotificationResponse(response);
      if (event) navigateToCrashAlert(navigation, event);
    };

    Notifications.getLastNotificationResponseAsync().then(handleResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => subscription.remove();
  }, [navigation]);

  return null;
}

// Re-checks the OS-level location permission on mount (covers a relaunch
// after a rider already granted it in a previous session — starts the live
// watch again immediately) and on every app-foreground resume (covers a
// rider revoking it from system Settings while the app was backgrounded,
// which the app is never otherwise told about). See locationTracking.ts —
// this is the only place that drives refreshLocationPermissionStatus();
// the Home screen warning banner and crash-time location capture just read
// whatever it last observed.
function LocationPermissionMonitor() {
  useEffect(() => {
    refreshLocationPermissionStatus();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshLocationPermissionStatus();
    });
    return () => subscription.remove();
  }, []);

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
        <Stack.Screen
          name="GuardianNotified"
          component={GuardianNotifiedScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="ActiveTicket" component={ActiveTicketScreen} />
        <Stack.Screen name="GuardianForm" component={GuardianFormScreen} />
        <Stack.Screen name="Diagnostic" component={DiagnosticScreen} />
      </Stack.Navigator>
      <CrashDetectorListener />
      <LocationPermissionMonitor />
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
