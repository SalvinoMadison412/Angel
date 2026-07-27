import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";

interface Props {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <Text style={[type.kicker, styles.title]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.side} />
      )}
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  side: {
    minWidth: 32,
  },
  rightSide: {
    alignItems: "flex-end",
  },
  back: {
    color: colors.text,
    fontSize: 20,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.textMuted,
  },
});
