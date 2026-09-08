// Central status store for every permission the first-launch gate
// (PermissionsGateScreen) walks through — notifications, precise
// foreground location, and Android BLE runtime permissions. Background
// location is tracked here too (see locationBackground below) but is no
// longer requested by the gate itself. Same module-level pub/sub shape as
// locationTracking.ts's permission
// status, deliberately: PermissionBanner and the gate screen both need to
// react to a status that can change from outside React (a rider flipping a
// toggle in system Settings while the app is backgrounded), and
// useSyncExternalStore is the correct way to bridge that.

import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { PermissionsAndroid, Platform } from "react-native";
import { refreshLocationPermissionStatus } from "../location/locationTracking";

// Written once every required permission has been asked about (granted or
// denied — this only gates whether the sequential intro screens show
// again, not whether access is actually present). Read again after denial
// is not enough on its own, hence PermissionBanner staying mounted app-wide.
const GATE_COMPLETE_KEY = "angelPermissionsGateComplete";

export interface PermissionSnapshot {
  notifications: boolean;
  locationForeground: boolean;
  locationForegroundPrecise: boolean;
  /** Status only — Angel no longer requests this permission anywhere; reflects whatever the OS reports (granted only if set manually via Settings). */
  locationBackground: boolean;
  /** Always true on iOS — BLE permission there is granted implicitly at first scan, no explicit runtime request exists. */
  bluetooth: boolean;
}

const UNKNOWN_SNAPSHOT: PermissionSnapshot = {
  notifications: false,
  locationForeground: false,
  locationForegroundPrecise: false,
  locationBackground: Platform.OS !== "android",
  bluetooth: Platform.OS !== "android",
};

let snapshot: PermissionSnapshot = UNKNOWN_SNAPSHOT;
const listeners = new Set<(snapshot: PermissionSnapshot) => void>();

export function getPermissionSnapshot(): PermissionSnapshot {
  return snapshot;
}

export function subscribePermissionSnapshot(listener: (snapshot: PermissionSnapshot) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setSnapshot(next: PermissionSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(next));
}

/** Everything the app treats as non-negotiable — matches AGENTS.md's "always on" requirement for notifications + location. */
export function requiredPermissionsGranted(s: PermissionSnapshot): boolean {
  return s.notifications && s.locationForeground;
}

export async function isPermissionsGateComplete(): Promise<boolean> {
  return (await SecureStore.getItemAsync(GATE_COMPLETE_KEY)) === "true";
}

export async function setPermissionsGateComplete(): Promise<void> {
  await SecureStore.setItemAsync(GATE_COMPLETE_KEY, "true");
}

/** Re-reads every permission from the OS without prompting — call on mount and every app-foreground resume. */
export async function refreshPermissionSnapshot(): Promise<PermissionSnapshot> {
  const notifStatus = await Notifications.getPermissionsAsync().catch(() => null);
  const notifications = Boolean(notifStatus?.granted) || notifStatus?.status === "granted";

  const locStatus = await refreshLocationPermissionStatus();
  const locationForeground = locStatus === "granted";
  let locationForegroundPrecise = false;
  if (locationForeground) {
    const fg = await Location.getForegroundPermissionsAsync().catch(() => null);
    locationForegroundPrecise = fg ? !(fg.android?.accuracy === "coarse" || fg.ios?.accuracy === "reduced") : false;
  }

  let locationBackground = Platform.OS !== "android";
  if (Platform.OS === "android") {
    const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
    locationBackground = bg?.status === "granted";
  }

  let bluetooth = Platform.OS !== "android";
  if (Platform.OS === "android") {
    const [scan, connect] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT),
    ]);
    bluetooth = scan && connect;
  }

  const next: PermissionSnapshot = { notifications, locationForeground, locationForegroundPrecise, locationBackground, bluetooth };
  setSnapshot(next);
  return next;
}

export async function requestNotificationsPermission(): Promise<boolean> {
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true, allowCriticalAlerts: true },
  });
  const granted = result.granted || result.status === "granted";
  await refreshPermissionSnapshot();
  return granted;
}

export async function requestLocationForegroundPermission(): Promise<{ granted: boolean; precise: boolean }> {
  const result = await Location.requestForegroundPermissionsAsync();
  const granted = result.status === "granted";
  const precise = granted ? !(result.android?.accuracy === "coarse" || result.ios?.accuracy === "reduced") : false;
  await refreshPermissionSnapshot();
  return { granted, precise };
}

/** Android only — iOS grants BLE implicitly at first scan, no separate runtime prompt exists. */
export async function requestBluetoothPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  const granted =
    result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
    result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
  await refreshPermissionSnapshot();
  return granted;
}
