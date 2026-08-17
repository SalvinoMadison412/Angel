import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, HoloMotorcycle, PillButton, ScreenBackground, ScreenHeader, StepProgress } from "../../components";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, type } from "../../theme";
import { AuthStackNavigation, AuthStackParamList } from "../../navigation/types";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export function OtpScreen() {
  const navigation = useNavigation<AuthStackNavigation>();
  const route = useRoute<RouteProp<AuthStackParamList, "Otp">>();
  const { phone } = route.params;
  const { verifyOtp, sendOtp } = useAuth();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH) return;
    setLoading(true);
    setError(null);
    const { error: verifyError } = await verifyOtp(phone, code);
    setLoading(false);
    if (verifyError) setError(verifyError);
    // On success, the root navigator swaps to the app stack automatically
    // once AuthProvider's session state updates.
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    setSecondsLeft(RESEND_SECONDS);
    await sendOtp(phone);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} />
      <View style={styles.progressWrap}>
        <StepProgress steps={2} current={2} />
      </View>

      <Text style={[type.title, styles.title]}>ENTER CODE</Text>
      <Text style={styles.subtitle}>
        6-digit code sent to <Text style={styles.phone}>{phone}</Text> ·{" "}
        <Text style={styles.link} onPress={() => navigation.goBack()}>
          change
        </Text>
      </Text>

      <Pressable style={styles.codeRow} onPressIn={() => inputRef.current?.focus()}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.codeBox, i === code.length && styles.codeBoxActive]}>
            <Text style={styles.codeDigit}>{code[i] ?? ""}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        style={styles.hiddenInput}
        autoFocus
      />

      <View style={styles.metaRow}>
        <Text style={[type.label, styles.metaText]}>{code.length < CODE_LENGTH ? "AWAITING CODE" : "READY"}</Text>
        <Text
          style={[type.label, secondsLeft > 0 ? styles.metaText : styles.link]}
          onPress={handleResend}
        >
          {secondsLeft > 0 ? `RESEND IN 0:${secondsLeft.toString().padStart(2, "0")}` : "RESEND CODE"}
        </Text>
      </View>

      <View style={styles.motif}>
        <HoloMotorcycle dim width={220} height={110} />
      </View>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.infoText}>
          This number becomes your emergency identity — guardians are called from it.
        </Text>
      </GlassCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.ctaWrap}>
        <PillButton
          title="VERIFY"
          onPress={handleVerify}
          disabled={code.length !== CODE_LENGTH}
          loading={loading}
        />
      </View>
    </ScreenBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingBottom: spacing.xxxl,
  },
  progressWrap: { marginBottom: spacing.xl },
  title: {
    color: colors.text,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  subtitle: {
    ...type.bodySmall,
    color: colors.textMuted,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  phone: { color: colors.text },
  link: { color: colors.accent },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  codeBox: {
    flex: 1,
    aspectRatio: 0.8,
    borderRadius: 12,
    backgroundColor: colors.glassFillRaised,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  codeBoxActive: { borderColor: colors.accentBorder },
  codeDigit: { ...type.title, color: colors.text },
  hiddenInput: { position: "absolute", opacity: 0, height: 0, width: 0 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  metaText: { color: colors.textDim },
  motif: { alignItems: "center", marginVertical: spacing.xxl },
  infoCard: { marginHorizontal: spacing.xl },
  infoText: { ...type.bodySmall, color: colors.textMuted },
  error: {
    color: colors.accent,
    ...type.bodySmall,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  ctaWrap: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
});
