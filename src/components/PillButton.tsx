import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, spacing, type } from "../theme";

type Variant = "primary" | "inverse" | "outline" | "ghost" | "danger";

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function PillButton({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  fullWidth = true,
  style,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "inverse" ? colors.bg : variant === "danger" ? "#FFFFFF" : colors.text} />
      ) : (
        <Text style={[styles.label, textVariantStyles[variant]]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
  },
  label: {
    ...type.button,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
});

const variantStyles: Record<Variant, ViewStyle> = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  inverse: { backgroundColor: colors.text },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.glassBorder },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
});

const textVariantStyles: Record<Variant, { color: string }> = {
  primary: { color: "#FFFFFF" },
  inverse: { color: colors.bg },
  outline: { color: colors.text },
  ghost: { color: colors.accent },
  danger: { color: "#FFFFFF" },
};

export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={rowStyles.row}>{children}</View>;
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
