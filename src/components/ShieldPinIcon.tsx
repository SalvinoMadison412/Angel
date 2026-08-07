import React from "react";
import Svg, { Path } from "react-native-svg";

interface Props {
  color: string;
  size?: number;
}

// Hand-drawn to match the app's existing icon set (TabBarIcon, GyroDial,
// HoloMotorcycle) rather than pulling in @expo/vector-icons for a single
// icon on a single screen — see TabBarIcon's own comment for the same
// reasoning applied to the tab bar.
export function ShieldPinIcon({ color, size = 64 }: Props) {
  const common = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path {...common} d="M32 6 12 13v16c0 15 8.6 23.6 20 29 11.4-5.4 20-14 20-29V13L32 6Z" />
      <Path
        {...common}
        d="M32 20c-4.4 0-8 3.5-8 7.8 0 5.9 8 15.2 8 15.2s8-9.3 8-15.2c0-4.3-3.6-7.8-8-7.8Z"
      />
      <Path {...common} strokeWidth={1.25} d="M32 24.5a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" />
    </Svg>
  );
}
