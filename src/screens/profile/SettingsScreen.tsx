import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, ConfirmModal, GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { useAuth, useDeleteAccount, useProfile } from "../../hooks";
import { localDigits } from "../../lib/phone";
import { ProfileStackNavigation } from "../../navigation/types";
import { colors, radius, spacing, type } from "../../theme";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function SettingsScreen() {
  const navigation = useNavigation<ProfileStackNavigation>();
  const { signOut } = useAuth();
  const profile = useProfile();
  const deleteAccount = useDeleteAccount();

  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const name = profile.data?.name ?? "";
  const phone = localDigits(profile.data?.phone ?? "");

  const handleLogout = () => {
    Alert.alert("Log out?", "You'll need to verify your phone number again to sign back in.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          await signOut();
          // No navigation needed — RootNavigator swaps to AuthNavigator on
          // its own the moment the session clears.
        },
      },
    ]);
  };

  const handleConfirmDelete = async () => {
    setDeleteError(null);
    try {
      await deleteAccount.mutateAsync();
      setConfirmVisible(false);
      await signOut();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete your account — try again.");
    }
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader title="SETTINGS" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <Pressable style={styles.profileRow} onPress={() => navigation.navigate("EditProfile")}>
          <Avatar initials={initialsFor(name || "?")} size={52} imageUri={profile.data?.avatar_url} accent />
          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName}>{name || "Edit your profile"}</Text>
            <Text style={[type.bodySmall, styles.profileSub]}>{phone ? `+91 ${phone}` : "Tap to add your details"}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.divider} />

        <PillButton title="LOG OUT" variant="outline" onPress={handleLogout} loading={loggingOut} />

        <View style={styles.divider} />

        <Text style={[type.kicker, styles.sectionLabel]}>DANGER ZONE</Text>
        <GlassCard>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={[type.bodySmall, styles.dangerCopy]}>
            Permanently deletes your profile, guardians, medical info, and incident history. This cannot be undone.
          </Text>
          <View style={styles.dangerButtonSpacing}>
            <PillButton title="DELETE ACCOUNT" variant="danger" onPress={() => setConfirmVisible(true)} />
          </View>
        </GlassCard>
      </View>

      <ConfirmModal
        visible={confirmVisible}
        title="Delete your account?"
        body="This will permanently delete your profile, guardians, medical info, and incident history. This cannot be undone."
        confirmLabel="Delete account"
        destructive
        loading={deleteAccount.isPending}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteError(null);
          setConfirmVisible(false);
        }}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  body: { paddingHorizontal: spacing.xl, gap: spacing.lg, marginTop: spacing.md },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  profileTextWrap: { flex: 1 },
  profileName: { ...type.body, color: colors.text, fontFamily: type.button.fontFamily, fontSize: 16 },
  profileSub: { color: colors.textMuted, marginTop: spacing.xs },
  chevron: { color: colors.textDim, fontSize: 20 },
  divider: { height: 1, backgroundColor: colors.divider },
  sectionLabel: { color: colors.textDim },
  dangerTitle: { ...type.body, color: colors.danger, fontFamily: type.button.fontFamily, fontSize: 15 },
  dangerCopy: { color: colors.textMuted, marginTop: spacing.sm },
  dangerButtonSpacing: { marginTop: spacing.lg },
});
