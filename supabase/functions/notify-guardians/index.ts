// notify-guardians — Supabase Edge Function
//
// Called the moment a crash alert fires — either EmergencyCountdownScreen's
// 30s countdown expiring unacknowledged (severity 1, reason:
// "missed_checkin") or CrashAlertScreen's countdown expiring / "SEND HELP
// NOW" (severity 2-5, reason: "confirmed_crash"). Notifies every guardian
// on record for the rider via TWO independent channels — a WhatsApp
// message and a voice call — using Twilio's WhatsApp Business API (not the
// old sandbox) and Programmable Voice. A failure in one channel never
// blocks the other, and one guardian's failure never blocks another
// guardian's.
//
// Guardians are no longer gated behind a Twilio sandbox opt-in — every
// guardian on record gets notified the moment they're saved. (The
// guardians.is_active column still exists in the DB but is intentionally
// ignored everywhere in this codebase now — see migration
// 0010_guardian_active_status.sql's history for why it's still there.)
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_NUMBER — the WhatsApp Business API sender, bare E.164
//                             (e.g. "+15551234567", NOT prefixed with
//                             "whatsapp:" — this function adds that prefix
//                             itself for both From and To). This is a
//                             DIFFERENT format from the old sandbox setup,
//                             which stored the value already prefixed —
//                             see the double-prefix defensiveness below.
//   TWILIO_VOICE_NUMBER    — the Twilio number guardian calls are placed
//                             from. Can be the same number as
//                             TWILIO_WHATSAPP_NUMBER if it's voice-capable.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Edge Functions runtime — not set manually.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type NotifyReason = "missed_checkin" | "confirmed_crash";

interface NotifyGuardiansBody {
  rider_id: string;
  severity: number;
  timestamp: string;
  lat: number | null;
  lng: number | null;
  reason?: NotifyReason;
}

// Defensive normalization, not the source of truth — GuardianFormScreen and
// OnboardingScreen's ContactsStep both store guardians.phone in full E.164
// (+91XXXXXXXXXX), but this covers rows written before that fix shipped
// (previously a free-text field with no country-code handling) so a stale
// bare-digits number doesn't fail the Twilio call outright.
function toE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return `+91${digits}`;
}

// Guards against the exact bug this project already hit once with the old
// sandbox number (double "whatsapp:" prefix -> Twilio error 21212) — in
// case TWILIO_WHATSAPP_NUMBER still holds a value left over from the old
// sandbox convention (which was stored pre-prefixed), strip any existing
// prefix before adding our own.
function toWhatsAppAddress(e164: string): string {
  const bare = e164.replace(/^whatsapp:/i, "");
  return `whatsapp:${bare}`;
}

function isValidBody(value: unknown): value is NotifyGuardiansBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.rider_id === "string" &&
    v.rider_id.length > 0 &&
    typeof v.severity === "number" &&
    v.severity >= 1 &&
    v.severity <= 5 &&
    typeof v.timestamp === "string" &&
    !Number.isNaN(new Date(v.timestamp).getTime()) &&
    (v.lat === null || typeof v.lat === "number") &&
    (v.lng === null || typeof v.lng === "number") &&
    (v.reason === undefined || v.reason === "missed_checkin" || v.reason === "confirmed_crash")
  );
}

// XML-escapes user-controlled text (the rider's profile name) before it
// goes inside a TwiML <Say> element — a name containing "&", "<", etc.
// would otherwise produce malformed TwiML that Twilio rejects outright.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// The exact requested template is written for a CONFIRMED crash
// ("has been in a crash"). Severity-1's missed-checkin path is a genuinely
// different, less certain event — the countdown expired with no rider
// response, not a confirmed impact — so asserting "has been in a crash" to
// a guardian in that case would overstate what's actually known. Keeps the
// requested wording verbatim for the confirmed case and uses an honest,
// structurally-identical variant for the uncertain one.
function buildWhatsAppMessage(riderName: string, mapsLink: string, reason: NotifyReason): string {
  const headline =
    reason === "confirmed_crash"
      ? `${riderName} has been in a crash.`
      : `${riderName} may have been in a crash and did not respond to a check-in.`;
  return (
    `🚨 EMERGENCY ALERT 🚨\n\n` +
    `${headline}\n\n` +
    `Last known location: ${mapsLink}\n\n` +
    `Please call them immediately or contact emergency services (112).\n\n` +
    `Sent by Angel Safety App`
  );
}

function buildVoiceMessage(riderName: string, reason: NotifyReason): string {
  const headline =
    reason === "confirmed_crash"
      ? `${riderName} has been in a crash.`
      : `${riderName} may have been in a crash and did not respond to a check-in.`;
  return (
    `Emergency alert. ${headline} Please call them immediately or contact emergency services. ` +
    `This message is from the Angel Safety App.`
  );
}

