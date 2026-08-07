import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { colors, radius } from "../theme";

interface Props {
  riderLat: number;
  riderLng: number;
  width?: number;
  height?: number;
}

/**
 * A stylized, not-to-scale single-pin view: grid "streets" + a centered pin
 * for the crash location. This is the always-available default (works in
 * Expo Go, needs no API key) — the design itself calls this out as the
 * fallback ("SCHEMATIC PREVIEW · ADD GOOGLE MAPS KEY IN TWEAKS"). Coordinates
 * aren't used for layout (there's nothing to plot a route between anymore —
 * see RouteMap.tsx) but are kept in the props for API parity with
 * NativeRouteMap.
 */
export function SchematicRouteMap({ width = 360, height = 280 }: Props) {
  const cx = width / 2;
  const cy = height / 2;

  const gridLinesV = [0.12, 0.32, 0.55, 0.78, 0.95];
  const gridLinesH = [0.1, 0.38, 0.62, 0.88];

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {gridLinesV.map((f, i) => (
          <Line key={`v${i}`} x1={width * f} y1={0} x2={width * f} y2={height} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        ))}
        {gridLinesH.map((f, i) => (
          <Line
            key={`h${i}`}
            x1={0}
            y1={height * f}
            x2={width}
            y2={height * f}
            stroke={i === 1 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}
            strokeWidth={i === 1 ? 2 : 1}
          />
        ))}
      </Svg>

      <View style={[styles.riderPin, { left: cx - 18, top: cy - 18 }]}>
        <View style={styles.riderRing}>
          <View style={styles.riderDot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0D0D0D",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  riderPin: {
    position: "absolute",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  riderRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: "rgba(10,10,10,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  riderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text,
  },
});
