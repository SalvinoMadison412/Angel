import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { colors } from "../theme";

const CELL = 24;
const DOT_RADIUS = 1;

interface Props {
  color?: string;
}

export function DotGridBackground({ color = colors.dotGrid }: Props) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="dotGrid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <Circle cx={CELL / 2} cy={CELL / 2} r={DOT_RADIUS} fill={color} />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill="url(#dotGrid)" />
      </Svg>
    </View>
  );
}
