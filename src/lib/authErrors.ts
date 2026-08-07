import { AuthError } from "@supabase/supabase-js";

/**
 * Supabase/GoTrue returns fairly technical error strings for phone OTP
 * failures. Map the ones riders will actually hit to plain language rather
 * than surfacing "Token has expired or is invalid" verbatim.
 */
export function phoneAuthErrorMessage(error: AuthError | Error | unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes("failed to fetch") || lower.includes("network request failed") || lower.includes("network error")) {
    return "Couldn't reach the server — check your connection and try again.";
  }
  if (lower.includes("invalid phone") || lower.includes("phone number") && lower.includes("invalid")) {
    return "That doesn't look like a valid 10-digit Indian mobile number.";
  }
  if (lower.includes("expired")) {
    return "That code has expired. Request a new one.";
  }
  if (
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("only request this after")
  ) {
    return "Too many attempts. Wait a moment before trying again.";
  }
  if (lower.includes("invalid") && (lower.includes("token") || lower.includes("otp") || lower.includes("code"))) {
    return "Incorrect code. Check the 6 digits and try again.";
  }
  return raw;
}
