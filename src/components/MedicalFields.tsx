import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Dob } from "../lib/dob";
import { colors, radius, spacing, type } from "../theme";
import { BloodGroup } from "../types/database";
import { GlassCard } from "./GlassCard";

// The two emergency-profile fields collected in both onboarding
// (OnboardingScreen's AboutYou/Medical steps) and Edit Profile — identical
// markup and styling in both places before this existed. Presentational
// only: each screen keeps its own validation and save rules, since DOB is
// required to finish onboarding but optional when editing later.

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const digits = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max);

export function DateOfBirthField({
  value,
  onChange,
  error,
}: {
  value: Dob;
  onChange: (next: Dob) => void;
  error?: string | null;
}) {
  return (
    <GlassCard>
      <Text style={[type.kicker, styles.dim]}>DATE OF BIRTH</Text>
      <View style={styles.dobRow}>
        <TextInput
          value={value.day}
          onChangeText={(v) => onChange({ ...value, day: digits(v, 2) })}
          placeholder="DD"
          placeholderTextColor={colors.textDim}
          keyboardType="number-pad"
          maxLength={2}
          style={[styles.input, styles.dobInput]}
          underlineColorAndroid="transparent"
        />
        <TextInput
          value={value.month}
          onChangeText={(v) => onChange({ ...value, month: digits(v, 2) })}
          placeholder="MM"
          placeholderTextColor={colors.textDim}
          keyboardType="number-pad"
          maxLength={2}
          style={[styles.input, styles.dobInput]}
          underlineColorAndroid="transparent"
        />
        <TextInput
          value={value.year}
          onChangeText={(v) => onChange({ ...value, year: digits(v, 4) })}
          placeholder="YYYY"
          placeholderTextColor={colors.textDim}
          keyboardType="number-pad"
          maxLength={4}
          style={[styles.input, styles.dobInputYear]}
          underlineColorAndroid="transparent"
        />
      </View>
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </GlassCard>
  );
}

export function BloodGroupPicker({
  value,
  onChange,
}: {
  value: BloodGroup | null;
  onChange: (next: BloodGroup | null) => void;
}) {
  return (
    <GlassCard>
      <Text style={[type.kicker, styles.dim]}>BLOOD GROUP</Text>
      <View style={styles.bloodGrid}>
        {BLOOD_GROUPS.map((group) => {
          const active = value === group;
          return (
            <Pressable
              key={group}
              style={[styles.bloodOption, active && styles.bloodOptionActive]}
              // Tapping the selected group clears it — a mis-tap during
              // onboarding used to be unrecoverable, and blood group is
              // optional there anyway.
              onPress={() => onChange(active ? null : group)}
            >
              <Text style={[styles.bloodText, active && styles.bloodTextActive]}>{group}</Text>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textDim },
  fieldError: { ...type.label, color: colors.accent, marginTop: spacing.xs },
  input: {
    ...type.body,
    color: colors.text,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.glassFillRaised,
  },
  dobRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  dobInput: { flex: 1, marginTop: 0, textAlign: "center" },
  dobInputYear: { flex: 1.6, marginTop: 0, textAlign: "center" },
  bloodGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  bloodOption: {
    width: "22%",
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: "center",
    backgroundColor: colors.glassFillRaised,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  bloodOptionActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted },
  bloodText: { color: colors.textMuted, fontFamily: type.button.fontFamily, fontSize: 13 },
  bloodTextActive: { color: colors.accent },
});