async function sendWhatsApp(
  twilioSid: string,
  twilioToken: string,
  from: string,
  to: string,
  body: string
): Promise<void> {
  const form = new URLSearchParams({ From: from, To: to, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    throw new Error(`Twilio WhatsApp ${res.status}: ${await res.text()}`);
  }
}

async function placeVoiceCall(
  twilioSid: string,
  twilioToken: string,
  from: string,
  to: string,
  message: string
): Promise<void> {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi">${escapeXml(message)}</Say></Response>`;
  const form = new URLSearchParams({ From: from, To: to, Twiml: twiml });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    throw new Error(`Twilio Voice ${res.status}: ${await res.text()}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase runtime env vars missing");
    }

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
    const twilioVoiceNumber = Deno.env.get("TWILIO_VOICE_NUMBER");
    if (!twilioSid || !twilioToken || !twilioWhatsAppNumber || !twilioVoiceNumber) {
      return jsonResponse(
        {
          error:
            "Twilio is not configured — set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_NUMBER / TWILIO_VOICE_NUMBER",
        },
        500
      );
    }

    // Authenticate the caller from their own session token rather than
    // trusting the request body's rider_id outright — otherwise anyone
    // with an account could spam alerts to a stranger's guardians just by
    // guessing/knowing their user id.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const authClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Invalid session" }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!isValidBody(body)) {
      return jsonResponse({ error: "Malformed request body" }, 400);
    }
    if (body.rider_id !== userData.user.id) {
      return jsonResponse({ error: "rider_id does not match the authenticated session" }, 403);
    }

    // Service role from here on — RLS on guardians/profiles is scoped to
    // the owning user, and this request runs server-side on their behalf
    // (already verified above), not as them.
    const db = createClient(supabaseUrl, serviceRoleKey);

    // WHAT REACHES TWILIO, exhaustively: `From`/`To` (this function's own
    // WhatsApp/voice sender numbers and one guardian's phone at a time —
    // never another guardian's, never the rider's own number), and the
    // message text below (rider name + a Google Maps link built from the
    // lat/lng this endpoint's own caller already validated against the
    // authenticated session). This function never queries
    // emergency_profiles — medical data never reaches Twilio.
    const [{ data: profile }, { data: guardians, error: guardiansError }] = await Promise.all([
      db.from("profiles").select("name").eq("id", body.rider_id).maybeSingle(),
      db.from("guardians").select("id, name, phone").eq("user_id", body.rider_id),
    ]);
    if (guardiansError) throw guardiansError;

    const riderName = profile?.name?.trim() || "Your rider";
    const mapsLink =
      body.lat !== null && body.lng !== null ? `https://maps.google.com/?q=${body.lat},${body.lng}` : "location unavailable";

    const reason = body.reason ?? "missed_checkin";
    const whatsAppMessage = buildWhatsAppMessage(riderName, mapsLink, reason);
    const voiceMessage = buildVoiceMessage(riderName, reason);

    const whatsAppFrom = toWhatsAppAddress(twilioWhatsAppNumber);
    const list = guardians ?? [];

    let whatsAppSent = 0;
    let callsSent = 0;
    const failures: string[] = [];

    // Every guardian gets both channels attempted, independently of every
    // other guardian and independently of the other channel for the same
    // guardian — Promise.allSettled (not allSettled-then-throw, not a
    // plain Promise.all) is what guarantees a WhatsApp failure never skips
    // the call and vice versa, and one guardian's total failure never
    // touches another guardian's attempt.
    await Promise.all(
      list.map(async (guardian) => {
        const guardianE164 = toE164(guardian.phone);

        const [whatsAppResult, callResult] = await Promise.allSettled([
          sendWhatsApp(twilioSid, twilioToken, whatsAppFrom, toWhatsAppAddress(guardianE164), whatsAppMessage),
          placeVoiceCall(twilioSid, twilioToken, twilioVoiceNumber, guardianE164, voiceMessage),
        ]);

        if (whatsAppResult.status === "fulfilled") {
          whatsAppSent += 1;
        } else {
          const msg = whatsAppResult.reason instanceof Error ? whatsAppResult.reason.message : String(whatsAppResult.reason);
          console.error(`[notify-guardians] WhatsApp failed for guardian ${guardian.id} (${guardian.name}): ${msg}`);
          failures.push(`${guardian.name} (WhatsApp): ${msg}`);
        }

        if (callResult.status === "fulfilled") {
          callsSent += 1;
        } else {
          const msg = callResult.reason instanceof Error ? callResult.reason.message : String(callResult.reason);
          console.error(`[notify-guardians] Voice call failed for guardian ${guardian.id} (${guardian.name}): ${msg}`);
          failures.push(`${guardian.name} (call): ${msg}`);
        }
      })
    );

    return jsonResponse({
      total: list.length,
      whatsAppSent,
      callsSent,
      failures,
    });
  } catch (err) {
    console.error("[notify-guardians] error", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
