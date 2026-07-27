import React from "react";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { colors } from "../theme";

interface Props {
  size?: number;
  pitch: number;
  roll: number;
  yaw: number;
}

export function GyroDial({ size = 220, pitch, roll, yaw }: Props) {
  const c = size / 2;
  const rOuter = size * 0.42;
  const rInner = size * 0.3;

  const point = (deg: number, r: number) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: c + r * Math.cos(rad), y: c + r * Math.sin(rad) };
  };

  const z = point(yaw * 4, rInner);
  const y = point(120 + roll * 4, rInner);
  const x = point(240 + pitch * 4, rInner);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={rOuter} stroke={colors.glassBorder} strokeWidth={1.5} fill="none" />
      <Circle cx={c} cy={c} r={rInner} stroke="rgba(255,87,34,0.5)" strokeWidth={1.5} fill="none" />
      <Line x1={c} y1={c - rInner} x2={c} y2={c + rInner} stroke={colors.glassBorder} strokeWidth={1} />
      <Line x1={c - rInner} y1={c} x2={c + rInner} y2={c} stroke={colors.glassBorder} strokeWidth={1} />
      <Circle cx={c} cy={c} r={3} fill={colors.text} />

      <Circle cx={z.x} cy={z.y} r={5} fill={colors.text} />
      <SvgText x={z.x} y={z.y - 12} fill={colors.textMuted} fontSize={11} textAnchor="middle">Z</SvgText>

      <Circle cx={y.x} cy={y.y} r={5} fill={colors.textMuted} />
      <SvgText x={y.x + 14} y={y.y + 4} fill={colors.textMuted} fontSize={11} textAnchor="middle">Y</SvgText>

      <Circle cx={x.x} cy={x.y} r={5} fill={colors.accent} />
      <SvgText x={x.x - 14} y={x.y + 4} fill={colors.textMuted} fontSize={11} textAnchor="middle">X</SvgText>
    </Svg>
  );
}
