export interface SensorReading {
  gForce: number;
  leanAngleDeg: number;
  speedKmh: number;
  ts: number;
}

export interface SensorDataSource {
  /** Start streaming readings. Returns an unsubscribe function. */
  subscribe(callback: (reading: SensorReading) => void): () => void;
}
