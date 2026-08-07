import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Live OS foreground-location permission status — independent of whether
 * LocationPermissionScreen has ever been shown (see
 * lib/locationPermissionStorage.ts for that separate "asked once" flag).
 * Re-checks on foreground so the Home screen's warning banner clears itself
 * right after a rider grants access from device Settings and returns to
 * the app, with no manual refresh needed.
 */
export function useLocationPermissionStatus() {
  // null = not checked yet — callers should treat this as "unknown", not
  // "denied", to avoid flashing the warning banner before the first check
  // resolves.
  const [granted, setGranted] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => setGranted(status === "granted"))
      .catch(() => setGranted(false));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { granted, refresh };
}
