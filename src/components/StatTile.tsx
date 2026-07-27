import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";
import { GlassCard } from "./GlassCard";

interface Props {
  label: string;
  value: string;
  unit: string;
}

export function StatTile({ label, value, unit }: Props) {
  return (
    <GlassCard style={styles.card} padded={false}>
      <View style={styles.inner}>
        <Text style={[type.kicker, styles.label]}>{label}</Text>
        <Text style={[type.statValue, styles.value]}>{value}</Text>
        <Text style={[type.label, styles.unit]}>{unit}</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  inner: {
    padding: spacing.md,
  },
  label: {
    color: colors.textDim,
    marginBottom: spacing.sm,
  },
  value: {
    color: colors.text,
  },
  unit: {
    color: colors.textMuted,
    marginTop: 2,
  },
});
