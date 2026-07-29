import { CalibrationConfirmation, ConnectionState, CrashEvent, DeviceFault, PairedDevice } from "./types";
import { CrashDetectorBle, DiscoveredDevice } from "./crashDetectorBle";

const MESSAGE =
  "Bluetooth isn't available — this build doesn't have the native BLE module linked. " +
  "This app needs a custom dev client (npx expo prebuild + expo run:android, or an EAS dev build); it can't run in Expo Go. See the root README.";

/**
 * Stand-in used when constructing the real BleManager throws — in
 * practice that means the native module isn't linked, almost always
 * because the app is running in Expo Go instead of a custom dev client.
 * Surfacing a clear "error" state here (instead of the crash the native
 * constructor would otherwise produce) keeps that misconfiguration from
 * reading as an app bug.
 */
export class UnavailableCrashDetectorBleService implements CrashDetectorBle {
  getConnectionState(): ConnectionState {
    return "error";
  }

  async getPairedDevice(): Promise<PairedDevice | null> {
    return null;
  }

  async reconnectToPairedDevice(): Promise<void> {}

  startScan(): () => void {
    return () => {};
  }

  stopScan(): void {}

  async connect(): Promise<void> {
    throw new Error(MESSAGE);
  }

  async disconnect(): Promise<void> {}

  async calibrate(): Promise<void> {
    throw new Error(MESSAGE);
  }

  async forgetDevice(): Promise<void> {}

  subscribeConnectionState(listener: (state: ConnectionState, errorMessage?: string) => void): () => void {
    listener("error", MESSAGE);
    return () => {};
  }

  subscribeCrashEvents(_listener: (event: CrashEvent) => void): () => void {
    return () => {};
  }

  subscribeFaultState(_listener: (fault: DeviceFault | null) => void): () => void {
    return () => {};
  }

  subscribeCalibrationComplete(_listener: (confirmation: CalibrationConfirmation) => void): () => void {
    return () => {};
  }

  async isAndroidLocationServicesDisabled(): Promise<boolean> {
    return false;
  }
}
