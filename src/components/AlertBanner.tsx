import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InAppAlert, subscribeInAppAlerts } from "../services/notifications/inAppAlertBus";
import { colors, spacing, type } from "../theme";

const AUTO_DISMISS_MS = 5000;
const ANIM_MS = 220;

/**
 * Foreground substitute for the system crash/speed notifications — mounted
 * once near the root (see RootNavigator) so it can show over any screen.
 * Module-level pub/sub (inAppAlertBus) rather than props/context: the
 * publishers (emergencyPipeline, speedMonitor) aren't components and
 * shouldn't need one threaded down to them just to raise a banner.
 */
export function InAppAlertHost() {
  const insets = useSafeAreaInsets();
  const [alert, setAlert] = useState<InAppAlert | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: ANIM_MS, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
    ]).start(() => setAlert(null));
  };

  useEffect(() => {
    const unsubscribe = subscribeInAppAlerts((next) => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setAlert(next);
      translateY.setValue(-120);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      ]).start();
      dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    });
    return () => {
      unsubscribe();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!alert) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + spacing.sm, opacity, transform: [{ translateY }] }]}
    >
      <Animated.View style={styles.card}>
        <Image source={require("../../assets/icon.png")} style={styles.icon} />
        <Animated.View style={styles.textWrap}>
          <Text style={[type.kicker, styles.title]}>{alert.title}</Text>
          <Text style={[type.bodySmall, styles.body]}>{alert.body}</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    zIndex: 999,
    elevation: 999,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#050508",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,69,0,0.5)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  icon: { width: 36, height: 36, borderRadius: 8 },
  textWrap: { flex: 1, gap: 2 },
  title: { color: "#FF4500" },
  body: { color: colors.text },
});
