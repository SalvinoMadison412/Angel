import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { colors, radius, spacing } from "../theme";

interface Props extends ViewProps {
  raised?: boolean;
  accentBorder?: boolean;
  padded?: boolean;
}

export function GlassCard({ style, raised, accentBorder, padded = true, children, ...rest }: Props) {
  return (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        raised && { backgroundColor: colors.glassFillRaised },
        accentBorder && styles.accentBorder,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  padded: {
    padding: spacing.lg,
  },
  accentBorder: {
    borderColor: colors.accentBorder,
  },
});
