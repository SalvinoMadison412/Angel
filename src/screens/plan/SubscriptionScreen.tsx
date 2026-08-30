import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader, Tag } from "../../components";
import { PLAN_PRICES, daysLeft, useCurrentSubscription, usePurchaseSubscription } from "../../hooks/useSubscription";
import { SubscriptionTier } from "../../types/database";
import { ProfileStackNavigation } from "../../navigation/types";
import { colors, spacing, type } from "../../theme";

const PLANS: { tier: SubscriptionTier; perMonth: number; note: string; badge: string }[] = [
  { tier: 3, perMonth: 166, note: "Try the network", badge: "STARTER" },
  { tier: 6, perMonth: 150, note: "Save 10%", badge: "POPULAR" },
  { tier: 12, perMonth: 125, note: "Save 25% · free re-calibration", badge: "BEST VALUE" },
];

export function SubscriptionScreen() {
  const navigation = useNavigation<ProfileStackNavigation>();
  const { data: current } = useCurrentSubscription();
  const purchase = usePurchaseSubscription();
  const [selected, setSelected] = useState<SubscriptionTier>(12);
  const [confirmed, setConfirmed] = useState(false);

  const handleContinue = async () => {
    await purchase.mutateAsync(selected);
    setConfirmed(true);
  };

  if (current) {
    return (
      <ScreenBackground scroll contentStyle={styles.content}>
        <ScreenHeader title="PLAN" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <Text style={[type.kicker, styles.dim]}>COVERAGE</Text>
          <Text style={[type.title, styles.title]}>You're covered</Text>
          <GlassCard style={styles.currentCard}>
            <Text style={[type.kicker, styles.dim]}>ACTIVE PLAN</Text>
            <Text style={styles.currentTier}>{current.tier}-MONTH</Text>
            <Text style={[type.bodySmall, styles.currentMeta]}>{daysLeft(current.end_date)} DAYS LEFT</Text>
          </GlassCard>
          <Text style={[type.bodySmall, styles.footer]}>CANCEL ANYTIME · GST INCLUDED</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader title="PLAN" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={[type.kicker, styles.dim]}>COVERAGE</Text>
        <Text style={[type.title, styles.title]}>Stay covered</Text>
        <Text style={[type.bodySmall, styles.subtitle]}>
          The device is yours. The response network runs on a plan.
        </Text>

        {PLANS.map((plan) => {
          const isSelected = plan.tier === selected;
          const price = PLAN_PRICES[plan.tier];
          return (
            <Pressable key={plan.tier} onPress={() => setSelected(plan.tier)}>
              <GlassCard accentBorder={isSelected} style={styles.planCard}>
                <View style={styles.planHeaderRow}>
                  <Text style={[type.kicker, styles.dim]}>{plan.tier} MONTHS</Text>
                  <View style={[styles.radio, isSelected && styles.radioActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>₹{price.toLocaleString("en-IN")}</Text>
                  <Text style={styles.perMonth}>₹{plan.perMonth} / MO</Text>
                </View>
                <View style={styles.planFooterRow}>
                  <Text style={[type.bodySmall, styles.planNote]}>{plan.note}</Text>
                  <Tag label={plan.badge} variant={isSelected ? "accent" : "neutral"} />
                </View>
              </GlassCard>
            </Pressable>
          );
        })}

        <View style={styles.features}>
          <FeatureRow text="Unlimited detections & guardian alerts" />
        </View>

        <PillButton
          title={`CONTINUE — ₹${PLAN_PRICES[selected].toLocaleString("en-IN")}`}
          onPress={handleContinue}
          loading={purchase.isPending}
        />
        <Text style={[type.bodySmall, styles.footer]}>CANCEL ANYTIME · GST INCLUDED</Text>

        {confirmed && (
          <Text style={styles.confirmed}>Plan activated. Welcome to the network.</Text>
        )}
      </View>
    </ScreenBackground>
  );
}

function FeatureRow({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.check}>✓</Text>
      <Text style={[type.bodySmall, styles.featureText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  body: { paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.md },
  dim: { color: colors.textDim },
  title: { color: colors.text, marginTop: spacing.xs },
  subtitle: { color: colors.textMuted, marginBottom: spacing.md },
  planCard: {},
  planHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.md },
  price: { color: colors.text, fontFamily: type.statValue.fontFamily, fontSize: 28 },
  perMonth: { color: colors.textMuted, fontFamily: type.label.fontFamily, fontSize: 12, marginBottom: 4 },
  planFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // Wrap rather than squeeze — see DeviceScreen.statusRow.
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  planNote: { color: colors.textMuted, flexShrink: 1 },
  features: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  check: { color: colors.accent },
  featureText: { color: colors.textMuted },
  footer: { color: colors.textDim, textAlign: "center" },
  confirmed: { color: colors.accent, textAlign: "center", marginTop: spacing.md, ...type.bodySmall },
  currentCard: { alignItems: "center", paddingVertical: spacing.xxl },
  currentTier: { color: colors.text, fontFamily: type.display.fontFamily, fontSize: 30, marginTop: spacing.md },
  currentMeta: { color: colors.textMuted, marginTop: spacing.sm },
});
