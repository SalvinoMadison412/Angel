import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { colors, radius } from "../theme";

interface Props {
  riderLat: number;
  riderLng: number;
  partnerLat?: number | null;
  partnerLng?: number | null;
  width?: number;
  height?: number;
}

/**
 * A stylized, not-to-scale view: grid "streets" + a centered pin for the
 * crash location, plus a direction-only pin for the responding partner when
 * one is passed. This is the always-available default (works in Expo Go,
 * needs no API key) — the design calls it out as the fallback ("SCHEMATIC
 * PREVIEW · ADD GOOGLE MAPS KEY IN TWEAKS"). The partner pin uses the
 * lat/lng bearing only, not distance — it's a schematic.
 */
export function SchematicRouteMap({ riderLat, riderLng, partnerLat, partnerLng, width = 360, height = 280 }: Props) {
  const cx = width / 2;
  const cy = height / 2;

  // Rider stays centred; the partner dot is placed by direction only (this
  // is a schematic, not to scale). Bearing from the raw lat/lng delta,
  // planted at a fixed radius so it always sits on-screen. north = up.
  const hasPartner = partnerLat != null && partnerLng != null;
  const dLat = hasPartner ? partnerLat! - riderLat : 0;
  const dLng = hasPartner ? partnerLng! - riderLng : 0;
  const partnerRadius = Math.min(width, height) * 0.32;
  const mag = Math.hypot(dLat, dLng) || 1;
  const partnerX = cx + (dLng / mag) * partnerRadius;
  const partnerY = cy - (dLat / mag) * partnerRadius;

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

      {hasPartner && (
        <>
          <Svg style={StyleSheet.absoluteFill} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <Line x1={cx} y1={cy} x2={partnerX} y2={partnerY} stroke={colors.success} strokeWidth={1.5} strokeDasharray="4 4" />
          </Svg>
          <View style={[styles.partnerPin, { left: partnerX - 7, top: partnerY - 7 }]}>
            <View style={styles.partnerDot} />
          </View>
        </>
      )}

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
  partnerPin: {
    position: "absolute",
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: "#0D0D0D",
  },
});
