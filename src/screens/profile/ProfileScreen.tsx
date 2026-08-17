import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Avatar, GlassCard, ScreenBackground } from "../../components";
import { useDevice, useEmergencyProfile, useProfile } from "../../hooks";
import { localDigits } from "../../lib/phone";
import { ProfileStackNavigation } from "../../navigation/types";
import { colors, spacing, type } from "../../theme";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Line-art gear matching TabBarIcon's hand-drawn style — used nowhere else,
// so it lives here rather than as a shared component.
function GearIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.75} fill="none" />
      <Path
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.66 6.34l-1.42 1.42M7.76 16.24l-1.42 1.42M17.66 17.66l-1.42-1.42M7.76 7.76 6.34 6.34"
      />
    </Svg>
  );
}

/**
 * Profile tab root screen — a read-only summary of account, bike, and
 * emergency info, same split as Instagram/WhatsApp: this screen is the
 * "who you are" view, Settings (via the gear icon) is where anything
 * actually changes — see SettingsScreen (Edit Profile, Log out, Delete
 * account) and EditProfileScreen (the fields themselves).
 */
export function ProfileScreen() {
  const navigation = useNavigation<ProfileStackNavigation>();
  const profile = useProfile();
  const emergencyProfile = useEmergencyProfile();
  const device = useDevice();

  const name = profile.data?.name ?? "";
  const phone = localDigits(profile.data?.phone ?? "");
  const dob = emergencyProfile.data?.date_of_birth;
  const dobDisplay = dob ? (() => {
    const [y, m, d] = dob.split("-");
    return `${d}/${m}/${y}`;
  })() : "—";

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[type.kicker, styles.dim]}>ACCOUNT</Text>
          <Text style={[type.title, styles.title]}>Profile</Text>
        </View>
        <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={12} style={styles.gearButton}>
          <GearIcon color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={[type.bodySmall, styles.subtitle]}>Your account, bike, and emergency details.</Text>

      <View style={styles.avatarRow}>
        <Avatar initials={initialsFor(name || "?")} size={72} imageUri={profile.data?.avatar_url} accent />
        <View>
          <Text style={styles.avatarName}>{name || "—"}</Text>
          <Text style={[type.bodySmall, styles.avatarPhone]}>{phone ? `+91 ${phone}` : "—"}</Text>
        </View>
      </View>

      <Text style={[type.kicker, styles.sectionLabel]}>BIKE</Text>
      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>MAKE</Text>
        <Text style={styles.value}>{device.data?.bike_make || "—"}</Text>
        <Text style={[type.kicker, styles.dim, styles.fieldSpacing]}>MODEL</Text>
        <Text style={styles.value}>{device.data?.bike_model || "—"}</Text>
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
        <Text style={styles.value}>{dobDisplay}</Text>
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>BLOOD GROUP</Text>
        <Text style={styles.value}>{emergencyProfile.data?.blood_group ?? "—"}</Text>
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>ALLERGIES / CONDITIONS</Text>
        <Text style={styles.value}>{emergencyProfile.data?.medical_conditions || "—"}</Text>
      </GlassCard>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  dim: { color: colors.textDim },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { color: colors.text, marginTop: spacing.xs },
  gearButton: { paddingTop: spacing.xs },
  subtitle: { color: colors.textMuted, marginBottom: spacing.xs },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatarName: { ...type.body, color: colors.text, fontFamily: type.button.fontFamily, fontSize: 17 },
  avatarPhone: { color: colors.textMuted, marginTop: spacing.xs },
  sectionLabel: { color: colors.textDim, marginTop: spacing.xs },
  accentText: { color: colors.accent },
  copy: { color: colors.textMuted },
  consentCopy: { marginTop: spacing.md },
  value: { ...type.body, color: colors.text, marginTop: spacing.sm },
  fieldSpacing: { marginTop: spacing.md },
});
