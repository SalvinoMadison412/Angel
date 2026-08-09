import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import { BackHandler, Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard, PillButton } from "../../components";
import { useGuardians } from "../../hooks/useGuardians";
import {
  buildGuardianOptInLink,
  guardianOptInFallbackText,
  isWhatsAppInstalled,
  isWhatsAppOptInConfigured,
} from "../../lib/whatsapp";
import { colors, radius, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

/**
 * A brand-new guardian could previously be saved with zero indication
 * they'd never receive an alert until joining the Twilio WhatsApp sandbox
 * — this screen is the fix: it sits between "tap Save" and the guardian
 * row actually existing in the database, and can't be skipped past.
 *
 * Deliberately a real stack screen (pushed via navigation.navigate, not an
 * in-place <Modal> or overlay component) for two reasons, both confirmed
 * live on an emulator rather than assumed:
 *   1. React Native's <Modal> dismisses on the Android hardware back button
 *      regardless of what onRequestClose's body does on this RN/Fabric
 *      version — its native Dialog wrapper appears to self-cancel before
 *      or alongside invoking the JS callback.
 *   2. An in-place absolutely-positioned overlay rendered inside a tab
 *      screen's own content does NOT cover the bottom tab bar (that's
 *      rendered by the tab navigator, a sibling in the tree, not a
 *      descendant of the screen) — tapping a tab bypassed the "blocking"
 *      modal entirely in testing.
 * A real stack screen pushed on top of the Tabs screen (see
 * RootNavigator.tsx's AppNavigator, gestureEnabled: false in its
 * Stack.Screen options) covers both the tab bar and the swipe-back
 * gesture, and BackHandler below covers the hardware button — the same
 * three-part pattern CrashAlertScreen already relies on for the same
 * "must be explicitly acted on" requirement.
 */
export function GuardianOptInScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "GuardianOptIn">>();
  const { guardianName, pendingGuardianInput } = route.params;
  const insets = useSafeAreaInsets();
  const { addGuardian } = useGuardians();

  const [sent, setSent] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, []);

  const handleSend = async () => {
    const link = buildGuardianOptInLink();
    if (!link) {
      setShowFallback(true);
      return;
    }
    setOpening(true);
    try {
      const installed = await isWhatsAppInstalled();
      if (!installed) {
        setShowFallback(true);
        return;
      }
      await Linking.openURL(link);
      setSent(true);
    } catch (err) {
      console.warn("[guardians] failed to open WhatsApp", err);
      setShowFallback(true);
    } finally {
      setOpening(false);
    }
  };

  const handleCopy = async () => {
    const fallback = guardianOptInFallbackText();
    if (!fallback) return;
    await Clipboard.setStringAsync(fallback.message);
    setCopied(true);
  };

  // Both exits (WhatsApp sent -> Done, and "I'll do this later") end up
  // here and do the exact same database write — is_active defaults to
  // false either way (see migration 0010_guardian_active_status.sql); the
  // webhook is the only thing that ever flips it to true. The only
  // difference is what the rider saw on the way out. When there's no
  // pendingGuardianInput (the re-invite flow for an already-saved
  // guardian), there's nothing to write at all.
  const finish = async () => {
    if (!pendingGuardianInput) {
      navigation.goBack();
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      await addGuardian.mutateAsync(pendingGuardianInput);
      // Pops both this screen and GuardianForm in one go, landing back on
      // the Guardians tab specifically — a plain goBack() would only
      // return to the now-stale, already-submitted form, and an
      // unparameterized navigate("Tabs") resets to whichever tab is
      // listed first in AppTabs.tsx (Home), not wherever the rider
      // actually came from.
      navigation.navigate("Tabs", { screen: "Guardians" });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save this guardian — try again.");
      setSaving(false);
    }
  };

  const fallback = guardianOptInFallbackText();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      {!sent ? (
        <>
          <Text style={[type.title, styles.heading]}>One more step — your guardian must join first</Text>
          <Text style={[type.body, styles.copy]}>
            Before {guardianName} can receive crash alerts, they need to join your Angel emergency network on
            WhatsApp.
          </Text>
          <Text style={[type.body, styles.copy]}>
            Tap the button below to send them the joining instructions right now. They just need to send one
            WhatsApp message and they'll be set up instantly.
          </Text>

          {showFallback && (
            <GlassCard accentBorder style={styles.fallbackCard}>
              <Text style={[type.kicker, styles.accentText]}>
                {isWhatsAppOptInConfigured() ? "WHATSAPP NOT AVAILABLE" : "NOT CONFIGURED"}
              </Text>
              {fallback ? (
                <>
                  <Text style={[type.bodySmall, styles.copy, styles.fallbackCopy]}>
                    WhatsApp isn't installed on this phone. Send this message to {fallback.number} yourself from any
                    messaging app instead:
                  </Text>
                  <View style={styles.fallbackTextBox}>
                    <Text selectable style={styles.fallbackValue}>
                      {fallback.message}
                    </Text>
                  </View>
                  <Text style={styles.copyAction} onPress={handleCopy} accessibilityRole="button">
                    {copied ? "COPIED" : "COPY MESSAGE"}
                  </Text>
                </>
              ) : (
                <Text style={[type.bodySmall, styles.copy, styles.fallbackCopy]}>
                  WhatsApp invite isn't configured for this build yet — ask whoever set it up to add
                  EXPO_PUBLIC_TWILIO_WHATSAPP_NUMBER / EXPO_PUBLIC_TWILIO_JOIN_MESSAGE.
                </Text>
              )}
            </GlassCard>
          )}

          {saveError && <Text style={styles.errorText}>{saveError}</Text>}

          <View style={styles.spacer} />

          {!showFallback && (
            <PillButton
              title={`SEND WHATSAPP INVITE TO ${guardianName.toUpperCase()}`}
              onPress={handleSend}
              loading={opening}
            />
          )}
          <Text style={styles.laterLink} onPress={finish} accessibilityRole="button">
            {saving ? "Saving…" : "I'll do this later"}
          </Text>
        </>
      ) : (
        <>
          <Text style={[type.title, styles.heading]}>Invite sent!</Text>
          <Text style={[type.body, styles.copy]}>
            Once {guardianName} sends the message, they'll be activated automatically.
          </Text>
          {saveError && <Text style={styles.errorText}>{saveError}</Text>}
          <View style={styles.spacer} />
          <PillButton title="DONE" onPress={finish} loading={saving} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl, justifyContent: "center" },
  heading: { color: colors.text, marginBottom: spacing.lg },
  copy: { color: colors.textMuted, marginBottom: spacing.md },
  spacer: { height: spacing.xxl },
  laterLink: {
    color: colors.textDim,
    textAlign: "center",
    marginTop: spacing.lg,
    ...type.bodySmall,
  },
  errorText: { color: colors.accent, textAlign: "center", marginTop: spacing.md, ...type.bodySmall },
  fallbackCard: { marginTop: spacing.lg },
  accentText: { color: colors.warning },
  fallbackCopy: { marginTop: spacing.sm, marginBottom: 0 },
  fallbackTextBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.glassFillRaised,
  },
  fallbackValue: { color: colors.text, ...type.body },
  copyAction: {
    color: colors.accent,
    textAlign: "center",
    marginTop: spacing.md,
    fontFamily: type.button.fontFamily,
    fontSize: 12,
    letterSpacing: 1,
  },
});
