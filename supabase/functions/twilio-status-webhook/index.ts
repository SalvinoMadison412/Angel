// twilio-status-webhook — Supabase Edge Function
//
// TODO (deploy step): after deploying this function, paste its URL —
// https://vqkwdwbzbwjplxqpqsuj.supabase.co/functions/v1/twilio-status-webhook
// (this project's ref; verified via the Supabase MCP get_project_url tool —
// swap the ref if this ever runs against a different project) — into the
// Twilio Console at:
//   Messaging → Try it out → Send a WhatsApp message → Sandbox settings
//   → "WHEN A MESSAGE COMES IN" (set method to HTTP POST)
// (Console path: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
// This is what makes Twilio actually call this function whenever a
// guardian sends anything to the sandbox number, including their initial
// opt-in.
//
// Twilio calls this webhook for every inbound WhatsApp message to our
// sandbox number. A guardian who has completed the sandbox join flow and
// then sends any message triggers this — we take that as proof they've
// opted in and flip guardians.is_active to true for every guardian row
// with that phone number (a guardian can be added by more than one rider;
// the opt-in is per phone number against Twilio's shared sandbox, not
// per-guardian-row, so all of them should activate together).
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   TWILIO_AUTH_TOKEN — used ONLY to validate X-Twilio-Signature below,
//                       never sent anywhere, never exposed to a client.
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — provided automatically by
//                       the Edge Functions runtime.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWIML_EMPTY_RESPONSE = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";

function twimlResponse(status = 200): Response {
  // Always TwiML, even on a rejected/malformed request — an error JSON body
  // here would make Twilio treat the webhook itself as broken and retry
  // repeatedly; an empty <Response/> tells Twilio "received, nothing to
  // reply with" regardless of what we internally decided about it.
  return new Response(TWIML_EMPTY_RESPONSE, {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

// Twilio's request-signing scheme: sort the POST body's params by key,
// concatenate "key"+"value" for each directly onto the full request URL
// (no separators), HMAC-SHA1 the result with the Auth Token, base64-encode.
// See https://www.twilio.com/docs/usage/security#validating-requests.
async function computeTwilioSignature(url: string, params: Record<string, string>, authToken: string): Promise<string> {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
}

// Constant-time string compare — a signature check that short-circuits on
// the first mismatched character leaks timing information an attacker can
// use to forge a valid signature byte-by-byte.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function toE164FromWhatsApp(from: string): string {
  // Twilio's WhatsApp `From` looks like "whatsapp:+14155551234" — strip the
  // prefix to get the bare E.164 number this app stores in guardians.phone.
  return from.replace(/^whatsapp:/i, "").trim();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return twimlResponse(405);
  }

  try {
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authToken || !supabaseUrl || !serviceRoleKey) {
      console.error("[twilio-status-webhook] missing required env vars");
      return twimlResponse(500);
    }

    // Twilio sends this as application/x-www-form-urlencoded, not JSON.
    const rawBody = await req.text();
    const form = new URLSearchParams(rawBody);
    const params: Record<string, string> = {};
    for (const [key, value] of form.entries()) params[key] = value;

    // Validate this request actually came from Twilio before trusting
    // anything in it — without this, anyone who finds this function's URL
    // could POST an arbitrary `From` and flip any guardian's is_active to
    // true, bypassing the opt-in requirement entirely.
    const signatureHeader = req.headers.get("X-Twilio-Signature");
    if (!signatureHeader) {
      console.warn("[twilio-status-webhook] rejected — missing X-Twilio-Signature header");
      return twimlResponse(403);
    }
    const expectedSignature = await computeTwilioSignature(req.url, params, authToken);
    if (!timingSafeEqual(expectedSignature, signatureHeader)) {
      console.warn("[twilio-status-webhook] rejected — signature mismatch");
      return twimlResponse(403);
    }

    const from = params["From"];
    if (!from) {
      console.warn("[twilio-status-webhook] no From field in payload — nothing to do");
      return twimlResponse(200);
    }

    const guardianPhone = toE164FromWhatsApp(from);
    const db = createClient(supabaseUrl, serviceRoleKey);

    // No .eq(..., false) guard — re-activating an already-active guardian
    // is a harmless no-op, and requiring the prior state to be false would
    // just make this fragile against a guardian messaging more than once.
    const { data, error } = await db
      .from("guardians")
      .update({ is_active: true })
      .eq("phone", guardianPhone)
      .select("id");

    if (error) {
      console.error("[twilio-status-webhook] failed to update guardian is_active", error.message);
      return twimlResponse(500);
    }

    if (!data || data.length === 0) {
      // Not necessarily an error — could be a wrong-number text to the
      // sandbox, or a guardian who joined before ever being added in the
      // app. Logged, not failed, so Twilio doesn't retry indefinitely.
      console.warn(`[twilio-status-webhook] no guardian row found for phone ${guardianPhone}`);
    } else {
      console.log(`[twilio-status-webhook] activated ${data.length} guardian row(s) for phone ${guardianPhone}`);
    }

    return twimlResponse(200);
  } catch (err) {
    console.error("[twilio-status-webhook] error", err);
    return twimlResponse(500);
  }
});
