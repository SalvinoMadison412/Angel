import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";
import { GlassCard } from "./GlassCard";

interface Props {
  label: string;
  value: string;
  unit?: string;
  /** Small note below the value/unit — e.g. when the reading was taken. */
  caption?: string;
  /** Renders `value` as a muted placeholder message instead of a stat, with no unit. */
  empty?: boolean;
}

export function StatTile({ label, value, unit, caption, empty }: Props) {
  return (
    <GlassCard style={styles.card} padded={false}>
      <View style={styles.inner}>
        <Text style={[type.kicker, styles.label]}>{label}</Text>
        {empty ? (
          <Text style={[type.bodySmall, styles.emptyValue]}>{value}</Text>
        ) : (
          <>
            <Text style={[type.statValue, styles.value]}>{value}</Text>
            {unit ? <Text style={[type.label, styles.unit]}>{unit}</Text> : null}
          </>
        )}
        {caption ? <Text style={[type.label, styles.caption]}>{caption}</Text> : null}
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
  emptyValue: {
    color: colors.textDim,
    marginTop: 2,
  },
  caption: {
    color: colors.textDim,
    marginTop: spacing.sm,
    fontSize: 10,
  },
});
