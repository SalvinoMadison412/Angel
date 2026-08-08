import { useSyncExternalStore } from "react";
import {
  LocationPermissionStatus,
  getLocationPermissionStatus,
  subscribeLocationPermissionStatus,
} from "../services/location/locationTracking";

/** Live location-permission status — updates whenever refreshLocationPermissionStatus() runs (app foreground, onboarding). */
export function useLocationPermission(): LocationPermissionStatus {
  return useSyncExternalStore(subscribeLocationPermissionStatus, getLocationPermissionStatus);
}
