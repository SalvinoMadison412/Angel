import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily } from "../theme";

interface Props {
  initials: string;
  size?: number;
  accent?: boolean;
  /** Photo URL, if the person has one set — falls back to initials when absent. */
  imageUri?: string | null;
}

export function Avatar({ initials, size = 40, accent, imageUri }: Props) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: accent ? colors.accentBorder : colors.glassBorder,
        },
      ]}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.32 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.glassFillRaised,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: fontFamily.monoBold,
    color: colors.text,
  },
});
