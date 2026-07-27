import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type TabBarIconName = "home" | "device" | "guardians" | "plan";

interface Props {
  name: TabBarIconName;
  color: string;
  size?: number;
}

// Simple line-art icons matching the app's hand-drawn SVG components
// (GyroDial, RadialCountdown, etc.) rather than pulling in an icon font
// just for four tab glyphs.
export function TabBarIcon({ name, color, size = 22 }: Props) {
  const common = {
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" && (
        <Path {...common} d="M4 11.5 12 4l8 7.5M6 10v9h12v-9M10 19v-5h4v5" />
      )}
      {name === "device" && (
        <>
          <Rect {...common} x={5} y={3} width={14} height={18} rx={3} />
          <Circle cx={12} cy={12} r={2.5} stroke={color} strokeWidth={1.75} fill="none" />
          <Path {...common} d="M9 6.5h.01M15 6.5h.01" />
        </>
      )}
      {name === "guardians" && (
        <Path
          {...common}
          d="M12 3.5 5 6v5.5c0 4.2 2.9 7.4 7 8.5 4.1-1.1 7-4.3 7-8.5V6l-7-2.5Z"
        />
      )}
      {name === "plan" && (
        <>
          <Rect {...common} x={3.5} y={5} width={17} height={14} rx={2.5} />
          <Path {...common} d="M3.5 10h17M7 14.5h4" />
        </>
      )}
    </Svg>
  );
}
