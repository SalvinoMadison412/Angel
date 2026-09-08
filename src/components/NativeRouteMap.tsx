import React from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { StyleSheet } from "react-native";
import { colors, radius } from "../theme";

interface Props {
  riderLat: number;
  riderLng: number;
  /** The responding partner's last known position, once one has accepted the ticket. */
  partnerLat?: number | null;
  partnerLng?: number | null;
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
 * Crash-location pin, plus the responding partner's pin once one accepts —
 * see RouteMap.tsx.
 */
export function NativeRouteMap({ riderLat, riderLng, partnerLat, partnerLng, width, height }: Props) {
  const hasPartner = partnerLat != null && partnerLng != null;

  // With a partner on the map, frame both pins at mount; otherwise sit tight
  // on the rider. Uncontrolled (initialRegion) on purpose — the partner
  // Marker still moves as its position updates, but the viewport doesn't
  // yank itself around every poll or fight the rider panning. midpoint +
  // padded span is enough: same-city dispatch, so great-circle skew is nil.
  const initialRegion = hasPartner
    ? {
        latitude: (riderLat + partnerLat!) / 2,
        longitude: (riderLng + partnerLng!) / 2,
        latitudeDelta: Math.max(Math.abs(riderLat - partnerLat!) * 2.5, 0.01),
        longitudeDelta: Math.max(Math.abs(riderLng - partnerLng!) * 2.5, 0.01),
      }
    : { latitude: riderLat, longitude: riderLng, latitudeDelta: 0.01, longitudeDelta: 0.01 };

  return (
    <MapView
      style={[styles.map, width && height ? { width, height } : undefined]}
      provider={PROVIDER_GOOGLE}
      customMapStyle={DARK_MAP_STYLE}
      initialRegion={initialRegion}
    >
      <Marker coordinate={{ latitude: riderLat, longitude: riderLng }} title="Crash location" pinColor={colors.accent} />
      {hasPartner && (
        <Marker
          coordinate={{ latitude: partnerLat!, longitude: partnerLng! }}
          title="Partner responding"
          pinColor={colors.success}
        />
      )}
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
