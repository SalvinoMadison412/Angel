import { SensorDataSource, SensorReading } from "./SensorDataSource";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Simulates the device's telemetry stream with a gentle random walk, since
 * the real IoT device / BLE link doesn't exist yet. Swap this for a BLE
 * implementation or a Supabase Realtime channel fed by the real device
 * later — callers only depend on the SensorDataSource interface.
 */
export class MockSensorDataSource implements SensorDataSource {
  private intervalMs: number;

  constructor(intervalMs = 1200) {
    this.intervalMs = intervalMs;
  }

  subscribe(callback: (reading: SensorReading) => void): () => void {
    let gForce = 0.05;
    let leanAngleDeg = 4;
    let speedKmh = 38;

    const tick = () => {
      gForce = clamp(gForce + (Math.random() - 0.5) * 0.04, 0.01, 0.3);
      leanAngleDeg = clamp(leanAngleDeg + (Math.random() - 0.5) * 4, 0, 35);
      speedKmh = clamp(speedKmh + (Math.random() - 0.5) * 6, 0, 80);

      callback({
        gForce: Number(gForce.toFixed(2)),
        leanAngleDeg: Math.round(leanAngleDeg),
        speedKmh: Math.round(speedKmh),
        ts: Date.now(),
      });
    };

    tick();
    const id = setInterval(tick, this.intervalMs);
    return () => clearInterval(id);
  }
}
