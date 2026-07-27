import React from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { StyleSheet } from "react-native";
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
 * Real map renderer — only mounted when EXPO_PUBLIC_GOOGLE_MAPS_KEY is set
 * and the app is running as a dev-client/standalone build (react-native-maps
 * needs native code react-native-maps isn't available in plain Expo Go).
 */
export function NativeRouteMap({ riderLat, riderLng, responderLat, responderLng, width, height }: Props) {
  const midLat = (riderLat + responderLat) / 2;
  const midLng = (riderLng + responderLng) / 2;

  return (
    <MapView
      style={[styles.map, width && height ? { width, height } : undefined]}
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(0.01, Math.abs(riderLat - responderLat) * 2.5),
        longitudeDelta: Math.max(0.01, Math.abs(riderLng - responderLng) * 2.5),
      }}
    >
      <Marker coordinate={{ latitude: riderLat, longitude: riderLng }} title="You" pinColor={colors.text} />
      <Marker coordinate={{ latitude: responderLat, longitude: responderLng }} title="Responder" pinColor={colors.accent} />
      <Polyline
        coordinates={[
          { latitude: riderLat, longitude: riderLng },
          { latitude: responderLat, longitude: responderLng },
        ]}
        strokeColor={colors.accent}
        strokeWidth={3}
      />
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
