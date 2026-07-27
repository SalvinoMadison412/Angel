import React from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";
import { DotGridBackground } from "./DotGridBackground";

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
  contentStyle?: ViewStyle;
  backgroundColor?: string;
}

export function ScreenBackground({
  children,
  scroll,
  edges = ["top", "bottom"],
  contentStyle,
  backgroundColor = colors.bg,
}: Props) {
  return (
    <View style={[styles.flex, { backgroundColor }]}>
      <DotGridBackground />
      <SafeAreaView style={styles.flex} edges={edges}>
        {scroll ? (
          <ScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
