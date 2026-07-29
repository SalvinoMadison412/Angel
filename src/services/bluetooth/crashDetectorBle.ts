import { PermissionsAndroid, Platform } from "react-native";
import { BleError, BleManager, Characteristic, Device, State as BleState } from "react-native-ble-plx";
import * as base64 from "base-64";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import {
  CALIBRATE_CHARACTERISTIC_UUID,
  ConnectionState,
  CRASH_CHARACTERISTIC_UUID,
  CRASH_SERVICE_UUID,
  CrashEvent,
  DeviceFault,
  DEVICE_LOCAL_NAME,
  PairedDevice,
  crashDetectorMessageSchema,
  crashEventFromMessage,
} from "./types";

const PAIRED_DEVICE_KEY = "crashDetectorPairedDevice";
const SCAN_TIMEOUT_MS = 15000;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const CALIBRATE_TIMEOUT_MS = 5000;
// Value is arbitrary — the device only cares that a write happened.
const CALIBRATE_TRIGGER_BYTE = "\x01";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export interface DiscoveredDevice {
  id: string;
  name: string;
}

export interface CrashDetectorBle {
  getConnectionState(): ConnectionState;
  getPairedDevice(): Promise<PairedDevice | null>;
  /** Reconnects to whatever device is persisted, if any. No-op if none. */
  reconnectToPairedDevice(): Promise<void>;
  /** Starts a scan filtered to the CrashDetector service UUID. Returns a stop function. */
  startScan(onDeviceFound: (device: DiscoveredDevice) => void): () => void;
  stopScan(): void;
  connect(deviceId: string, deviceName: string): Promise<void>;
  disconnect(): Promise<void>;
  forgetDevice(): Promise<void>;
  /**
   * Writes to the calibrate characteristic, telling the device to average
   * ~1s of accelerometer samples and store the result as its new "neutral
   * mount orientation" reference. Rejects (without leaving the connection
   * in a bad state) if the device isn't connected or doesn't respond in
   * time — callers should surface that as a retry-able failure, not a crash.
   */
  calibrate(): Promise<void>;
  subscribeConnectionState(listener: (state: ConnectionState, errorMessage?: string) => void): () => void;
  subscribeCrashEvents(listener: (event: CrashEvent) => void): () => void;
  /**
   * Fires with a `DeviceFault` when the device reports a health problem
   * (e.g. the IMU stopped responding), and with `null` when it reports that
   * fault has cleared. This is a device-health signal, never routed through
   * `subscribeCrashEvents` — a fault is not a crash.
   */
  subscribeFaultState(listener: (fault: DeviceFault | null) => void): () => void;
  /** Fires with the device's confirmed calibration state whenever it reports one — see calibration_complete. */
  subscribeCalibrationComplete(listener: (calibrated: boolean) => void): () => void;
  /** True if Android and BLE scanning is likely to return nothing because location services are off. */
  isAndroidLocationServicesDisabled(): Promise<boolean>;
}

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const apiLevel = Platform.Version as number;
  if (apiLevel >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function decodeCharacteristicValue(characteristic: Characteristic): unknown {
  if (!characteristic.value) return null;
  const json = base64.decode(characteristic.value);
  return JSON.parse(json);
}

/**
 * Real BLE implementation backed by react-native-ble-plx. Requires the
 * custom dev client / prebuilt native project — see the root README. This
 * will throw at construction time if run inside Expo Go, since the native
 * module doesn't exist there.
 */
export class CrashDetectorBleService implements CrashDetectorBle {
  private manager = new BleManager();
  private connectionState: ConnectionState = "disconnected";
  private connectedDevice: Device | null = null;
  private stateListeners = new Set<(state: ConnectionState, errorMessage?: string) => void>();
  private eventListeners = new Set<(event: CrashEvent) => void>();
  private faultListeners = new Set<(fault: DeviceFault | null) => void>();
  private calibrationListeners = new Set<(calibrated: boolean) => void>();
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private forgotten = false;

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  async getPairedDevice(): Promise<PairedDevice | null> {
    const raw = await SecureStore.getItemAsync(PAIRED_DEVICE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PairedDevice;
    } catch {
      return null;
    }
  }

  async reconnectToPairedDevice(): Promise<void> {
    const paired = await this.getPairedDevice();
    if (!paired) return;
    this.forgotten = false;
    await this.connect(paired.id, paired.name);
  }

  startScan(onDeviceFound: (device: DiscoveredDevice) => void): () => void {
    let stopped = false;

    (async () => {
      const hasPermission = await requestBlePermissions();
      if (!hasPermission) {
        this.setConnectionState("error", "Bluetooth/location permission was denied");
        return;
      }

      const btState = await this.manager.state();
      if (btState !== BleState.PoweredOn) {
        this.setConnectionState("error", "Bluetooth is turned off");
        return;
      }

      if (stopped) return;
      this.setConnectionState("scanning");
      const seen = new Set<string>();

      this.manager.startDeviceScan([CRASH_SERVICE_UUID], null, (error, device) => {
        if (error) {
          this.setConnectionState("error", error.message);
          return;
        }
        if (!device || device.localName !== DEVICE_LOCAL_NAME || seen.has(device.id)) return;
        seen.add(device.id);
        onDeviceFound({ id: device.id, name: device.localName ?? DEVICE_LOCAL_NAME });
      });

      this.scanTimer = setTimeout(() => {
        this.stopScan();
        if (this.connectionState === "scanning") this.setConnectionState("disconnected");
      }, SCAN_TIMEOUT_MS);
    })();

    return () => {
      stopped = true;
      this.stopScan();
    };
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  async connect(deviceId: string, deviceName: string): Promise<void> {
    this.stopScan();
    this.clearReconnectTimer();
    this.forgotten = false;
    this.setConnectionState("connecting");

    try {
      let device = await this.manager.connectToDevice(deviceId, { autoConnect: false });
      device = await device.discoverAllServicesAndCharacteristics();
      this.connectedDevice = device;
      this.reconnectAttempt = 0;

      device.monitorCharacteristicForService(CRASH_SERVICE_UUID, CRASH_CHARACTERISTIC_UUID, (error, characteristic) =>
        this.handleNotification(error, characteristic)
      );

      this.manager.onDeviceDisconnected(device.id, () => this.handleUnexpectedDisconnect(deviceId, deviceName));

      await SecureStore.setItemAsync(PAIRED_DEVICE_KEY, JSON.stringify({ id: deviceId, name: deviceName }));
      this.setConnectionState("connected");
    } catch (err) {
      this.connectedDevice = null;
      this.setConnectionState("error", err instanceof Error ? err.message : "Failed to connect");
      this.scheduleReconnect(deviceId, deviceName);
    }
  }

  async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.stopScan();
    const device = this.connectedDevice;
    this.connectedDevice = null;
    if (device) {
      try {
        await this.manager.cancelDeviceConnection(device.id);
      } catch {
        // already disconnected — nothing to clean up
      }
    }
    this.setConnectionState("disconnected");
  }

  async calibrate(): Promise<void> {
    const device = this.connectedDevice;
    if (!device) {
      throw new Error("Not connected to a device");
    }

    const valueBase64 = base64.encode(CALIBRATE_TRIGGER_BYTE);
    await withTimeout(
      device.writeCharacteristicWithResponseForService(CRASH_SERVICE_UUID, CALIBRATE_CHARACTERISTIC_UUID, valueBase64),
      CALIBRATE_TIMEOUT_MS,
      "Calibration timed out — check the device is still connected and try again"
    );
  }

  async forgetDevice(): Promise<void> {
    this.forgotten = true;
    await this.disconnect();
    await SecureStore.deleteItemAsync(PAIRED_DEVICE_KEY);
  }

  subscribeConnectionState(listener: (state: ConnectionState, errorMessage?: string) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  subscribeCrashEvents(listener: (event: CrashEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  subscribeFaultState(listener: (fault: DeviceFault | null) => void): () => void {
    this.faultListeners.add(listener);
    return () => this.faultListeners.delete(listener);
  }

  subscribeCalibrationComplete(listener: (calibrated: boolean) => void): () => void {
    this.calibrationListeners.add(listener);
    return () => this.calibrationListeners.delete(listener);
  }

  async isAndroidLocationServicesDisabled(): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    const enabled = await Location.hasServicesEnabledAsync();
    return !enabled;
  }

  private handleNotification(error: BleError | null, characteristic: Characteristic | null) {
    if (error) {
      // A drop mid-notify surfaces here too — the disconnect listener
      // handles reconnect, this is just diagnostic.
      console.warn("[ble] characteristic notification error", error.message);
      return;
    }
    if (!characteristic) return;

    let parsed: unknown;
    try {
      parsed = decodeCharacteristicValue(characteristic);
    } catch (err) {
      console.warn("[ble] malformed BLE payload (bad base64/JSON), dropping", err);
      return;
    }

    const result = crashDetectorMessageSchema.safeParse(parsed);
    if (!result.success) {
      console.warn("[ble] malformed BLE payload (schema mismatch), dropping", result.error.message);
      return;
    }

    // Branch on `type` before anything else touches the message — a fault
    // and a crash share no fields and must never be handled by the same
    // downstream path (a fault is a device-health problem, not an emergency).
    const message = result.data;
    switch (message.type) {
      case "crash": {
        const event = crashEventFromMessage(message);
        this.eventListeners.forEach((listener) => listener(event));
        return;
      }
      case "fault": {
        const fault: DeviceFault = { reason: message.reason, receivedAt: Date.now() };
        this.faultListeners.forEach((listener) => listener(fault));
        return;
      }
      case "fault_cleared": {
        this.faultListeners.forEach((listener) => listener(null));
        return;
      }
      case "calibration_complete": {
        this.calibrationListeners.forEach((listener) => listener(message.calibrated));
        return;
      }
    }
  }

  private handleUnexpectedDisconnect(deviceId: string, deviceName: string) {
    if (this.connectedDevice?.id !== deviceId) return; // already superseded by a newer connection
    this.connectedDevice = null;
    if (this.forgotten) return; // deliberate forgetDevice() — don't reconnect

    this.setConnectionState("connecting", "Connection dropped — reconnecting");
    this.scheduleReconnect(deviceId, deviceName);
  }

  private scheduleReconnect(deviceId: string, deviceName: string) {
    if (this.forgotten) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.connect(deviceId, deviceName);
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
  }

  private setConnectionState(state: ConnectionState, errorMessage?: string) {
    this.connectionState = state;
    this.stateListeners.forEach((listener) => listener(state, errorMessage));
  }
}
