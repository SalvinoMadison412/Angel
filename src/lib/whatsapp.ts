// Twilio's WhatsApp sandbox requires every recipient to opt in themselves —
// send "join <phrase>" to the sandbox number from WhatsApp — before Twilio
// will deliver anything to them. Angel can't do that on a guardian's
// behalf; the best it can do is make sending that message from the
// guardian's own phone a single tap, via a wa.me deep link the rider shares
// with them. See supabase/functions/twilio-status-webhook for the other
// half (marking a guardian active once Twilio tells us they joined).

const RAW_NUMBER = process.env.EXPO_PUBLIC_TWILIO_WHATSAPP_NUMBER;
const RAW_JOIN_MESSAGE = process.env.EXPO_PUBLIC_TWILIO_JOIN_MESSAGE;

/** True once both env vars needed to build a working wa.me link are actually set. */
export function isWhatsAppOptInConfigured(): boolean {
  return Boolean(RAW_NUMBER?.trim() && RAW_JOIN_MESSAGE?.trim());
}

/**
 * wa.me wants the destination number as bare digits (country code, no "+",
 * no spaces, no "whatsapp:" prefix) — different shape from the E.164
 * strings the rest of this app uses for guardians themselves.
 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Builds the deep link a rider shares with a guardian so the guardian can
 * opt into the Twilio WhatsApp sandbox with one tap. Returns null if the
 * env vars aren't configured — callers should hide the share affordance
 * entirely in that case rather than open a broken link.
 */
export function buildGuardianOptInLink(): string | null {
  if (!isWhatsAppOptInConfigured()) return null;
  const number = digitsOnly(RAW_NUMBER!);
  const text = encodeURIComponent(RAW_JOIN_MESSAGE!.trim());
  return `https://wa.me/${number}?text=${text}`;
}
