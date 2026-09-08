// Date of birth as the three separate boxes the UI actually edits (DD / MM /
// YYYY), plus the conversion to and from the "YYYY-MM-DD" string the
// `date` column stores. Same split as phone.ts: "what's in the text inputs"
// on one side, "what's stored" on the other, so onboarding and Edit Profile
// can't drift on what counts as a valid birth date.

export interface Dob {
  day: string;
  month: string;
  year: string;
}

export const EMPTY_DOB: Dob = { day: "", month: "", year: "" };

/** Whether a day/month/year triple is a real past calendar date (catches 31/02, month 13, next century). */
export function isValidDate(day: number, month: number, year: number): boolean {
  if (!day || !month || !year) return false;
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/** True once the rider has typed anything at all — lets an untouched, optional DOB stay valid. */
export function dobEntered(dob: Dob): boolean {
  return dob.day.length > 0 || dob.month.length > 0 || dob.year.length > 0;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a complete, real date — null for anything partial or impossible. */
export function dobToIso(dob: Dob): string | null {
  const day = parseInt(dob.day, 10);
  const month = parseInt(dob.month, 10);
  const year = parseInt(dob.year, 10);
  if (!isValidDate(day, month, year)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Splits a stored "YYYY-MM-DD" back into the three input boxes. */
export function dobFromIso(iso: string | null | undefined): Dob {
  if (!iso) return EMPTY_DOB;
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return EMPTY_DOB;
  return { day, month, year };
}
