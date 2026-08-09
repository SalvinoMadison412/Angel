import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalibrationConfirmation,
  ConnectionState,
  CrashEvent,
  DeviceFault,
  DiscoveredDevice,
  MockCrashDetectorBleService,
  PairedDevice,
  TelemetryReading,
  getCrashDetectorBle,
} from "../services/bluetooth";

// How long a drop from "connected" gets treated as a brief blip before it's
// allowed to read as a real disconnect. Real-world BLE links dip in and out
// on their own — flashing the whole UI between connected/disconnected for
// every sub-second hiccup reads as broken even when it isn't.
const RECONNECT_GRACE_MS = 2000;

// TEMP DIAGNOSTIC LOGGING — see crashDetectorBle.ts's bleOpLog for why.
// Only logs the real (non-mock) instance's debounce decisions, to keep the
// mock debug panel's traffic out of the trail.
function bleStateLog(...args: unknown[]) {
  console.log(`[BLE-STATE][${new Date().toISOString()}]`, ...args);
}

/** `linkStatus` extends the service's own states with a UI-only "reconnecting" — see RECONNECT_GRACE_MS. */
export type LinkStatus = ConnectionState | "reconnecting";

export function useCrashDetector(options?: { mock?: boolean }) {
  const mock = options?.mock ?? false;
  const service = useMemo(() => getCrashDetectorBle(mock), [mock]);

  const [connectionState, setConnectionState] = useState<ConnectionState>(service.getConnectionState());
  // Debounced view of the same state — see subscribeConnectionState below.
  // Only ever lags `connectionState`, never leads it.
  const [linkStatus, setLinkStatus] = useState<LinkStatus>(service.getConnectionState());
  const lastCommittedStateRef = useRef<ConnectionState>(service.getConnectionState());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [lastEvent, setLastEvent] = useState<CrashEvent | null>(null);
  const [fault, setFault] = useState<DeviceFault | null>(null);
  // Latest confirmed calibration state reported by the device, independent
  // of the calibrate() write's own ack — null until one has ever arrived.
  // Always a fresh object per confirmation (see CalibrationConfirmation) so
  // consumers can detect a new one even when `calibrated` repeats the same
  // boolean, e.g. recalibrating an already-calibrated device.
  const [calibrationConfirmation, setCalibrationConfirmation] = useState<CalibrationConfirmation | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);

  useEffect(() => {
    const unsubscribeState = service.subscribeConnectionState((state, message) => {
      if (!mock) bleStateLog(`raw connectionState -> ${state}${message ? ` (${message})` : ""}`);
      setConnectionState(state);
      setErrorMessage(message);

      if (state === "connected") {
        // Recovered (or connected for the first time) — cancel any pending
        // "confirm the drop" timer and commit immediately. No debounce on
        // the way back up: reconnecting should show as fixed right away.
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        lastCommittedStateRef.current = "connected";
        setLinkStatus("connected");
        if (!mock) bleStateLog(`linkStatus -> connected (committed immediately)`);
        return;
      }

      if (lastCommittedStateRef.current === "connected") {
        // Just dropped from a genuinely connected state — hold the UI at
        // "reconnecting" for a grace window instead of immediately
        // reflecting whatever the raw state is (connecting/disconnected/
        // error can all be the first thing seen mid-blip). Only escalate
        // to the real state if the drop outlasts the window.
        setLinkStatus("reconnecting");
        if (!mock) bleStateLog(`linkStatus -> reconnecting (holding for ${RECONNECT_GRACE_MS}ms grace window)`);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          lastCommittedStateRef.current = state;
          setLinkStatus(state);
          if (!mock) bleStateLog(`grace window expired — linkStatus -> ${state} (real disconnect committed)`);
        }, RECONNECT_GRACE_MS);
        return;
      }

      // Wasn't connected before this (already scanning/connecting/
      // disconnected/error) — nothing to debounce, reflect it immediately.
      lastCommittedStateRef.current = state;
      setLinkStatus(state);
      if (!mock) bleStateLog(`linkStatus -> ${state} (no debounce — wasn't connected before this)`);
    });
    const unsubscribeEvents = service.subscribeCrashEvents(setLastEvent);
    const unsubscribeFault = service.subscribeFaultState(setFault);
    const unsubscribeCalibration = service.subscribeCalibrationComplete(setCalibrationConfirmation);
    service.getPairedDevice().then(setPairedDevice);

    return () => {
      unsubscribeState();
      unsubscribeEvents();
      unsubscribeFault();
      unsubscribeCalibration();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [service]);

  // A previously paired device should reconnect on its own when the app
  // (re)starts — the rider shouldn't have to re-pair every ride. Runs on
  // every mount of every component calling this hook (real instance), not
  // just app launch — see connect()'s idempotency guard in crashDetectorBle.ts.
  useEffect(() => {
    if (!mock) bleStateLog(`hook mounted — calling reconnectToPairedDevice()`);
    service.reconnectToPairedDevice();
  }, [service, mock]);

  const scan = useCallback(() => {
    setDiscoveredDevices([]);
    return service.startScan((device) =>
      setDiscoveredDevices((prev) => (prev.some((d) => d.id === device.id) ? prev : [...prev, device]))
    );
  }, [service]);

  const connect = useCallback(
    async (deviceId: string, deviceName: string) => {
      await service.connect(deviceId, deviceName);
      setPairedDevice({ id: deviceId, name: deviceName });
    },
    [service]
  );

  const disconnect = useCallback(() => service.disconnect(), [service]);

  const calibrate = useCallback(() => service.calibrate(), [service]);

  const forgetDevice = useCallback(async () => {
    await service.forgetDevice();
    setPairedDevice(null);
    setDiscoveredDevices([]);
  }, [service]);

  const checkAndroidLocationServicesDisabled = useCallback(
    () => service.isAndroidLocationServicesDisabled(),
    [service]
  );

  const simulateCrash = mock
    ? (event?: Partial<Omit<CrashEvent, "receivedAt">>) => (service as MockCrashDetectorBleService).simulateCrash(event)
    : undefined;
  const simulateFault = mock
    ? (reason?: string) => (service as MockCrashDetectorBleService).simulateFault(reason)
    : undefined;
  const clearSimulatedFault = mock ? () => (service as MockCrashDetectorBleService).clearFault() : undefined;
  const simulateCalibrationComplete = mock
    ? (calibrated?: boolean) => (service as MockCrashDetectorBleService).simulateCalibrationComplete(calibrated)
    : undefined;

  return {
    connectionState,
    linkStatus,
    isLinked: linkStatus === "connected" || linkStatus === "reconnecting",
    isReconnecting: linkStatus === "reconnecting",
    errorMessage,
    lastEvent,
    fault,
    calibrationConfirmation,
    discoveredDevices,
    pairedDevice,
    scan,
    connect,
    disconnect,
    calibrate,
    forgetDevice,
    checkAndroidLocationServicesDisabled,
    simulateCrash,
    simulateFault,
    clearSimulatedFault,
    simulateCalibrationComplete,
  };
}

/**
 * Isolated from useCrashDetector() on purpose. The firmware streams
 * telemetry continuously (~10/s) the entire time a device is connected —
 * subscribing to it inside the main hook meant every screen calling
 * useCrashDetector() re-rendered at that rate too, even ones that never
 * read telemetry (e.g. DeviceSetupScreen, DeviceScreen), which is what
 * produced the Device tab's constant flicker. Only components that
 * actually display live telemetry (HomeScreen, DiagnosticScreen) should
 * pay for these re-renders — call this hook there, and nowhere else.
 */
export function useCrashDetectorTelemetry(options?: { mock?: boolean }): TelemetryReading | null {
  const mock = options?.mock ?? false;
  const service = useMemo(() => getCrashDetectorBle(mock), [mock]);
  const [telemetry, setTelemetry] = useState<TelemetryReading | null>(null);

  useEffect(() => service.subscribeTelemetry(setTelemetry), [service]);

  return telemetry;
}
