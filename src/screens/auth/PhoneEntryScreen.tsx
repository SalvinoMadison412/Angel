import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, HoloMotorcycle, PillButton, ScreenBackground } from "../../components";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, type } from "../../theme";
import { AuthStackNavigation } from "../../navigation/types";

export function PhoneEntryScreen() {
  const navigation = useNavigation<AuthStackNavigation>();
  const { sendOtp, signInWithGoogle } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, "");
  const canSubmit = digits.length === 10;

  const handleSend = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    const fullPhone = `+91${digits}`;
    const { error: sendError } = await sendOtp(fullPhone);
    setLoading(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    navigation.navigate("Otp", { phone: fullPhone });
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    const { error: googleSignInError } = await signInWithGoogle();
    setGoogleLoading(false);
    // On success the session updates and RootNavigator swaps to the app
    // stack on its own — there's nothing to navigate to here.
    if (googleSignInError) setGoogleError(googleSignInError);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <ScreenBackground scroll contentStyle={styles.content}>
        <Text style={[type.wordmark, styles.wordmark]}>ANGEL</Text>
        <Text style={[type.kicker, styles.kicker]}>CRASH DETECTION SYSTEM</Text>
        <Text style={[type.body, styles.subtitle]}>
          Someone is watching the road with you. Sign in to arm your device.
        </Text>

        <View style={styles.motif}>
          <HoloMotorcycle dim width={260} height={140} />
        </View>

        <PillButton
          title="CONTINUE WITH GOOGLE"
          variant="outline"
          onPress={handleGoogleSignIn}
          loading={googleLoading}
          style={styles.googleButton}
        />
        {googleError ? <Text style={styles.error}>{googleError}</Text> : null}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={[type.kicker, styles.dividerText]}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <GlassCard style={styles.formCard}>
          <Text style={[type.kicker, styles.fieldLabel]}>MOBILE NUMBER</Text>
          <View style={styles.phoneRow}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>+91</Text>
              <Text style={styles.chevron}>▾</Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
              placeholder="00000 00000"
              placeholderTextColor={colors.textDim}
              keyboardType="number-pad"
              style={styles.phoneInput}
              maxLength={10}
              underlineColorAndroid="transparent"
            />
          </View>
          <View style={styles.metaRow}>
            <Text style={[type.label, styles.metaText]}>OTP VIA SMS</Text>
            <Text style={[type.label, styles.metaText]}>{digits.length} / 10</Text>
          </View>
        </GlassCard>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PillButton title="SEND OTP" onPress={handleSend} disabled={!canSubmit} loading={loading} style={styles.cta} />

        <Text style={styles.legal}>
          By continuing you agree to Angel's <Text style={styles.link}>Terms</Text> and{" "}
          <Text style={styles.link}>Privacy Policy</Text>, and to emergency contact sharing during a confirmed crash.
        </Text>
      </ScreenBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
    alignItems: "center",
  },
  wordmark: { color: colors.text },
  kicker: { color: colors.accent, marginTop: spacing.md },
  subtitle: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  motif: { marginVertical: spacing.xxxl },
  googleButton: { width: "100%" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    width: "100%",
    marginVertical: spacing.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.glassBorder },
  dividerText: { color: colors.textDim },
  formCard: { width: "100%" },
  fieldLabel: { color: colors.textDim, marginBottom: spacing.md },
  phoneRow: { flexDirection: "row", gap: spacing.md },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.glassFillRaised,
  },
  codeText: { ...type.body, color: colors.text, fontFamily: type.button.fontFamily },
  chevron: { color: colors.textMuted, fontSize: 10 },
  phoneInput: {
    flex: 1,
    ...type.body,
    fontFamily: type.button.fontFamily,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.glassFillRaised,
    letterSpacing: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  metaText: { color: colors.textDim },
  cta: { width: "100%", marginTop: spacing.xxl },
  error: { color: colors.accent, marginTop: spacing.md, ...type.bodySmall },
  legal: {
    ...type.bodySmall,
    color: colors.textDim,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  link: { color: colors.accent },
});
