import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { useEmergencyProfile } from "../../hooks";
import { colors, radius, spacing, type } from "../../theme";
import { BloodGroup } from "../../types/database";
import { RootStackNavigation } from "../../navigation/types";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function isValidDate(day: number, month: number, year: number): boolean {
  if (!day || !month || !year) return false;
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Edit-later home for what onboarding collects — reachable from the
 * Guardians tab. Same fields, same honesty copy, just a single screen
 * instead of a step-by-step wizard since there's no first-run flow to pace.
 */
export function EmergencyProfileScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const emergencyProfile = useEmergencyProfile();

  const [fullName, setFullName] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [conditions, setConditions] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !emergencyProfile.data) return;
    initialized.current = true;
    const data = emergencyProfile.data;
    setFullName(data.full_name ?? "");
    setBloodGroup(data.blood_group);
    setConditions(data.medical_conditions ?? "");
    if (data.date_of_birth) {
      const [y, m, d] = data.date_of_birth.split("-");
      setYear(y);
      setMonth(m);
      setDay(d);
    }
  }, [emergencyProfile.data]);

  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  const dobEntered = day.length > 0 || month.length > 0 || year.length > 0;
  const dobValid = !dobEntered || isValidDate(dayNum, monthNum, yearNum);
  const canSave = fullName.trim().length > 0 && dobValid;

  const handleSave = async () => {
    if (!canSave) return;
    await emergencyProfile.save.mutateAsync({
      fullName: fullName.trim(),
      dateOfBirth: dobEntered && isValidDate(dayNum, monthNum, yearNum) ? `${yearNum}-${pad2(monthNum)}-${pad2(dayNum)}` : null,
      bloodGroup,
      medicalConditions: conditions.trim() || null,
    });
    navigation.goBack();
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader title="EMERGENCY PROFILE" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <GlassCard accentBorder>
          <Text style={[type.kicker, styles.accentText]}>WHY WE ASK</Text>
          <Text style={[type.bodySmall, styles.copy, styles.consentCopy]}>
            This is shared with emergency responders only at the moment of a confirmed crash alert — never
            displayed anywhere else in the app, never sold, never used for anything else.
          </Text>
        </GlassCard>

        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>FULL NAME</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Anita Sharma"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            underlineColorAndroid="transparent"
          />
        </GlassCard>

        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>DATE OF BIRTH</Text>
          <View style={styles.dobRow}>
            <TextInput
              value={day}
              onChangeText={(v) => setDay(v.replace(/\D/g, "").slice(0, 2))}
              placeholder="DD"
              placeholderTextColor={colors.textDim}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.input, styles.dobInput]}
              underlineColorAndroid="transparent"
            />
            <TextInput
              value={month}
              onChangeText={(v) => setMonth(v.replace(/\D/g, "").slice(0, 2))}
              placeholder="MM"
              placeholderTextColor={colors.textDim}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.input, styles.dobInput]}
              underlineColorAndroid="transparent"
            />
            <TextInput
              value={year}
              onChangeText={(v) => setYear(v.replace(/\D/g, "").slice(0, 4))}
              placeholder="YYYY"
              placeholderTextColor={colors.textDim}
              keyboardType="number-pad"
              maxLength={4}
              style={[styles.input, styles.dobInputYear]}
              underlineColorAndroid="transparent"
            />
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>BLOOD GROUP</Text>
          <View style={styles.bloodGrid}>
            {BLOOD_GROUPS.map((group) => (
              <Pressable
                key={group}
                style={[styles.bloodOption, bloodGroup === group && styles.bloodOptionActive]}
                onPress={() => setBloodGroup(bloodGroup === group ? null : group)}
              >
                <Text style={[styles.bloodText, bloodGroup === group && styles.bloodTextActive]}>{group}</Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>ALLERGIES / CONDITIONS (OPTIONAL)</Text>
          <TextInput
            value={conditions}
            onChangeText={setConditions}
            placeholder="e.g. Type 1 diabetes, penicillin allergy"
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[styles.input, styles.multilineInput]}
          />
        </GlassCard>

        <PillButton title="SAVE" onPress={handleSave} disabled={!canSave} loading={emergencyProfile.save.isPending} />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  body: { paddingHorizontal: spacing.xl, gap: spacing.lg, marginTop: spacing.md },
  dim: { color: colors.textDim },
  accentText: { color: colors.accent },
  copy: { color: colors.textMuted },
  consentCopy: { marginTop: spacing.md },
  input: {
    ...type.body,
    color: colors.text,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.glassFillRaised,
  },
  multilineInput: { minHeight: 96 },
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
