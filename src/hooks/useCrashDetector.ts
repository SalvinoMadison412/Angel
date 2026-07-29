import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConnectionState,
  CrashEvent,
  DeviceFault,
  DiscoveredDevice,
  MockCrashDetectorBleService,
  PairedDevice,
  getCrashDetectorBle,
} from "../services/bluetooth";

export function useCrashDetector(options?: { mock?: boolean }) {
  const mock = options?.mock ?? false;
  const service = useMemo(() => getCrashDetectorBle(mock), [mock]);

  const [connectionState, setConnectionState] = useState<ConnectionState>(service.getConnectionState());
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [lastEvent, setLastEvent] = useState<CrashEvent | null>(null);
  const [fault, setFault] = useState<DeviceFault | null>(null);
  // Latest confirmed calibration state reported by the device, independent
  // of the calibrate() write's own ack — null until one has ever arrived.
  const [calibrationConfirmed, setCalibrationConfirmed] = useState<boolean | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);

  useEffect(() => {
    const unsubscribeState = service.subscribeConnectionState((state, message) => {
      setConnectionState(state);
      setErrorMessage(message);
    });
    const unsubscribeEvents = service.subscribeCrashEvents(setLastEvent);
    const unsubscribeFault = service.subscribeFaultState(setFault);
    const unsubscribeCalibration = service.subscribeCalibrationComplete(setCalibrationConfirmed);
    service.getPairedDevice().then(setPairedDevice);

    return () => {
      unsubscribeState();
      unsubscribeEvents();
      unsubscribeFault();
      unsubscribeCalibration();
    };
  }, [service]);

  // A previously paired device should reconnect on its own when the app
  // (re)starts — the rider shouldn't have to re-pair every ride.
  useEffect(() => {
    service.reconnectToPairedDevice();
  }, [service]);

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
    errorMessage,
    lastEvent,
    fault,
    calibrationConfirmed,
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
