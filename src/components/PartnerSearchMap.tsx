import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { colors, radius, spacing, type } from "../theme";
import { RouteMap } from "./RouteMap";

// Rider location with an outward radar sweep over it, for the stretch after
// guardians are alerted while Angel looks for the nearest partner rider.
//
// ponytail: the search is presentational — there is no matching backend yet,
// so this pulses indefinitely and never resolves. Upgrade path: the
// crash_tickets row already carries status/accepted_by/accepted_at, so
// subscribing to its UPDATEs (see the commented v2 block in
// ActiveTicketScreen) is what flips this to a found/accepted state. Keep the
// rings; swap the copy and stop the loop when a partner accepts.

const RING_COUNT = 3;
const RING_MAX = 220;
const SWEEP_MS = 2400;
const MAP_HEIGHT = 280;

function Ring({ delay }: { delay: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SWEEP_MS,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) }],
        },
      ]}
    />
  );
}

export function PartnerSearchMap({ riderLat, riderLng }: { riderLat: number; riderLng: number }) {
  const { width } = useWindowDimensions();
  // The map is laid out inside the screen's xl gutters; give it an explicit
  // width so the schematic fallback can't overflow on a narrow device.
  const mapWidth = Math.max(0, width - spacing.xl * 2);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapClip, { width: mapWidth, height: MAP_HEIGHT }]}>
        <RouteMap riderLat={riderLat} riderLng={riderLng} width={mapWidth} height={MAP_HEIGHT} />
        <View pointerEvents="none" style={styles.radarOverlay}>
          {Array.from({ length: RING_COUNT }, (_, i) => (
            <Ring key={i} delay={(i * SWEEP_MS) / RING_COUNT} />
          ))}
          <View style={styles.originDot} />
        </View>
      </View>

      <View style={styles.statusRow}>
        <Animated.View style={[styles.statusDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }]} />
        <Text style={[type.kicker, styles.statusText]}>SEARCHING FOR NEAREST RIDER</Text>
      </View>
      <Text style={[type.bodySmall, styles.statusCopy]}>
        Angel is looking for a partner rider near you. Your guardians have already been alerted — this is extra help
        on the way, not instead of it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  mapClip: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  radarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: RING_MAX,
    height: RING_MAX,
    borderRadius: RING_MAX / 2,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  originDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  statusRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, flexShrink: 0 },
  statusText: { color: colors.accent, flexShrink: 1 },
  statusCopy: { color: colors.textMuted },
});
