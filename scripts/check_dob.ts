// Self-check for the date-of-birth parsing shared by onboarding and Edit
// Profile — the one place a bad boundary would either reject a real birth
// date or write an impossible one to the emergency profile.
// Run: node scripts/check_dob.ts   (Node strips the types)

import assert from "node:assert/strict";
import { EMPTY_DOB, dobEntered, dobFromIso, dobToIso, isValidDate } from "../src/lib/dob.ts";

// Real dates round-trip, and single digits get zero-padded on the way out.
assert.equal(dobToIso({ day: "03", month: "02", year: "2003" }), "2003-02-03");
assert.equal(dobToIso({ day: "3", month: "2", year: "2003" }), "2003-02-03");
assert.equal(dobToIso({ day: "29", month: "02", year: "2024" }), "2024-02-29"); // leap year

// Impossible or incomplete dates never reach the database.
assert.equal(dobToIso({ day: "29", month: "02", year: "2023" }), null); // not a leap year
assert.equal(dobToIso({ day: "31", month: "04", year: "1990" }), null); // April has 30
assert.equal(dobToIso({ day: "01", month: "13", year: "1990" }), null);
assert.equal(dobToIso({ day: "12", month: "", year: "1990" }), null); // partial
assert.equal(dobToIso(EMPTY_DOB), null);
assert.equal(dobToIso({ day: "01", month: "01", year: "1899" }), null); // implausibly old
assert.equal(dobToIso({ day: "01", month: "01", year: String(new Date().getFullYear() + 1) }), null); // future

// Splitting a stored value back into the three boxes.
assert.deepEqual(dobFromIso("2003-02-03"), { day: "03", month: "02", year: "2003" });
assert.deepEqual(dobFromIso(null), EMPTY_DOB);
assert.deepEqual(dobFromIso(""), EMPTY_DOB);
assert.deepEqual(dobFromIso("garbage"), EMPTY_DOB);

// "Touched at all" drives the optional-DOB path in Edit Profile: an
// untouched field stays valid, a half-typed one does not.
assert.equal(dobEntered(EMPTY_DOB), false);
assert.equal(dobEntered({ day: "1", month: "", year: "" }), true);

assert.equal(isValidDate(0, 1, 2000), false);
assert.equal(isValidDate(15, 6, 1995), true);

console.log("dob: all checks passed");
