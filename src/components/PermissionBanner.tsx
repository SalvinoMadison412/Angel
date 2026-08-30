import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePermissionSnapshot } from "../hooks/usePermissionSnapshot";
import { requiredPermissionsGranted } from "../services/permissions/permissionsStatus";
import { colors, spacing, type } from "../theme";

/**
 * Persistent, non-dismissable banner shown app-wide whenever notifications
 * or foreground location — the two permissions AGENTS.md calls out as
 * required, not optional — aren't currently granted. Covers the case the
 * one-time PermissionsGateScreen can't: a rider revoking a permission from
 * system Settings after already getting past the gate. Deliberately doesn't
 * block touches on the screen behind it (pointerEvents="box-none" on the
 * wrapper) — the gate screen itself is the hard stop for first launch; this
 * is the ongoing reminder once the rest of the app is reachable.
 */
export function PermissionBanner() {
  const snapshot = usePermissionSnapshot();
  const insets = useSafeAreaInsets();

  if (requiredPermissionsGranted(snapshot)) return null;

  // Non-empty by construction: requiredPermissionsGranted() is exactly
  // these two, so reaching here means at least one is missing.
  const missing: string[] = [];
  if (!snapshot.notifications) missing.push("notifications");
  if (!snapshot.locationForeground) missing.push("location");

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top }]}>
      <Pressable onPress={() => Linking.openSettings()} style={styles.banner}>
        <Text style={[type.bodySmall, styles.text]}>
          Angel needs {missing.join(" and ")} enabled to protect you — tap to fix in Settings.
        </Text>
        <Text style={[type.kicker, styles.cta]}>FIX IN SETTINGS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, zIndex: 1000, elevation: 1000, paddingHorizontal: spacing.md },
  banner: {
    backgroundColor: "#050508",
    borderWidth: 1,
    borderColor: "#FF4500",
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  text: { color: colors.text, flex: 1 },
  cta: { color: "#FF4500" },
});
