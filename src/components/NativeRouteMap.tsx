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

// Google's default basemap is near-white, which lands as a glaring slab in
// the middle of this app — and every screen showing a map is one a rider
// reaches at night or straight after a crash. Just enough style rules to
// darken the base, mute the labels, and drop POI clutter; the schematic
// fallback (SchematicRouteMap) is already dark, so the two now match.
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#141414" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A8A8A" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0A0A" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2A2A2A" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6B6B6B" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0D0D0D" }] },
];

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
      customMapStyle={DARK_MAP_STYLE}
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
