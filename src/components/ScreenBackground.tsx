import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import React from "react";
import { ScrollView, StyleSheet, View, ViewStyle, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";
import { DotGridBackground } from "./DotGridBackground";

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
  contentStyle?: ViewStyle;
  backgroundColor?: string;
}

// This app's screens are built as a single fixed-width phone-portrait
// column. The orientation lock in app.json is meant to keep that column the
// only layout that ever has to exist, but Android's large-screen
// compatibility handling can override a declared orientation on tablets, so
// that column ends up stretched edge-to-edge on a landscape tablet instead —
// giant buttons, huge gaps. Rather than build a real tablet layout for every
// screen, cap and center the column once here so it degrades to "phone
// layout in the middle of a bigger screen" instead of "phone layout
// stretched to fill it."
const LARGE_SCREEN_BREAKPOINT = 700;
const MAX_CONTENT_WIDTH = 560;

export function ScreenBackground({
  children,
  scroll,
  edges = ["top", "bottom"],
  contentStyle,
  backgroundColor = colors.bg,
}: Props) {
  const { width } = useWindowDimensions();
  const constrain = width >= LARGE_SCREEN_BREAKPOINT;
  const constrainStyle = constrain ? { width: "100%" as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const } : null;

  // The tab bar floats over the screen (see AppTabs), so content has to
  // reserve its height itself. Read through the context rather than
  // useBottomTabBarHeight() because that hook throws on the screens outside
  // the tab navigator — auth, onboarding, the crash flow — which render this
  // same component and legitimately have no tab bar. The height already
  // includes the bottom safe-area inset, so the "bottom" edge is dropped
  // below to avoid insetting twice.
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;
  const safeEdges = tabBarHeight > 0 ? edges.filter((edge) => edge !== "bottom") : edges;
  const bottomInset = { paddingBottom: tabBarHeight + spacing.xxxl };

  return (
    <View style={[styles.flex, { backgroundColor }]}>
      <DotGridBackground />
      <SafeAreaView style={styles.flex} edges={safeEdges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[constrain && styles.centeredScrollContent, contentStyle, constrainStyle, bottomInset]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.nonScrollWrap, contentStyle, constrainStyle, bottomInset]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // ScrollView's contentContainerStyle sizes to its content, not the
  // viewport, so alignSelf: 'center' has no width to center within unless
  // the container itself is told to fill the screen first.
  centeredScrollContent: { width: "100%" },
  nonScrollWrap: { width: "100%" },
});
