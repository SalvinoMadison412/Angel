import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Same 0–512 mark used by the app icon (see assets/ + the icon concept
// review) — the splash is the icon learning to draw itself, not a
// different piece of art.
const RING_R = 150;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;
const TRACE_D = "M 60 256 L 180 256 L 215 150 L 250 365 L 285 256 L 452 256";
// Precomputed polyline length (five straight segments) — cheaper and more
// predictable than measuring the path on a ref after layout.
const TRACE_LENGTH = 120 + 111.63 + 217.83 + 114.48 + 167;

const RING_DRAW_MS = 650;
const TRACE_DRAW_MS = 650;
const TRACE_DELAY_MS = 250;
const PULSE_MS = 220;

interface Props {
  /** Skip the draw-on animation and show the finished mark — for Reduce Motion. */
  reduceMotion: boolean;
}

export function AnimatedSplash({ reduceMotion }: Props) {
  const ringProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const traceProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return; // static final frame only, no motion

    Animated.sequence([
      Animated.parallel([
        Animated.timing(ringProgress, {
          toValue: 1,
          duration: RING_DRAW_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // strokeDashoffset isn't supported by the native driver
        }),
        Animated.timing(traceProgress, {
          toValue: 1,
          duration: TRACE_DRAW_MS,
          delay: TRACE_DELAY_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: PULSE_MS / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS / 2,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    // Intentionally run once — this is a one-shot entrance animation, not
    // something that reacts to further prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringDashoffset = ringProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });
  const traceDashoffset = traceProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACE_LENGTH, 0],
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Svg width={220} height={220} viewBox="0 0 512 512">
          <AnimatedCircle
            cx={256}
            cy={256}
            r={RING_R}
            stroke={colors.text}
            strokeWidth={14}
            strokeOpacity={0.92}
            fill="none"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ringDashoffset}
          />
          <AnimatedPath
            d={TRACE_D}
            stroke={colors.accent}
            strokeWidth={15}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={TRACE_LENGTH}
            strokeDashoffset={traceDashoffset}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
