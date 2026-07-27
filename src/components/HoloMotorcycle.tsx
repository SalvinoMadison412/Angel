import React from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { colors } from "../theme";

interface Props {
  width?: number;
  height?: number;
  dim?: boolean;
  leanDeg?: number;
}

/**
 * The wireframe "light-cycle" motif — two wheel circles + an angular frame
 * path, with an accent dot marking the device/lean-angle position. `dim`
 * renders the low-opacity version used on auth screens; the default is the
 * bright telemetry version used on Home.
 */
export function HoloMotorcycle({ width = 280, height = 160, dim, leanDeg = 0 }: Props) {
  const stroke = dim ? "rgba(255,255,255,0.14)" : "rgba(234,252,255,0.85)";
  const dotColor = dim ? "rgba(255,87,34,0.35)" : colors.accent;

  return (
    <Svg width={width} height={height} viewBox="0 0 280 160">
      <G transform={`rotate(${leanDeg} 140 88)`}>
        <Circle cx={70} cy={112} r={38} stroke={stroke} strokeWidth={2} fill="none" />
        <Circle cx={196} cy={112} r={34} stroke={stroke} strokeWidth={2} fill="none" />
        <Path
          d="M38 92 L96 68 L158 60 L206 76 L222 96 L192 92 L152 78 L98 84 Z"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={150} cy={70} r={5} fill={dotColor} />
      </G>
    </Svg>
  );
}
