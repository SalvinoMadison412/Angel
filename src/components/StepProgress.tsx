import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";

interface Props {
  steps: number;
  current: number;
}

export function StepProgress({ steps, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: steps }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            i < current && styles.done,
            i === current - 1 && styles.active,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBorder,
  },
  done: {
    backgroundColor: colors.text,
  },
  active: {
    backgroundColor: colors.accent,
  },
});
