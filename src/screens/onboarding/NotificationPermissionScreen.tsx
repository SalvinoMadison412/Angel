import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton } from "../../components";
import { requestCrashNotificationPermission } from "../../services/notifications";
import { colors, spacing, type } from "../../theme";

interface Props {
  onContinue: () => void;
}

/**
 * Shown once, right before the OS POST_NOTIFICATIONS dialog — same reasoning
 * as LocationPermissionScreen: an unexplained system prompt is exactly what
 * produces an accidental Deny, and Android's own dialog copy gives no reason
 * on its own.
 *
 * This is a genuinely different channel from the guardian alert and the copy
 * below exists specifically to keep riders from conflating the two (a real
 * gap flagged in the privacy-policy alignment pass): this permission only
 * controls whether Angel can show something on the RIDER'S OWN phone (e.g.
 * "Crash detected — tap to check in", see localCrashNotifications.ts). It
 * has no effect on whether guardians get alerted — that's a WhatsApp message
 * sent server-side via the notify-guardians edge function/Twilio, which
 * fires regardless of whether this permission is granted, declined, or
 * later revoked.
 */
export function NotificationPermissionScreen({ onContinue }: Props) {
  const [requesting, setRequesting] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      await requestCrashNotificationPermission();
    } catch (err) {
      console.warn("[onboarding] failed to request notification permission", err);
    } finally {
      setRequesting(false);
      onContinue();
    }
  };

  return (
    <View style={styles.stepBody}>
      <Text style={[type.title, styles.heading]}>Stay in the loop</Text>
      <Text style={[type.body, styles.copy]}>
        If the sensor detects a crash while your phone is locked or the app is in the background, Angel shows a
        notification right on your phone so you can check in before anything else happens.
      </Text>

      <GlassCard accentBorder>
        <Text style={[type.kicker, styles.accentText]}>NOT THE SAME AS GUARDIAN ALERTS</Text>
        <Text style={[type.bodySmall, styles.copy, styles.consentCopy]}>
          This only controls notifications on your own phone. Your guardians are alerted separately by WhatsApp
          message — that happens regardless of what you choose here.
        </Text>
      </GlassCard>

      <PillButton title="ENABLE NOTIFICATIONS" onPress={handleEnable} loading={requesting} style={styles.cta} />
      <Text style={styles.skipLink} onPress={onContinue}>
        Skip for now
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepBody: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  heading: { color: colors.text },
  copy: { color: colors.textMuted },
  consentCopy: { marginTop: spacing.md },
  accentText: { color: colors.accent },
  cta: { marginTop: spacing.sm },
  skipLink: { color: colors.textDim, textAlign: "center", ...type.bodySmall },
});
