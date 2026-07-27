import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

// Bengaluru fallback so the app is usable in the simulator / without a
// location grant — matches the mock responders seeded around the same area.
const FALLBACK = { lat: 12.9716, lng: 77.5946 };

export function useLocation() {
  const [coords, setCoords] = useState(FALLBACK);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const requestAndFetch = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setPermissionGranted(false);
      return;
    }
    setPermissionGranted(true);
    try {
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      // keep fallback
    }
  }, []);

  useEffect(() => {
    requestAndFetch();
  }, [requestAndFetch]);

  return { coords, permissionGranted, refresh: requestAndFetch };
}
