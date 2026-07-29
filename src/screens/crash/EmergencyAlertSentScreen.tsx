import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontFamily, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

export function EmergencyAlertSentScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "EmergencyAlertSent">>();
  const { guardianNames } = route.params;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.center}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>
          Alert sent to {guardianNames.length} contact{guardianNames.length === 1 ? "" : "s"}
        </Text>
        {guardianNames.length > 0 && (
          <View style={styles.namesWrap}>
            {guardianNames.map((name) => (
              <Text key={name} style={styles.name}>
                {name}
              </Text>
            ))}
          </View>
        )}
      </View>

      <Pressable
        onPress={() => navigation.popToTop()}
        style={({ pressed }) => [styles.homeButton, pressed && styles.homeButtonPressed]}
        hitSlop={8}
      >
        <Text style={styles.homeButtonText}>RETURN HOME</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    justifyContent: "space-between",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  checkmark: {
    color: colors.success,
    fontSize: 56,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamily.headingBold,
    fontSize: 24,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  namesWrap: { marginTop: spacing.xl, alignItems: "center", gap: spacing.sm },
  name: { color: colors.textMuted, ...type.body },
  homeButton: {
    backgroundColor: colors.text,
    borderRadius: 28,
    paddingVertical: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButtonPressed: { opacity: 0.85 },
  homeButtonText: {
    color: colors.bg,
    fontFamily: type.button.fontFamily,
    fontSize: 16,
    letterSpacing: 2,
  },
});
