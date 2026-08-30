import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "../theme";

type Variant = "accent" | "neutral" | "outline";

interface Props {
  label: string;
  variant?: Variant;
}

export function Tag({ label, variant = "neutral" }: Props) {
  return (
    <View style={[styles.base, variantStyles[variant]]}>
      <Text style={[type.kicker, textVariantStyles[variant]]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
    // RN flex children default to flexShrink: 0, but say it out loud: every
    // caller sits this pill in a row beside a variable-length label, and a
    // squashed pill is how "ACTION NEEDED" ends up clipped into its
    // neighbour on a narrow screen or at a large system font scale.
    flexShrink: 0,
  },
});

const variantStyles = StyleSheet.create({
  accent: { backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accentBorder },
  neutral: { backgroundColor: colors.glassFillRaised, borderWidth: 1, borderColor: colors.glassBorder },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.glassBorder },
});

const textVariantStyles: Record<Variant, { color: string }> = {
  accent: { color: colors.accent },
  neutral: { color: colors.textMuted },
  outline: { color: colors.textMuted },
};
