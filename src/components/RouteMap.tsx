import React from "react";
import Constants from "expo-constants";
import { SchematicRouteMap } from "./SchematicRouteMap";

interface Props {
  riderLat: number;
  riderLng: number;
  responderLat: number;
  responderLng: number;
  width?: number;
  height?: number;
}

const hasMapsKey = Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY);
// react-native-maps needs native code; it isn't present in the plain Expo Go
// sandbox (only in a dev-client/standalone build). Guard on both signals so
// the default path never touches the native module.
const isNativeCapable = Constants.appOwnership !== "expo";

let NativeRouteMap: React.ComponentType<Props> | null = null;
if (hasMapsKey && isNativeCapable) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    NativeRouteMap = require("./NativeRouteMap").NativeRouteMap;
  } catch {
    NativeRouteMap = null;
  }
}

export function RouteMap(props: Props) {
  if (NativeRouteMap) {
    return <NativeRouteMap {...props} />;
  }
  return <SchematicRouteMap {...props} />;
}
