import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, GlassCard, ScreenBackground, Tag } from "../../components";
import { guardianTag, initialsFor, useGuardians } from "../../hooks/useGuardians";
import { colors, fontFamily, spacing, type } from "../../theme";
import { AppTabNavigation } from "../../navigation/types";

export function GuardiansScreen() {
  const navigation = useNavigation<AppTabNavigation<"Guardians">>();
  const { data: guardians, reorderGuardians } = useGuardians();

  const list = guardians ?? [];

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderGuardians.mutate(reordered.map((g) => g.id));
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <Text style={[type.kicker, styles.dim]}>RESPONSE CHAIN</Text>
      <Text style={[type.title, styles.title]}>Guardians</Text>
      <Text style={[type.bodySmall, styles.subtitle]}>
        Called in this order the moment a crash is confirmed. Use the arrows to reorder.
      </Text>

      {list.map((guardian, index) => (
        <Pressable key={guardian.id} onPress={() => navigation.navigate("GuardianForm", { guardianId: guardian.id })}>
          <GlassCard style={styles.row}>
            <View style={styles.rowInner}>
              <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
              <Avatar initials={initialsFor(guardian.name)} />
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{guardian.name}</Text>
                  <Tag label={guardianTag(index, guardian.alert_mode)} variant={index === 0 ? "accent" : "neutral"} />
                </View>
                <Text style={styles.meta}>
                  {(guardian.relationship ?? "GUARDIAN").toUpperCase()} · {guardian.phone}
                </Text>
              </View>
              <View style={styles.handle}>
                <Pressable onPress={() => move(index, -1)} hitSlop={8}>
                  <Text style={styles.handleArrow}>▲</Text>
                </Pressable>
                <Pressable onPress={() => move(index, 1)} hitSlop={8}>
                  <Text style={styles.handleArrow}>▼</Text>
                </Pressable>
              </View>
            </View>
          </GlassCard>
        </Pressable>
      ))}

      <Pressable onPress={() => navigation.navigate("GuardianForm", {})}>
        <View style={styles.addCard}>
          <Text style={styles.addText}>+ ADD GUARDIAN</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => navigation.navigate("EmergencyProfile")}>
        <GlassCard style={styles.row}>
          <View style={styles.rowInner}>
            <View style={styles.info}>
              <Text style={styles.name}>Emergency Profile</Text>
              <Text style={styles.meta}>NAME · DOB · BLOOD GROUP · CONDITIONS</Text>
            </View>
            <Text style={styles.handleArrow}>→</Text>
          </View>
        </GlassCard>
      </Pressable>

      <GlassCard style={styles.infoCard}>
        <Text style={[type.kicker, styles.infoKicker]}>IF NO ONE ANSWERS</Text>
        <Text style={[type.bodySmall, styles.infoBody]}>
          After 90 seconds Angel dispatches the nearest onboarded gig partner. Severity 4–5 also calls an auto or cab
          to the exact drop pin.
        </Text>
        <View style={styles.infoTags}>
          <Tag label="GIG RIDERS · S1–S3" variant="outline" />
          <Tag label="CAR / AUTO · S4–S5" variant="accent" />
        </View>
      </GlassCard>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  dim: { color: colors.textDim },
  title: { color: colors.text, marginTop: spacing.xs },
  subtitle: { color: colors.textMuted, marginBottom: spacing.md },
  row: {},
  rowInner: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  index: { color: colors.textDim, fontFamily: type.kicker.fontFamily, fontSize: 11, width: 18 },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  name: { color: colors.text, fontFamily: fontFamily.bodySemiBold, fontSize: 15 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 4, fontFamily: type.label.fontFamily },
  handle: { alignItems: "center", gap: 2 },
  handleArrow: { color: colors.textMuted, fontSize: 14 },
  addCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.glassBorder,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  addText: { color: colors.textMuted, fontFamily: type.button.fontFamily, fontSize: 13, letterSpacing: 1.5 },
  infoCard: { marginTop: spacing.md },
  infoKicker: { color: colors.accent },
  infoBody: { color: colors.textMuted, marginTop: spacing.md },
  infoTags: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
});
