import { CrashDetectorBle, CrashDetectorBleService, DiscoveredDevice } from "./crashDetectorBle";
import { MockCrashDetectorBleService } from "./mockCrashDetectorBle";
import { UnavailableCrashDetectorBleService } from "./unavailableCrashDetectorBle";

export * from "./types";
export type { CrashDetectorBle, DiscoveredDevice } from "./crashDetectorBle";
export { MockCrashDetectorBleService } from "./mockCrashDetectorBle";

let realInstance: CrashDetectorBle | null = null;
let mockInstance: MockCrashDetectorBleService | null = null;

/**
 * Lazily constructed singletons, one per mode. Importing this module never
 * touches the native BLE module by itself — `CrashDetectorBleService` (and
 * the `BleManager` it wraps) is only constructed the first time something
 * actually asks for the real service. If that construction throws (the
 * native module isn't linked — almost always because the app is running in
 * Expo Go instead of a custom dev client), we fall back to a stub that
 * reports a clear "error" state instead of crashing the app. See the root
 * README for the dev-client setup this depends on.
 */
export function getCrashDetectorBle(mock: boolean): CrashDetectorBle {
  if (mock) {
    if (!mockInstance) mockInstance = new MockCrashDetectorBleService();
    return mockInstance;
  }
  if (!realInstance) {
    try {
      realInstance = new CrashDetectorBleService();
    } catch (err) {
      console.warn("[ble] native BLE module unavailable — falling back to a stub. Is this running in Expo Go?", err);
      realInstance = new UnavailableCrashDetectorBleService();
    }
  }
  return realInstance;
}
