import { PermissionsAndroid, Platform } from "react-native";
import { BleError, BleManager, Characteristic, Device, Subscription, State as BleState } from "react-native-ble-plx";
import * as base64 from "base-64";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import {
  CALIBRATE_CHARACTERISTIC_UUID,
  CalibrationConfirmation,
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
  subscribeCalibrationComplete(listener: (confirmation: CalibrationConfirmation) => void): () => void;
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

// TEMP DIAGNOSTIC LOGGING — added to get a real, timestamped sequence of
// every GATT call against the device during a physical-device reproduction
// of the Recalibrate connect/disconnect loop. Remove once the root cause is
// confirmed from real log output (see the prompt that added this).
function bleOpLog(...args: unknown[]) {
  console.log(`[BLE-OP][${new Date().toISOString()}]`, ...args);
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
  // Torn down and re-created on every successful connect() — without this,
  // a redundant connect() call (e.g. a newly-mounted screen's mount effect
  // calling reconnectToPairedDevice() while already connected) stacks a
  // second live disconnect listener on top of the first, so one real drop
  // fires two independent reconnect schedules instead of one.
  private notifySubscription: Subscription | null = null;
  private disconnectSubscription: Subscription | null = null;
  private stateListeners = new Set<(state: ConnectionState, errorMessage?: string) => void>();
  private eventListeners = new Set<(event: CrashEvent) => void>();
  private faultListeners = new Set<(fault: DeviceFault | null) => void>();
  private calibrationListeners = new Set<(confirmation: CalibrationConfirmation) => void>();
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private forgotten = false;
  // Every GATT call against this device — connect, disconnect, any
  // characteristic write — is chained onto this so exactly one is ever in
  // flight at a time. Android's BLE stack does not reliably handle
  // overlapping GATT operations (issuing a second one before a prior one
  // resolves is a well-known cause of spontaneous disconnects, surfacing
  // as GATT error 133); a background reconnect firing while a foreground
  // calibrate() write is in flight is exactly that scenario. Always
  // settles to resolved regardless of the wrapped operation's outcome, so
  // one failed/rejected operation never permanently wedges the queue.
  private operationTail: Promise<void> = Promise.resolve();
  // Lets a redundant connect() call for a device we're already busy
  // connecting to await the same in-flight attempt instead of queuing a
  // second, fully-redundant one behind it.
  private pendingConnect: { deviceId: string; promise: Promise<void> } | null = null;

  private enqueue<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const queuedAt = Date.now();
    bleOpLog(`ENQUEUE ${label}`);
    const result = this.operationTail.then(() => {
      bleOpLog(`START ${label} (waited ${Date.now() - queuedAt}ms in queue)`);
      return operation();
    });
    result.then(
      () => bleOpLog(`DONE ${label}`),
      (err) => bleOpLog(`FAILED ${label}:`, err instanceof Error ? err.message : err)
    );
    this.operationTail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

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

  /**
   * Every screen that mounts the real useCrashDetector() hook calls this
   * unconditionally on mount (so a fresh app launch reconnects on its own).
   * That means it fires again on top of an already-live connection every
   * time e.g. CalibrateSensorScreen is navigated to — connect() below must
   * treat that as a no-op rather than re-issuing connectToDevice() on an
   * already-connected peripheral, which is what was producing a genuine
   * connect/disconnect storm (see notifySubscription/disconnectSubscription).
   */
  private isAlreadyConnectedTo(deviceId: string): boolean {
    return this.connectionState === "connected" && this.connectedDevice?.id === deviceId;
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
    bleOpLog(`connect() called for ${deviceId} — current state=${this.connectionState}, connectedDevice=${this.connectedDevice?.id ?? "null"}`);

    // Idempotency guard — a redundant call while already connected to this
    // exact device (see isAlreadyConnectedTo) must be a true no-op. Without
    // this, re-issuing connectToDevice() on an already-connected peripheral
    // forces a real "connecting" transition and, on Android, can make the
    // native BLE stack tear down and re-negotiate the GATT link — a genuine
    // disconnect, not just a UI-level one.
    if (this.isAlreadyConnectedTo(deviceId)) {
      bleOpLog(`connect() SKIPPED — already connected to ${deviceId}`);
      return;
    }

    // A connect for this same device is already queued or running (e.g. a
    // background reconnect fired right as a screen's mount effect also
    // asked to connect) — join that attempt instead of queuing a second,
    // redundant one behind it.
    if (this.pendingConnect?.deviceId === deviceId) {
      bleOpLog(`connect() JOINING existing pending connect for ${deviceId}`);
      return this.pendingConnect.promise;
    }

    const promise = this.enqueue(`connect(${deviceId})`, () => this.performConnect(deviceId, deviceName));
    this.pendingConnect = { deviceId, promise };
    try {
      await promise;
    } finally {
      if (this.pendingConnect?.promise === promise) this.pendingConnect = null;
    }
  }

  private async performConnect(deviceId: string, deviceName: string): Promise<void> {
    // Re-check here, inside the queue: by the time this operation reaches
    // the front, an earlier queued op (e.g. another connect attempt that
    // was already running) may have connected us already.
    if (this.isAlreadyConnectedTo(deviceId)) {
      bleOpLog(`performConnect() SKIPPED — already connected to ${deviceId} by the time this ran`);
      return;
    }

    this.stopScan();
    this.clearReconnectTimer();
    this.forgotten = false;
    this.setConnectionState("connecting");

    try {
      bleOpLog(`GATT connectToDevice(${deviceId}) — issuing`);
      let device = await this.manager.connectToDevice(deviceId, { autoConnect: false });
      bleOpLog(`GATT connectToDevice(${deviceId}) — resolved`);

      bleOpLog(`GATT discoverAllServicesAndCharacteristics(${deviceId}) — issuing`);
      device = await device.discoverAllServicesAndCharacteristics();
      bleOpLog(`GATT discoverAllServicesAndCharacteristics(${deviceId}) — resolved`);

      this.connectedDevice = device;
      this.reconnectAttempt = 0;

      // Tear down any subscriptions from a previous connection before
      // registering fresh ones — otherwise a reconnect (redundant or real)
      // leaves the old listeners live, and one disconnect fires reconnect
      // logic twice, each duplicating listeners further.
      this.notifySubscription?.remove();
      this.disconnectSubscription?.remove();
      bleOpLog(`GATT monitorCharacteristicForService(${deviceId}) — subscribing`);

      this.notifySubscription = device.monitorCharacteristicForService(
        CRASH_SERVICE_UUID,
        CRASH_CHARACTERISTIC_UUID,
        (error, characteristic) => this.handleNotification(error, characteristic)
      );
      bleOpLog(`GATT monitorCharacteristicForService(${deviceId}) — subscribed`);

      this.disconnectSubscription = this.manager.onDeviceDisconnected(device.id, () =>
        this.handleUnexpectedDisconnect(deviceId, deviceName)
      );

      await SecureStore.setItemAsync(PAIRED_DEVICE_KEY, JSON.stringify({ id: deviceId, name: deviceName }));
      this.setConnectionState("connected");
      bleOpLog(`performConnect(${deviceId}) — SUCCESS, state=connected`);
    } catch (err) {
      bleOpLog(`performConnect(${deviceId}) — FAILED:`, err instanceof Error ? err.message : err);
      this.connectedDevice = null;
      this.setConnectionState("error", err instanceof Error ? err.message : "Failed to connect");
      this.scheduleReconnect(deviceId, deviceName);
    }
  }

  async disconnect(): Promise<void> {
    return this.enqueue("disconnect()", () => this.performDisconnect());
  }

  private async performDisconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.stopScan();
    this.notifySubscription?.remove();
    this.notifySubscription = null;
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;
    const device = this.connectedDevice;
    this.connectedDevice = null;
    if (device) {
      try {
        bleOpLog(`GATT cancelDeviceConnection(${device.id}) — issuing`);
        await this.manager.cancelDeviceConnection(device.id);
        bleOpLog(`GATT cancelDeviceConnection(${device.id}) — resolved`);
      } catch (err) {
        // already disconnected — nothing to clean up
        bleOpLog(`GATT cancelDeviceConnection(${device.id}) — rejected (likely already disconnected):`, err instanceof Error ? err.message : err);
      }
    }
    this.setConnectionState("disconnected");
  }

  async calibrate(): Promise<void> {
    return this.enqueue("calibrate()", () => this.performCalibrate());
  }

  private async performCalibrate(): Promise<void> {
    // Read fresh, at the moment this operation actually runs (not when it
    // was queued) — anything ahead of it in the queue (a connect, a
    // reconnect) may have changed which device, if any, we're connected to.
    const device = this.connectedDevice;
    bleOpLog(`performCalibrate() — device=${device?.id ?? "null"}, state=${this.connectionState}`);
    if (!device) {
      throw new Error("Not connected to a device");
    }

    const valueBase64 = base64.encode(CALIBRATE_TRIGGER_BYTE);
    bleOpLog(`GATT writeCharacteristicWithResponseForService(${device.id}, calibrate) — issuing`);
    try {
      await withTimeout(
        device.writeCharacteristicWithResponseForService(CRASH_SERVICE_UUID, CALIBRATE_CHARACTERISTIC_UUID, valueBase64),
        CALIBRATE_TIMEOUT_MS,
        "Calibration timed out — check the device is still connected and try again"
      );
      bleOpLog(`GATT writeCharacteristicWithResponseForService(${device.id}, calibrate) — resolved (write acked)`);
    } catch (err) {
      bleOpLog(`GATT writeCharacteristicWithResponseForService(${device.id}, calibrate) — REJECTED:`, err instanceof Error ? err.message : err);
      throw err;
    }
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

  subscribeCalibrationComplete(listener: (confirmation: CalibrationConfirmation) => void): () => void {
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
      bleOpLog(`NOTIFY error:`, error.message);
      console.warn("[ble] characteristic notification error", error.message);
      return;
    }
    if (!characteristic) return;

    let parsed: unknown;
    try {
      parsed = decodeCharacteristicValue(characteristic);
    } catch (err) {
      bleOpLog(`NOTIFY malformed (bad base64/JSON):`, err instanceof Error ? err.message : err);
      console.warn("[ble] malformed BLE payload (bad base64/JSON), dropping", err);
      return;
    }

    const result = crashDetectorMessageSchema.safeParse(parsed);
    if (!result.success) {
      bleOpLog(`NOTIFY malformed (schema mismatch):`, result.error.message, "raw:", JSON.stringify(parsed));
      console.warn("[ble] malformed BLE payload (schema mismatch), dropping", result.error.message);
      return;
    }

    // Branch on `type` before anything else touches the message — a fault
    // and a crash share no fields and must never be handled by the same
    // downstream path (a fault is a device-health problem, not an emergency).
    const message = result.data;
    bleOpLog(`NOTIFY received type=${message.type}`);
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
        const confirmation: CalibrationConfirmation = { calibrated: message.calibrated, receivedAt: Date.now() };
        this.calibrationListeners.forEach((listener) => listener(confirmation));
        return;
      }
    }
  }

  private handleUnexpectedDisconnect(deviceId: string, deviceName: string) {
    bleOpLog(`onDeviceDisconnected FIRED for ${deviceId} — connectedDevice=${this.connectedDevice?.id ?? "null"}, forgotten=${this.forgotten}`);
    if (this.connectedDevice?.id !== deviceId) {
      bleOpLog(`onDeviceDisconnected IGNORED — superseded by a newer connection`);
      return; // already superseded by a newer connection
    }
    this.connectedDevice = null;
    if (this.forgotten) {
      bleOpLog(`onDeviceDisconnected — forgotten, not reconnecting`);
      return; // deliberate forgetDevice() — don't reconnect
    }

    this.setConnectionState("connecting", "Connection dropped — reconnecting");
    this.scheduleReconnect(deviceId, deviceName);
  }

  private scheduleReconnect(deviceId: string, deviceName: string) {
    if (this.forgotten) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    bleOpLog(`scheduleReconnect(${deviceId}) — attempt #${this.reconnectAttempt}, delay=${delay}ms`);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      bleOpLog(`scheduleReconnect(${deviceId}) — timer fired, calling connect()`);
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
