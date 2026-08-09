import { Linking } from "react-native";

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
 * Builds the deep link a rider shares with a guardian so the guardian can
 * opt into the Twilio WhatsApp sandbox with one tap. Returns null if the
 * env vars aren't configured — callers should hide/disable the share
 * affordance entirely in that case rather than open a broken link.
 *
 * Deliberately does NOT strip the leading "+" from the number — matches
 * wa.me's own documented/observed tolerance for it, and keeps the built URL
 * an exact match for what EXPO_PUBLIC_TWILIO_WHATSAPP_NUMBER actually holds
 * (e.g. "+14155238886") rather than a silently-transformed variant.
 */
export function buildGuardianOptInLink(): string | null {
  if (!isWhatsAppOptInConfigured()) return null;
  return `https://wa.me/${RAW_NUMBER!.trim()}?text=${encodeURIComponent(RAW_JOIN_MESSAGE!.trim())}`;
}

/**
 * Whether WhatsApp itself is actually installed, as best Android's package
 * visibility rules let us tell — probes the native "whatsapp://send" scheme
 * rather than the https://wa.me/... URL we actually open, because the https
 * form nearly always resolves "true" (any browser can open an https link,
 * WhatsApp installed or not) and would make this check useless. Needs the
 * <queries> entry added by plugins/withWhatsAppQuery.js — see that file for
 * why the check would otherwise return false even when WhatsApp is present.
 */
export async function isWhatsAppInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL("whatsapp://send");
  } catch {
    return false;
  }
}

/** Bare, human-shareable values for the copy-to-clipboard fallback when WhatsApp isn't installed. */
export function guardianOptInFallbackText(): { number: string; message: string } | null {
  if (!isWhatsAppOptInConfigured()) return null;
  return { number: RAW_NUMBER!.trim(), message: RAW_JOIN_MESSAGE!.trim() };
}
