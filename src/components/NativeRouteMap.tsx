import React from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { StyleSheet } from "react-native";
import { colors, radius } from "../theme";

interface Props {
  riderLat: number;
  riderLng: number;
  width?: number;
  height?: number;
}

/**
 * Real map renderer — only mounted when EXPO_PUBLIC_GOOGLE_MAPS_KEY is set
 * and the app is running as a dev-client/standalone build (react-native-maps
 * needs native code react-native-maps isn't available in plain Expo Go).
 * Single pin at the given location — see RouteMap.tsx.
 */
export function NativeRouteMap({ riderLat, riderLng, width, height }: Props) {
  return (
    <MapView
      style={[styles.map, width && height ? { width, height } : undefined]}
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        latitude: riderLat,
        longitude: riderLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      <Marker coordinate={{ latitude: riderLat, longitude: riderLng }} title="Crash location" pinColor={colors.accent} />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: 280,
    borderRadius: radius.lg,
  },
});
