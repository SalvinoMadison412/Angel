import React, { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, StepProgress } from "../../components";
import {
  requestBluetoothPermission,
  requestLocationForegroundPermission,
  requestNotificationsPermission,
  setPermissionsGateComplete,
} from "../../services/permissions/permissionsStatus";
import { colors, spacing, type } from "../../theme";

interface Props {
  onComplete: () => void;
}

// Bluetooth runtime permissions don't exist as a concept on iOS the way
// they do here — iOS grants BLE implicitly at first scan.
const STEPS = Platform.OS === "android" ? (["location", "notifications", "bluetooth"] as const) : (["location", "notifications"] as const);

type StepId = (typeof STEPS)[number];

/**
 * Runs once, before anything else — first thing a rider sees after signing
 * up, ahead of OnboardingScreen. Every permission Angel depends on
 * (notifications, precise location, BLE) is requested here in sequence,
 * each behind its own explanation screen, and none of them can be skipped:
 * AGENTS.md is explicit that the app must not let a rider proceed without
 * notifications and location enabled, since those are what actually gets a
 * guardian alerted and located after a crash. Grant state is written once
 * via setPermissionsGateComplete() so this never shows again on subsequent
 * launches — PermissionBanner (mounted app-wide) is what covers a
 * permission getting revoked later from system Settings.
 *
 * Notification channel/category setup used to happen here, but that only
 * ever ran on a rider's very first launch — see NotificationBootstrap in
 * RootNavigator, which now does it unconditionally on every cold start.
 */
