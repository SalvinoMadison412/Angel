// Module-level (not React state) on purpose — emergencyPipeline.ts and
// CrashAlertScreen need to read the latest known coordinates synchronously
// at crash time, without waiting on a component tree or a fresh GPS fix.
// React-facing consumers (the permission-status banner, the foreground-resume
// monitor) go through useLocationPermission.ts, which wraps the pub/sub
// below in useSyncExternalStore.

import * as Location from "expo-location";

export type LocationPermissionStatus = "granted" | "denied" | "undetermined";

let latestCoords: { lat: number; lng: number } | null = null;
let watchSubscription: Location.LocationSubscription | null = null;
let currentStatus: LocationPermissionStatus = "undetermined";
const statusListeners = new Set<(status: LocationPermissionStatus) => void>();

// Live speed reading, derived from the same GPS watch as latestCoords —
// there's no BLE-side speed field (firmware only reports impact/gyro/tilt,
// see bluetooth/types.ts), so this is the one real speed source available
// in the app today. km/h, null until a fix with a speed value arrives.
let latestSpeedKmh: number | null = null;
const speedListeners = new Set<(speedKmh: number | null) => void>();

/** Best-effort cached fix from the live watch below — instant, no GPS wait. Null until the first fix arrives (or if permission was never granted). */
export function getLastKnownCoords(): { lat: number; lng: number } | null {
  return latestCoords;
}

/** Live GPS speed in km/h from the same watch as getLastKnownCoords — null until a fix reports one. */
export function getLastKnownSpeedKmh(): number | null {
  return latestSpeedKmh;
}

export function subscribeSpeedKmh(listener: (speedKmh: number | null) => void): () => void {
  speedListeners.add(listener);
  return () => speedListeners.delete(listener);
}

function setSpeedKmh(speedKmh: number | null) {
  latestSpeedKmh = speedKmh;
  speedListeners.forEach((listener) => listener(speedKmh));
}

export function getLocationPermissionStatus(): LocationPermissionStatus {
  return currentStatus;
}

export function subscribeLocationPermissionStatus(listener: (status: LocationPermissionStatus) => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function setStatus(status: LocationPermissionStatus) {
  if (status === currentStatus) return;
  currentStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

/** Idempotent — safe to call repeatedly (e.g. every app foreground) without stacking subscriptions. */
export async function startWatchingLocation(): Promise<void> {
  if (watchSubscription) return;
  try {
    watchSubscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 },
      (position) => {
        latestCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        const speedMs = position.coords.speed;
        setSpeedKmh(speedMs != null && speedMs >= 0 ? speedMs * 3.6 : null);
      }
    );
  } catch (err) {
    console.warn("[location] failed to start watching position", err);
  }
}

export function stopWatchingLocation(): void {
  watchSubscription?.remove();
  watchSubscription = null;
  setSpeedKmh(null);
}

/**
 * Re-checks the OS-level foreground permission and updates status/watching
 * to match — call on mount and every app-foreground resume, since a rider
 * can revoke the permission from system Settings without the app ever
 * being told directly. Starts the live watch on a fresh grant; stops it
 * (and drops the cache) if permission is no longer there.
 */
export async function refreshLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  let mapped: LocationPermissionStatus = "undetermined";
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    mapped = status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
  } catch (err) {
    console.warn("[location] failed to read permission status", err);
  }

  setStatus(mapped);
  if (mapped === "granted") {
    startWatchingLocation();
  } else {
    stopWatchingLocation();
    latestCoords = null;
  }
  return mapped;
}
