// Structural subset of CrashEvent (services/bluetooth/types) and
// CrashTicketSource (types/database) — declared inline, not imported, so
// this module stays import-free and node can run the self-check against it
// directly (scripts/check_crash_ticket_row.ts). A real CrashEvent satisfies
// this by structural typing; the callers are typed against the real ones.
interface CrashTicketEvent {
  severity: number;
  trigger: "impact" | "tilt";
  impactG: number;
  gyroDps: number;
  tilt: number;
}

/**
 * The crash_tickets insert body, shared by all three emergency paths
 * (severity 2-5 crash, severity 1 crash, manual "I NEED HELP NOW").
 *
 * The manual path passes a synthetic event full of placeholder zeros to
 * satisfy the shared signature; those must never be written as if they were
 * measurements, so every sensor field is nulled when source is 'manual'.
 */
export function crashTicketRow(input: {
  userId: string;
  source: "crash" | "manual";
  event: CrashTicketEvent;
  lat: number | null;
  lng: number | null;
}) {
  const sensor = input.source === "crash";
  return {
    rider_id: input.userId,
    // Only sent for a manual SOS — a 'crash' row takes the column's
    // server-side default (migration 0019b), so a detected crash writes one
    // fewer field and can't disagree with the default.
    ...(input.source === "manual" ? { source: "manual" } : {}),
    severity: sensor ? input.event.severity : null,
    trigger: sensor ? input.event.trigger : null,
    impact_g: sensor ? input.event.impactG : null,
    gyro_dps: sensor ? input.event.gyroDps : null,
    tilt_deg: sensor ? input.event.tilt : null,
    rider_lat: input.lat,
    rider_lng: input.lng,
    status: "open" as const,
  };
}
