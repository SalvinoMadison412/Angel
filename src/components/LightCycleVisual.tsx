import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

// Intrinsic size of assets/images/lightcycle.png — a front-facing,
// transparent-background render (checked directly against the PNG's alpha
// channel — the background is already alpha:0, not baked-in white, so no
// matting step is needed here). Used only for the aspect ratio the image
// box is locked to, so it scales cleanly to whatever width the card ends
// up rendering at.
const IMAGE_WIDTH = 1379;
const IMAGE_HEIGHT = 752;
const ASPECT_RATIO = IMAGE_WIDTH / IMAGE_HEIGHT;

// Firmware's tilt is degrees of deviation from upright (see
// CrashDetector.ino's acos-based calc) — this is the input range that maps
// to the ±10° visual lean cap.
const MAX_TILT_DEG = 45;
const MAX_LEAN_DEG = 10;

interface Props {
  /** Raw `telemetry.tilt` in degrees. 0 (and no rotation) when disconnected. */
  tilt: number;
  isLinked: boolean;
}

/**
 * The Light Cycle card's visual — a static transparent-PNG rider/bike render
 * that leans in real time with the sensor's tilt reading and dims when the
 * sensor isn't connected. No SVG overlay layers (grid/glow/rim/scanline) —
 * removed per the redesign; this is intentionally just the image + a lean
 * transform + a fade now.
 */
export function LightCycleVisual({ tilt, isLinked }: Props) {
  const targetLean = isLinked ? Math.max(-MAX_LEAN_DEG, Math.min(MAX_LEAN_DEG, (tilt / MAX_TILT_DEG) * MAX_LEAN_DEG)) : 0;

  const leanAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(isLinked ? 1 : 0.6)).current;

  useEffect(() => {
    Animated.timing(leanAnim, {
      toValue: targetLean,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [targetLean, leanAnim]);

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: isLinked ? 1 : 0.6,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isLinked, opacityAnim]);

  const leanRotate = leanAnim.interpolate({ inputRange: [-MAX_LEAN_DEG, MAX_LEAN_DEG], outputRange: [`-${MAX_LEAN_DEG}deg`, `${MAX_LEAN_DEG}deg`] });

  return (
    <View style={styles.root}>
      <Animated.Image
        source={require("../../assets/images/lightcycle.png")}
        resizeMode="contain"
        style={[
          styles.image,
          {
            opacity: opacityAnim,
            transform: [{ rotate: leanRotate }],
            transformOrigin: "50% 100%",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // No backgroundColor here on purpose — this box must stay fully
  // transparent so the image blends into whatever the parent card behind
  // it is doing (see HomeScreen's telemetryCard, which owns the #050508
  // background). Giving this its own background created a visible seam
  // against GlassCard's default translucent fill.
  root: { width: "100%", aspectRatio: ASPECT_RATIO },
  image: { width: "100%", height: "100%" },
});
