// Shared Indian mobile number helpers — used by phone login and guardian
// management so validation/formatting/masking stay in one place.

/** Indian mobile numbers are always 10 digits starting with 6, 7, 8, or 9. */
const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

export function isValidIndianMobileDigits(digits: string): boolean {
  return INDIAN_MOBILE_PATTERN.test(digits);
}

/** `9876543210` -> `+919876543210`. Assumes digits is already a bare 10-digit number. */
export function toE164IndianPhone(digits: string): string {
  return `+91${digits}`;
}

/** `+919876543210` -> `9876543210` (last 10 digits, whatever prefix precedes them). */
export function digitsFromPhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/** `+919876543210` -> `+91 98765 XXXXX` — shows the first 5 digits, masks the rest. */
export function maskIndianPhone(phone: string): string {
  const digits = digitsFromPhone(phone);
  if (digits.length !== 10) return phone;
  return `+91 ${digits.slice(0, 5)} XXXXX`;
}
