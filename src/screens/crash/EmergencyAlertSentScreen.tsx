import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PartnerSearchMap } from "../../components";
import { useLocation } from "../../hooks";
import { colors, fontFamily, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

/**
 * Where the crash countdown lands once guardians have actually been alerted
 * (EmergencyCountdownScreen.sendAlert on expiry). Two parts, in the order
 * they matter to the rider: confirmation that the alert went out, then the
 * search for a nearby partner rider — see PartnerSearchMap for the seam
 * where the Angel Partners side will eventually plug in.
 */
export function EmergencyAlertSentScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "EmergencyAlertSent">>();
  const { guardianNames } = route.params;
  const insets = useSafeAreaInsets();
  // Falls back to Bengaluru when location was never granted, so the map
  // always has something to centre on rather than rendering empty.
  const { coords } = useLocation();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.confirmation}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.title}>
            {guardianNames.length} guardian{guardianNames.length === 1 ? "" : "s"} notified
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

        <View style={styles.divider} />

        <PartnerSearchMap riderLat={coords.lat} riderLng={coords.lng} />
      </ScrollView>

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
  },
  scrollContent: { paddingBottom: spacing.xl, gap: spacing.xl },
  confirmation: { alignItems: "center", marginTop: spacing.lg },
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
  namesWrap: { marginTop: spacing.md, alignItems: "center", gap: spacing.sm },
  name: { color: colors.textMuted, ...type.body },
  divider: { height: 1, backgroundColor: colors.divider },
  homeButton: {
    backgroundColor: colors.text,
    borderRadius: 28,
    paddingVertical: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  homeButtonPressed: { opacity: 0.85 },
  homeButtonText: {
    color: colors.bg,
    fontFamily: type.button.fontFamily,
    fontSize: 16,
    letterSpacing: 2,
  },
});
