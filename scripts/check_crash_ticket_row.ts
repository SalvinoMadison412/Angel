// Self-check for the crash_tickets insert body shared by all three
// emergency paths — the one place where a wrong field would either strand a
// rider (constraint violation, no ticket, no partner dispatched) or feed
// partners fake sensor readings from a manual SOS.
// Run: node scripts/check_crash_ticket_row.ts   (Node strips the types)

import assert from "node:assert/strict";
import { crashTicketRow } from "../src/lib/crashTicket.ts";

const sev4 = { severity: 4, trigger: "impact" as const, impactG: 9.2, gyroDps: 410, tilt: 78 };
const sev1 = { severity: 1, trigger: "tilt" as const, impactG: 1.4, gyroDps: 60, tilt: 44 };
// What GuardianNotifiedScreen passes for "I NEED HELP NOW" — placeholder
// zeros, not measurements.
const synthetic = { severity: 1, trigger: "impact" as const, impactG: 0, gyroDps: 0, tilt: 0 };

// Detected crash, severity 2-5: sensor fields written, `source` omitted so
// the column default ('crash', migration 0019b) applies.
const a = crashTicketRow({ userId: "r", source: "crash", event: sev4, lat: 12.97, lng: 77.59 });
assert.equal("source" in a, false, "a detected crash must rely on the DB default");
assert.equal(a.severity, 4);
assert.equal(a.trigger, "impact");
assert.equal(a.impact_g, 9.2);
assert.equal(a.status, "open");

// Severity 1 is a real detected crash too — same shape, lower severity.
// (Partners are dispatched for it; it is not the manual path.)
const b = crashTicketRow({ userId: "r", source: "crash", event: sev1, lat: 12.97, lng: 77.59 });
assert.equal("source" in b, false);
assert.equal(b.severity, 1);
assert.equal(b.trigger, "tilt");
assert.equal(b.gyro_dps, 60);

// Manual SOS: `source` explicit, and every sensor field NULL despite the
// synthetic event carrying zeros.
const c = crashTicketRow({ userId: "r", source: "manual", event: synthetic, lat: 12.97, lng: 77.59 });
assert.equal((c as { source?: string }).source, "manual");
for (const key of ["severity", "trigger", "impact_g", "gyro_dps", "tilt_deg"] as const) {
  assert.equal((c as Record<string, unknown>)[key], null, `manual ticket ${key} must be null`);
}

// Location is independent of source — a denied/timed-out fix nulls both
// rather than blocking the ticket.
const d = crashTicketRow({ userId: "r", source: "manual", event: synthetic, lat: null, lng: null });
assert.equal(d.rider_lat, null);
assert.equal(d.rider_lng, null);

console.log("ok — crash_tickets insert shapes match the schema contract");
