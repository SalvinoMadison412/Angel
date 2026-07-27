import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing, severityColor } from "../theme";

interface Props {
  severity: number;
  max?: number;
}

export function SeverityMeter({ severity, max = 5 }: Props) {
  const color = severityColor(severity);
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            i < severity && { backgroundColor: color },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBorder,
  },
});
