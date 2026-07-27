import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { colors, radius } from "../theme";

interface Props {
  riderLat: number;
  riderLng: number;
  responderLat: number;
  responderLng: number;
  width?: number;
  height?: number;
}

/**
 * A stylized, not-to-scale route view: grid "streets" + a dashed path between
 * the rider and the assigned responder. This is the always-available default
 * (works in Expo Go, needs no API key) — the design itself calls this out as
 * the fallback ("SCHEMATIC PREVIEW · ADD GOOGLE MAPS KEY IN TWEAKS").
 */
export function SchematicRouteMap({
  riderLat,
  riderLng,
  responderLat,
  responderLng,
  width = 360,
  height = 280,
}: Props) {
  const { rider, responder, pathD } = useMemo(() => {
    const dLat = responderLat - riderLat;
    const dLng = responderLng - riderLng;
    const scale = 6000;
    const pad = 44;
    const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
    const dx = clamp(dLng * scale, width / 2 - pad);
    const dy = clamp(-dLat * scale, height / 2 - pad);

    const rider = { x: width / 2 - dx / 2, y: height / 2 - dy / 2 };
    const responder = { x: width / 2 + dx / 2, y: height / 2 + dy / 2 };
    const midY = rider.y + (responder.y - rider.y) * 0.4;
    const bendX = rider.x + (responder.x - rider.x) * 0.65;

    const pathD = `M ${rider.x} ${rider.y} L ${rider.x} ${midY} L ${bendX} ${midY} L ${bendX} ${responder.y} L ${responder.x} ${responder.y}`;

    return { rider, responder, pathD };
  }, [riderLat, riderLng, responderLat, responderLng, width, height]);

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
        <Path d={pathD} stroke={colors.accent} strokeWidth={2.5} strokeDasharray="7,7" fill="none" strokeLinecap="round" />
      </Svg>

      <View style={[styles.riderPin, { left: rider.x - 18, top: rider.y - 18 }]}>
        <View style={styles.riderRing}>
          <View style={styles.riderDot} />
        </View>
      </View>

      <View style={[styles.responderPin, { left: responder.x - 18, top: responder.y - 18 }]}>
        <View style={styles.responderBadge}>
          <Text style={styles.responderGlyph}>🏍</Text>
        </View>
        <Text style={styles.responderLabel}>RESPONDER</Text>
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
  responderPin: {
    position: "absolute",
    width: 80,
    alignItems: "center",
  },
  responderBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  responderGlyph: {
    fontSize: 16,
  },
  responderLabel: {
    marginTop: 4,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textMuted,
  },
});
