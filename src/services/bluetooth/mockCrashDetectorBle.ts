import { ConnectionState, CrashEvent, DeviceFault, DEVICE_LOCAL_NAME, PairedDevice } from "./types";
import { CrashDetectorBle, DiscoveredDevice } from "./crashDetectorBle";

const MOCK_DEVICE: DiscoveredDevice = { id: "mock-crash-detector", name: DEVICE_LOCAL_NAME };

/**
 * Fakes the CrashDetector over BLE so the emergency flow (and screenshots)
 * can be built/QA'd without physically crashing a bike. Same interface as
 * the real service — nothing downstream needs to know which one is wired
 * up. Use `simulateCrash()` from a dev-only control to inject an event.
 */
export class MockCrashDetectorBleService implements CrashDetectorBle {
  private connectionState: ConnectionState = "disconnected";
  private stateListeners = new Set<(state: ConnectionState, errorMessage?: string) => void>();
  private eventListeners = new Set<(event: CrashEvent) => void>();
  private faultListeners = new Set<(fault: DeviceFault | null) => void>();
  private calibrationListeners = new Set<(calibrated: boolean) => void>();
  private paired: PairedDevice | null = null;

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  async getPairedDevice(): Promise<PairedDevice | null> {
    return this.paired;
  }

  async reconnectToPairedDevice(): Promise<void> {
    if (!this.paired) return;
    await this.connect(this.paired.id, this.paired.name);
  }

  startScan(onDeviceFound: (device: DiscoveredDevice) => void): () => void {
    this.setConnectionState("scanning");
    const timer = setTimeout(() => onDeviceFound(MOCK_DEVICE), 600);
    return () => clearTimeout(timer);
  }

  stopScan(): void {
    // no-op — the mock scan is a single fake timer resolved above
  }

  async connect(deviceId: string, deviceName: string): Promise<void> {
    this.setConnectionState("connecting");
    await new Promise((resolve) => setTimeout(resolve, 400));
    this.paired = { id: deviceId, name: deviceName };
    this.setConnectionState("connected");
  }

  async disconnect(): Promise<void> {
    this.setConnectionState("disconnected");
  }

  async calibrate(): Promise<void> {
    if (this.connectionState !== "connected") {
      throw new Error("Not connected to a device");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000)); // mirrors the ~1s the real device spends averaging samples
  }

  async forgetDevice(): Promise<void> {
    this.paired = null;
    this.setConnectionState("disconnected");
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
    return false;
  }

  /** Dev-only: injects a synthetic crash event as if the real sensor sent it. */
  simulateCrash(event: Partial<Omit<CrashEvent, "receivedAt">> = {}): void {
    const full: CrashEvent = {
      severity: 3,
      trigger: "impact",
      impactG: 1.7,
      gyroDps: 1160,
      tilt: 40,
      still: true,
      calibrated: true,
      ...event,
      receivedAt: Date.now(),
    };
    this.eventListeners.forEach((listener) => listener(full));
  }

  /** Dev-only: injects a synthetic device fault as if the real sensor sent it. */
  simulateFault(reason = "sensor_communication_lost"): void {
    this.faultListeners.forEach((listener) => listener({ reason, receivedAt: Date.now() }));
  }

  /** Dev-only: injects a synthetic fault_cleared as if the real sensor sent it. */
  clearFault(): void {
    this.faultListeners.forEach((listener) => listener(null));
  }

  /** Dev-only: injects a synthetic calibration_complete as if the real sensor sent it. */
  simulateCalibrationComplete(calibrated = true): void {
    this.calibrationListeners.forEach((listener) => listener(calibrated));
  }

  private setConnectionState(state: ConnectionState, errorMessage?: string) {
    this.connectionState = state;
    this.stateListeners.forEach((listener) => listener(state, errorMessage));
  }
}