export function PermissionsGateScreen({ onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const stepId = STEPS[stepIndex];

  const advance = async () => {
    if (stepIndex + 1 >= STEPS.length) {
      await setPermissionsGateComplete();
      onComplete();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <View style={styles.progressWrap}>
        <StepProgress steps={STEPS.length} current={stepIndex + 1} />
        <Text style={[type.kicker, styles.stepLabel]}>
          STEP {stepIndex + 1} OF {STEPS.length}
        </Text>
      </View>

      {stepId === "location" && <LocationForegroundStep onGranted={advance} />}
      {stepId === "notifications" && <NotificationsStep onGranted={advance} />}
      {stepId === "bluetooth" && <BluetoothStep onGranted={advance} />}
    </ScreenBackground>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Shared shell for a single gate step — explanation card, a primary CTA
// that fires the real OS prompt, and (only once denied) a blocking
// "denied" state with a Settings deep link. There is deliberately no
// skip/continue-anyway affordance anywhere in this screen.
// ───────────────────────────────────────────────────────────────────────
function GateStep({
  heading,
  copy,
  whyWeAsk,
  ctaLabel,
  deniedHeading,
  deniedCopy,
  requesting,
  denied,
  onEnable,
}: {
  heading: string;
  copy: string;
  whyWeAsk: string;
  ctaLabel: string;
  deniedHeading: string;
  deniedCopy: string;
  requesting: boolean;
  denied: boolean;
  onEnable: () => void;
}) {
  if (denied) {
    return (
      <View style={styles.stepBody}>
        <Text style={[type.title, styles.heading]}>{deniedHeading}</Text>
        <Text style={[type.body, styles.copy]}>{deniedCopy}</Text>
        <PillButton title="OPEN SETTINGS" onPress={() => Linking.openSettings()} style={styles.cta} />
        <PillButton title="TRY AGAIN" variant="outline" onPress={onEnable} loading={requesting} style={styles.cta} />
      </View>
    );
  }

  return (
    <View style={styles.stepBody}>
      <Text style={[type.title, styles.heading]}>{heading}</Text>
      <Text style={[type.body, styles.copy]}>{copy}</Text>

      <GlassCard accentBorder>
        <Text style={[type.kicker, styles.accentText]}>WHY WE ASK</Text>
        <Text style={[type.bodySmall, styles.copy, styles.consentCopy]}>{whyWeAsk}</Text>
      </GlassCard>

      <PillButton title={ctaLabel} onPress={onEnable} loading={requesting} style={styles.cta} />
    </View>
  );
}

function NotificationsStep({ onGranted }: { onGranted: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const granted = await requestNotificationsPermission();
      if (granted) {
        setDenied(false);
        onGranted();
      } else {
        setDenied(true);
      }
    } catch (err) {
      console.warn("[permissions-gate] notifications request failed", err);
      setDenied(true);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <GateStep
      heading="Stay in the loop"
      copy="Angel needs to notify you directly on this phone — a crash alert the instant it's confirmed, and a check-in if you're riding dangerously fast. These are always-on safety alerts, not marketing."
      whyWeAsk="Without notifications, a confirmed crash alert or a speed warning can go completely unseen while your phone is locked or the app is in the background — exactly the moment it matters most."
      ctaLabel="ENABLE NOTIFICATIONS"
      deniedHeading="Notifications are off"
      deniedCopy="Angel can't reach you with a crash or speed alert without this. Enable notifications for Angel in Settings to continue."
      requesting={requesting}
      denied={denied}
      onEnable={handleEnable}
    />
  );
}

function LocationForegroundStep({ onGranted }: { onGranted: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);
  const [imprecise, setImprecise] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const { granted, precise } = await requestLocationForegroundPermission();
      if (granted && precise) {
        setDenied(false);
        setImprecise(false);
        onGranted();
      } else if (granted) {
        setImprecise(true);
      } else {
        setDenied(true);
      }
    } catch (err) {
      console.warn("[permissions-gate] location request failed", err);
      setDenied(true);
    } finally {
      setRequesting(false);
    }
  };

  if (imprecise) {
    return (
      <View style={styles.stepBody}>
        <Text style={[type.title, styles.heading]}>Precise location is off</Text>
        <Text style={[type.body, styles.copy]}>
          Angel only has your approximate location — that's not accurate enough for guardians to find you after a
          crash. Turn on Precise Location for Angel in Settings, then try again.
        </Text>
        <PillButton title="OPEN SETTINGS" onPress={() => Linking.openSettings()} style={styles.cta} />
        <PillButton title="TRY AGAIN" variant="outline" onPress={handleEnable} loading={requesting} style={styles.cta} />
      </View>
    );
  }

  return (
    <GateStep
      heading="Share your location"
      copy="Angel needs your precise location to send your exact position to guardians in a crash emergency — it's how they find you."
      whyWeAsk="Location is only captured at the moment of a confirmed crash alert — Angel never tracks or stores your location otherwise. Choose Precise (or Always Allow Precise Location) when the system prompt appears."
      ctaLabel="ENABLE LOCATION"
      deniedHeading="Location is off"
      deniedCopy="Without this, guardians can't be told where you are in a crash. Enable location for Angel in Settings to continue."
      requesting={requesting}
      denied={denied}
      onEnable={handleEnable}
    />
  );
}

function BluetoothStep({ onGranted }: { onGranted: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const granted = await requestBluetoothPermission();
      if (granted) {
        setDenied(false);
        onGranted();
      } else {
        setDenied(true);
      }
    } catch (err) {
      console.warn("[permissions-gate] bluetooth request failed", err);
      setDenied(true);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <GateStep
      heading="Connect to your sensor"
      copy="Angel talks to your CrashDetector sensor over Bluetooth — this is how impact and lean are actually detected."
      whyWeAsk="Without Bluetooth permission, Angel can't scan for or stay connected to the sensor at all, which means no crash detection."
      ctaLabel="ENABLE BLUETOOTH"
      deniedHeading="Bluetooth is off"
      deniedCopy="Angel can't connect to your sensor without this. Enable Nearby devices / Bluetooth for Angel in Settings to continue."
      requesting={requesting}
      denied={denied}
      onEnable={handleEnable}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  progressWrap: { marginTop: spacing.lg, marginBottom: spacing.xl },
  stepLabel: { color: colors.textDim, textAlign: "center", marginTop: spacing.md },
  stepBody: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  heading: { color: colors.text },
  copy: { color: colors.textMuted },
  consentCopy: { marginTop: spacing.md },
  accentText: { color: colors.accent },
  cta: { marginTop: spacing.sm },
});
