import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, fontFamily } from "../theme";

interface Props {
  size?: number;
  secondsLeft: number;
  totalSeconds: number;
}

export function RadialCountdown({ size = 220, secondsLeft, totalSeconds }: Props) {
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.glassBorder}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={styles.value}>{secondsLeft}</Text>
        <Text style={styles.label}>SECONDS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontFamily: fontFamily.headingBold,
    fontSize: 56,
    color: colors.text,
  },
  label: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textMuted,
    marginTop: 4,
  },
});
