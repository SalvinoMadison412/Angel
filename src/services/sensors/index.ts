import { MockSensorDataSource } from "./MockSensorDataSource";

export * from "./SensorDataSource";
export * from "./MockSensorDataSource";

// Single shared instance the whole app reads from. Swap the implementation
// here when a real BLE/device data source exists — nothing downstream changes.
export const sensorDataSource = new MockSensorDataSource();
