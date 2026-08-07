import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground } from "../../components";
import { useDevice, useEmergencyProfile, useProfile } from "../../hooks";
import { colors, radius, spacing, type } from "../../theme";
import { BloodGroup } from "../../types/database";

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
 * Profile tab root screen — account/personal info, bike details, and the
 * emergency/medical profile onboarding collects. View mode shows static
 * text; EDIT switches every field to an input and reveals CANCEL. SAVE
 * writes all three underlying sources (profiles, devices, emergency_profiles)
 * together and returns to view mode.
 */
/** Strips any country-code prefix/formatting and keeps just the 10-digit local number, matching PhoneEntryScreen's stored shape. */
function localDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function ProfileScreen() {
  const profile = useProfile();
  const emergencyProfile = useEmergencyProfile();
  const device = useDevice();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Personal info (profiles table)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const personalLoaded = useRef(false);

  // Bike (devices table)
  const [bikeMake, setBikeMake] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const bikeLoaded = useRef(false);

  // Emergency / medical (emergency_profiles table)
  const [fullName, setFullName] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [conditions, setConditions] = useState("");
  const emergencyLoaded = useRef(false);

  const loadPersonal = () => {
    setName(profile.data?.name ?? "");
    setPhone(localDigits(profile.data?.phone ?? ""));
  };
  const loadBike = () => {
    setBikeMake(device.data?.bike_make ?? "");
    setBikeModel(device.data?.bike_model ?? "");
  };
  const loadEmergency = () => {
    const data = emergencyProfile.data;
    setFullName(data?.full_name ?? "");
    setBloodGroup(data?.blood_group ?? null);
    setConditions(data?.medical_conditions ?? "");
    if (data?.date_of_birth) {
      const [y, m, d] = data.date_of_birth.split("-");
      setYear(y);
      setMonth(m);
      setDay(d);
    } else {
      setYear("");
      setMonth("");
      setDay("");
    }
  };

  useEffect(() => {
    if (personalLoaded.current || !profile.data) return;
    personalLoaded.current = true;
    loadPersonal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data]);

  useEffect(() => {
    if (bikeLoaded.current || !device.data) return;
    bikeLoaded.current = true;
    loadBike();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.data]);

  useEffect(() => {
    if (emergencyLoaded.current || !emergencyProfile.data) return;
    emergencyLoaded.current = true;
    loadEmergency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencyProfile.data]);

  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  const dobEntered = day.length > 0 || month.length > 0 || year.length > 0;
  const dobValid = !dobEntered || isValidDate(dayNum, monthNum, yearNum);
  const dobDisplay = dobEntered ? `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}` : "—";

  const nameError = showErrors && name.trim().length === 0 ? "Name can't be blank." : null;
  const phoneError = showErrors && phone.length !== 10 ? "Enter a valid 10-digit phone number." : null;
  const canSave = name.trim().length > 0 && phone.length === 10 && dobValid;

  const handleEdit = () => {
    setJustSaved(false);
    setSaveError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    loadPersonal();
    loadBike();
    loadEmergency();
    setShowErrors(false);
    setSaveError(null);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!canSave) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all([
        profile.save.mutateAsync({ name: name.trim(), phone: `+91${phone}` }),
        device.saveBikeInfo.mutateAsync({ bikeMake: bikeMake.trim() || null, bikeModel: bikeModel.trim() || null }),
        emergencyProfile.save.mutateAsync({
          fullName: fullName.trim() || null,
          dateOfBirth: dobEntered && isValidDate(dayNum, monthNum, yearNum) ? `${yearNum}-${pad2(monthNum)}-${pad2(dayNum)}` : null,
          bloodGroup,
          medicalConditions: conditions.trim() || null,
        }),
      ]);
      setShowErrors(false);
      setEditing(false);
      setJustSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save changes — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[type.kicker, styles.dim]}>ACCOUNT</Text>
          <Text style={[type.title, styles.title]}>Profile</Text>
        </View>
        <Pressable onPress={editing ? handleSave : handleEdit} hitSlop={12} disabled={saving}>
          <Text style={[type.button, styles.editAction, saving && styles.editActionDisabled]}>
            {editing ? (saving ? "SAVING…" : "SAVE") : "EDIT"}
          </Text>
        </Pressable>
      </View>
      <Text style={[type.bodySmall, styles.subtitle]}>Your account, bike, and emergency details.</Text>
      {justSaved && <Text style={styles.saved}>Saved.</Text>}
      {saveError && <Text style={styles.error}>{saveError}</Text>}

      <Text style={[type.kicker, styles.sectionLabel]}>PERSONAL INFO</Text>
      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>FULL NAME</Text>
        {editing ? (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Anita Sharma"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            underlineColorAndroid="transparent"
          />
        ) : (
          <Text style={styles.value}>{name || "—"}</Text>
        )}
        {nameError && <Text style={styles.fieldError}>{nameError}</Text>}
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>PHONE</Text>
        {editing ? (
          <View style={styles.phoneRow}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>+91</Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
              placeholder="98450 11204"
              placeholderTextColor={colors.textDim}
              keyboardType="phone-pad"
              maxLength={10}
              style={[styles.input, styles.phoneInput]}
              underlineColorAndroid="transparent"
            />
          </View>
        ) : (
          <Text style={styles.value}>{phone ? `+91 ${phone}` : "—"}</Text>
        )}
        {phoneError && <Text style={styles.fieldError}>{phoneError}</Text>}
      </GlassCard>

      <Text style={[type.kicker, styles.sectionLabel]}>BIKE</Text>
      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>MAKE</Text>
        {editing ? (
          <TextInput
            value={bikeMake}
            onChangeText={setBikeMake}
            placeholder="Honda"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            underlineColorAndroid="transparent"
          />
        ) : (
          <Text style={styles.value}>{bikeMake || "—"}</Text>
        )}
        <Text style={[type.kicker, styles.dim, styles.fieldSpacing]}>MODEL</Text>
        {editing ? (
          <TextInput
            value={bikeModel}
            onChangeText={setBikeModel}
            placeholder="Activa 125"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            underlineColorAndroid="transparent"
          />
        ) : (
          <Text style={styles.value}>{bikeModel || "—"}</Text>
        )}
      </GlassCard>

      <Text style={[type.kicker, styles.sectionLabel]}>EMERGENCY INFO</Text>

      <GlassCard accentBorder>
        <Text style={[type.kicker, styles.accentText]}>WHY WE ASK</Text>
        <Text style={[type.bodySmall, styles.copy, styles.consentCopy]}>
          This is shared with emergency responders only at the moment of a confirmed crash alert — never
          displayed anywhere else in the app, never sold, never used for anything else.
        </Text>
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>DATE OF BIRTH</Text>
        {editing ? (
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
        ) : (
          <Text style={styles.value}>{dobDisplay}</Text>
        )}
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>BLOOD GROUP</Text>
        {editing ? (
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
        ) : (
          <Text style={styles.value}>{bloodGroup ?? "—"}</Text>
        )}
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>ALLERGIES / CONDITIONS (OPTIONAL)</Text>
        {editing ? (
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
        ) : (
          <Text style={styles.value}>{conditions || "—"}</Text>
        )}
      </GlassCard>

      {editing && <PillButton title="CANCEL" variant="outline" onPress={handleCancel} disabled={saving} />}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  dim: { color: colors.textDim },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { color: colors.text, marginTop: spacing.xs },
  editAction: { color: colors.accent, paddingTop: spacing.xs },
  editActionDisabled: { opacity: 0.5 },
  subtitle: { color: colors.textMuted, marginBottom: spacing.xs },
  sectionLabel: { color: colors.textDim, marginTop: spacing.xs },
  accentText: { color: colors.accent },
  copy: { color: colors.textMuted },
  consentCopy: { marginTop: spacing.md },
  value: { ...type.body, color: colors.text, marginTop: spacing.sm },
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
  fieldSpacing: { marginTop: spacing.md },
  multilineInput: { minHeight: 96 },
  phoneRow: { flexDirection: "row", gap: spacing.md },
  codeBox: {
    marginTop: spacing.sm,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.glassFillRaised,
  },
  codeText: { ...type.body, color: colors.text, fontFamily: type.button.fontFamily },
  phoneInput: { flex: 1, letterSpacing: 2 },
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
  saved: { color: colors.accent, textAlign: "center", ...type.bodySmall },
  error: { color: colors.accent, textAlign: "center", ...type.bodySmall },
});
