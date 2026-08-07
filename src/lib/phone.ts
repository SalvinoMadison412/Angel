// Every phone number this app collects (rider profile, guardians) is
// entered as a 10-digit Indian mobile number behind a fixed "+91" box —
// see PhoneEntryScreen, ProfileScreen, GuardianFormScreen, and
// OnboardingScreen's ContactsStep. These two helpers keep that shape
// consistent between "what's in the text input" (bare digits) and "what's
// stored/sent" (full E.164), so nothing downstream (Twilio, guardian
// insert/update) ever sees a malformed number.

/** Strips any country-code prefix/formatting and keeps just the last 10 digits — the shape every phone number in this app is edited against. */
export function localDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Builds the full E.164 number from a 10-digit local number — the shape every phone number in this app is stored/sent as. */
export function toE164(digits: string): string {
  return `+91${digits}`;
}
