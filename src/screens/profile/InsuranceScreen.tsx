import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { useEmergencyProfile } from "../../hooks";
import { ProfileStackNavigation } from "../../navigation/types";
import { colors, radius, spacing, type } from "../../theme";
import { HospitalPreference } from "../../types/database";

const PREFERENCES: { value: HospitalPreference; label: string; hint: string }[] = [
  { value: "government", label: "GOVERNMENT", hint: "Usually nearer and cheaper" },
  { value: "private", label: "PRIVATE", hint: "Usually faster admission" },
];

/**
 * Hand-drawn tick in the same line-art idiom as TabBarIcon and ProfileScreen's
 * GearIcon, in a box that springs when it flips. Only used here, so it lives
 * in this file rather than as a shared component.
 */
function InsuranceCheckbox({ checked }: { checked: boolean }) {
  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: checked ? 1 : 0,
      useNativeDriver: true,
      friction: 5,
      tension: 160,
    }).start();
  }, [checked, progress]);

  return (
    <Animated.View
      style={[
        styles.checkbox,
        checked && styles.checkboxChecked,
        {
          // Clamped so the spring's overshoot can't inflate the box past its
          // resting size; the tick below is left unclamped so the overshoot
          // reads as a deliberate pop.
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1], extrapolate: "clamp" }) },
          ],
        },
      ]}
    >
      <Animated.View style={{ opacity: progress, transform: [{ scale: progress }] }}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path
            d="M4 12.5 9.5 18 20 6.5"
            stroke={colors.accent}
            strokeWidth={2.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Reached by tapping the Insurance row on ProfileScreen. Unlike the rest of
 * the profile — read-only screen plus one shared EditProfileScreen — this
 * one is view-and-edit in a single screen: insurance is the only place these
 * fields are entered, so a separate read-only twin would be pure duplication.
 * The hospital preference lives here rather than in EmergencyProfile's
 * medical block because it's a decision about the policy, not about the body.
 */
export function InsuranceScreen() {
  const navigation = useNavigation<ProfileStackNavigation>();
  const emergencyProfile = useEmergencyProfile();

  const [hasInsurance, setHasInsurance] = useState(false);
  const [provider, setProvider] = useState("");
  const [policyName, setPolicyName] = useState("");
  const [coverage, setCoverage] = useState("");
  const [preference, setPreference] = useState<HospitalPreference | null>(null);
  const loaded = useRef(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded.current || !emergencyProfile.data) return;
    loaded.current = true;
    const data = emergencyProfile.data;
    setHasInsurance(data.insurance_covered ?? false);
    setProvider(data.insurance_provider ?? "");
    setPolicyName(data.insurance_policy_name ?? "");
    setCoverage(data.insurance_coverage ?? "");
    setPreference(data.hospital_preference ?? null);
  }, [emergencyProfile.data]);

  const toggleInsurance = () => {
    Haptics.selectionAsync().catch(() => {});
    setHasInsurance((prev) => !prev);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await emergencyProfile.save.mutateAsync({
        insuranceCovered: hasInsurance,
        insuranceProvider: provider.trim() || null,
        insurancePolicyName: policyName.trim() || null,
        insuranceCoverage: coverage.trim() || null,
        hospitalPreference: preference,
      });
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save your insurance details — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader title="INSURANCE" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        {saveError && <Text style={styles.error}>{saveError}</Text>}

        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>DO YOU HAVE INSURANCE?</Text>
          <Pressable
            style={styles.checkRow}
            onPress={toggleInsurance}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: hasInsurance }}
            accessibilityLabel="Do you have insurance?"
          >
            <InsuranceCheckbox checked={hasInsurance} />
            <View style={styles.checkTextWrap}>
              <Text style={[styles.checkLabel, hasInsurance && styles.checkLabelOn]}>
                {hasInsurance ? "Yes, I'm covered" : "Not right now"}
              </Text>
              <Text style={[type.bodySmall, styles.copy]}>
                {hasInsurance
                  ? "Shows a green dot on your profile."
                  : "Tap to mark yourself covered."}
              </Text>
            </View>
          </Pressable>
        </GlassCard>

        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>INSURER</Text>
          <TextInput
            value={provider}
            onChangeText={setProvider}
            placeholder="HDFC ERGO"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            underlineColorAndroid="transparent"
          />

          <Text style={[type.kicker, styles.dim, styles.fieldSpacing]}>POLICY NAME</Text>
          <TextInput
            value={policyName}
            onChangeText={setPolicyName}
            placeholder="Two Wheeler Comprehensive"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            underlineColorAndroid="transparent"
          />
        </GlassCard>

        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>COVERAGE</Text>
          <TextInput
            value={coverage}
            onChangeText={setCoverage}
            placeholder="e.g. ₹5,00,000 personal accident"
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[styles.input, styles.multilineInput]}
          />
        </GlassCard>

        <Text style={[type.kicker, styles.sectionLabel]}>PREFERENCE</Text>
        <GlassCard>
          <Text style={[type.bodySmall, styles.copy]}>
            If you're in a crash and there's a choice, where would you rather be taken?
          </Text>
          <View style={styles.preferenceRow}>
            {PREFERENCES.map((option) => {
              const active = preference === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.preferenceOption, active && styles.preferenceOptionActive]}
                  onPress={() => setPreference(active ? null : option.value)}
                >
                  <Text style={[styles.preferenceLabel, active && styles.preferenceLabelActive]}>{option.label}</Text>
                  <Text style={[type.bodySmall, styles.preferenceHint]}>{option.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        <PillButton title={saving ? "SAVING…" : "SAVE CHANGES"} onPress={handleSave} loading={saving} />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  body: { paddingHorizontal: spacing.xl, gap: spacing.lg, marginTop: spacing.md },
  dim: { color: colors.textDim },
  copy: { color: colors.textMuted },
  sectionLabel: { color: colors.textDim },
  error: { color: colors.accent, textAlign: "center", ...type.bodySmall },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.lg },
  checkbox: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFillRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted },
  checkTextWrap: { flex: 1 },
  checkLabel: { ...type.body, color: colors.textMuted, marginBottom: spacing.xs },
  checkLabelOn: { color: colors.text },
  input: {
    ...type.body,
    color: colors.text,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.glassFillRaised,
  },
  fieldSpacing: { marginTop: spacing.md },
  multilineInput: { minHeight: 72 },
  preferenceRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  preferenceOption: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.glassFillRaised,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  preferenceOptionActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted },
  preferenceLabel: { color: colors.textMuted, fontFamily: type.button.fontFamily, fontSize: 13, letterSpacing: 1 },
  preferenceLabelActive: { color: colors.accent },
  preferenceHint: { color: colors.textDim, marginTop: spacing.sm },
});
