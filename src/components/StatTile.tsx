import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
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

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export function StatTile({ label, value, unit, caption, empty }: Props) {
  // Scaled off the current window (not a fixed pixel value) so the tile
  // stays proportional — and the value never overflows — across phone
  // sizes, from small Android screens up to flagship-size ones.
  const { width, height } = useWindowDimensions();
  const cardHeight = clamp(height * 0.15, 92, 132);
  const valueFontSize = clamp(width * 0.077, 22, 34);

  return (
    <GlassCard style={[styles.card, { height: cardHeight }]} padded={false}>
      <View style={styles.inner}>
        <Text style={[type.kicker, styles.label]} numberOfLines={1}>
          {label}
        </Text>
        {empty ? (
          <Text style={[type.bodySmall, styles.emptyValue]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
        ) : (
          <>
            <Text
              style={[type.statValue, styles.value, { fontSize: valueFontSize }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {value}
            </Text>
            {unit ? (
              <Text style={[type.label, styles.unit]} numberOfLines={1}>
                {unit}
              </Text>
            ) : null}
          </>
        )}
        {caption ? (
          <Text style={[type.label, styles.caption]} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
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
