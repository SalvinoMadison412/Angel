import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar, GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { useDevice, useEmergencyProfile, useProfile } from "../../hooks";
import { localDigits, toE164 } from "../../lib/phone";
import { ProfileStackNavigation } from "../../navigation/types";
import { colors, radius, spacing, type } from "../../theme";
import { BloodGroup } from "../../types/database";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

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
 * Reached from Settings → Edit Profile. Always in edit mode — unlike the
 * old inline-toggle version this replaced on ProfileScreen, there's no
 * separate view state here; ProfileScreen itself is the read-only view now.
 * Saves all three underlying sources (profiles, devices, emergency_profiles)
 * together and goes back to Settings on success.
 */
export function EditProfileScreen() {
  const navigation = useNavigation<ProfileStackNavigation>();
  const profile = useProfile();
  const emergencyProfile = useEmergencyProfile();
  const device = useDevice();

  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const personalLoaded = useRef(false);

  const [bikeMake, setBikeMake] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const bikeLoaded = useRef(false);

  const [fullName, setFullName] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [conditions, setConditions] = useState("");
  const emergencyLoaded = useRef(false);

  useEffect(() => {
    if (personalLoaded.current || !profile.data) return;
    personalLoaded.current = true;
    setName(profile.data.name ?? "");
    setPhone(localDigits(profile.data.phone ?? ""));
  }, [profile.data]);

  useEffect(() => {
    if (bikeLoaded.current || !device.data) return;
    bikeLoaded.current = true;
    setBikeMake(device.data.bike_make ?? "");
    setBikeModel(device.data.bike_model ?? "");
  }, [device.data]);

  useEffect(() => {
    if (emergencyLoaded.current || !emergencyProfile.data) return;
    emergencyLoaded.current = true;
    const data = emergencyProfile.data;
    setFullName(data.full_name ?? "");
    setBloodGroup(data.blood_group ?? null);
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

  const nameError = showErrors && name.trim().length === 0 ? "Name can't be blank." : null;
  const phoneError = showErrors && phone.length !== 10 ? "Enter a valid 10-digit phone number." : null;
  const canSave = name.trim().length > 0 && phone.length === 10 && dobValid;

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photo access needed",
        "Angel needs permission to your photo library to set a profile picture. You can grant this in system Settings."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      await profile.uploadAvatar.mutateAsync(result.assets[0].uri);
    } catch (err) {
      Alert.alert("Couldn't upload photo", err instanceof Error ? err.message : "Try again.");
    }
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
        profile.save.mutateAsync({ name: name.trim(), phone: toE164(phone) }),
        device.saveBikeInfo.mutateAsync({ bikeMake: bikeMake.trim() || null, bikeModel: bikeModel.trim() || null }),
        emergencyProfile.save.mutateAsync({
          fullName: fullName.trim() || null,
          dateOfBirth: dobEntered && isValidDate(dayNum, monthNum, yearNum) ? `${yearNum}-${pad2(monthNum)}-${pad2(dayNum)}` : null,
          bloodGroup,
          medicalConditions: conditions.trim() || null,
        }),
      ]);
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save changes — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader
        title="EDIT PROFILE"
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={handleSave} hitSlop={12} disabled={saving}>
            <Text style={[type.button, styles.saveAction, saving && styles.saveActionDisabled]}>
              {saving ? "SAVING…" : "SAVE"}
            </Text>
          </Pressable>
        }
      />

      <View style={styles.body}>
        <Pressable style={styles.avatarRow} onPress={handlePickAvatar} disabled={profile.uploadAvatar.isPending}>
          <View style={styles.avatarWrap}>
            <Avatar initials={initialsFor(name || "?")} size={72} imageUri={profile.data?.avatar_url} accent />
            {profile.uploadAvatar.isPending && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={colors.text} />
              </View>
            )}
          </View>
          <Text style={styles.avatarAction}>{profile.data?.avatar_url ? "CHANGE PHOTO" : "ADD PHOTO"}</Text>
        </Pressable>

        {saveError && <Text style={styles.error}>{saveError}</Text>}

        <Text style={[type.kicker, styles.sectionLabel]}>PERSONAL INFO</Text>
        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>FULL NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Anita Sharma"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            underlineColorAndroid="transparent"
          />
          {nameError && <Text style={styles.fieldError}>{nameError}</Text>}
        </GlassCard>

        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>PHONE</Text>
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
          {phoneError && <Text style={styles.fieldError}>{phoneError}</Text>}
        </GlassCard>

        <Text style={[type.kicker, styles.sectionLabel]}>BIKE</Text>
        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>MAKE</Text>
          <TextInput
            value={bikeMake}
            onChangeText={setBikeMake}
            placeholder="Honda"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            underlineColorAndroid="transparent"
          />
          <Text style={[type.kicker, styles.dim, styles.fieldSpacing]}>MODEL</Text>
          <TextInput
            value={bikeModel}
            onChangeText={setBikeModel}
            placeholder="Activa 125"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            underlineColorAndroid="transparent"
          />
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

        <PillButton title={saving ? "SAVING…" : "SAVE CHANGES"} onPress={handleSave} loading={saving} />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  body: { paddingHorizontal: spacing.xl, gap: spacing.lg, marginTop: spacing.md },
  dim: { color: colors.textDim },
  saveAction: { color: colors.accent },
  saveActionDisabled: { opacity: 0.5 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatarWrap: { position: "relative" },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarAction: { color: colors.accent, fontFamily: type.button.fontFamily, fontSize: 12, letterSpacing: 1 },
  sectionLabel: { color: colors.textDim },
  accentText: { color: colors.accent },
  copy: { color: colors.textMuted },
  consentCopy: { marginTop: spacing.md },
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
  error: { color: colors.accent, textAlign: "center", ...type.bodySmall },
});
