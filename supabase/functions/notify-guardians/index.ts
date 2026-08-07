// notify-guardians — Supabase Edge Function
//
// Two ways this gets invoked:
//
// 1. Database Webhook on `insert` to public.crash_tickets (Dashboard →
//    Database → Webhooks → new hook → table crash_tickets → Insert →
//    target this function). This is the main India-stack crash alert path:
//    the instant a crash_tickets row exists, guardians get an SMS (MSG91)
//    and a voice call (Exotel), and delivery status is written back onto
//    the crash_tickets row. Auth: Database Webhooks created via the
//    Dashboard's "Supabase Edge Functions" target send the project's
//    service_role key as a Bearer token by default — this function checks
//    that header against SUPABASE_SERVICE_ROLE_KEY (available automatically
//    to every Edge Function) rather than a hand-rolled shared secret.
//
// 2. Direct client call from the app (see sendGuardianAlert in
//    src/services/emergency/emergencyPipeline.ts) for the lighter,
//    severity-1 "missed check-in" path, which never creates a crash_tickets
//    row (see EmergencyCountdownScreen / shouldTriggerAlert) so there's no
//    insert for a webhook to fire on. Auth: the caller's own Supabase
//    session, verified against rider_id in the body — same pattern as any
//    other user-authenticated Edge Function call.
//
// Both paths converge on the same MSG91 SMS + Exotel voice call senders
// below; only the trigger, auth, and (for path 1) the delivery-status
// write-back differ.
//
// Required secrets (Dashboard → Edge Functions → notify-guardians → Secrets,
// or `supabase secrets set`):
//   MSG91_API_KEY
//   MSG91_SENDER_ID
//   MSG91_DLT_TEMPLATE_ID   — pre-approved DLT template matching the
//                             message below (name/link/time variables)
//   EXOTEL_API_KEY
//   EXOTEL_API_TOKEN
//   EXOTEL_SID
//   EXOTEL_SUBDOMAIN
//   EXOTEL_CALLER_ID
//   EXOTEL_FLOW_APP_ID     — see sendExotelCall below; not in the original
//                             credentials list but required for TTS to work.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Edge Functions runtime.

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

// ─────────────────────────────────────────────────────────────────────────
// MSG91 SMS + Exotel voice call — shared by both invocation paths below.
// ─────────────────────────────────────────────────────────────────────────

async function sendMsg91Sms(
  guardianPhone: string,
  vars: { riderName: string; mapsUrl: string; timestamp: string }
): Promise<boolean> {
  const apiKey = Deno.env.get("MSG91_API_KEY");
  const senderId = Deno.env.get("MSG91_SENDER_ID");
  const templateId = Deno.env.get("MSG91_DLT_TEMPLATE_ID");
  if (!apiKey || !senderId || !templateId) {
    console.warn("[notify-guardians] MSG91 not configured — skipping SMS");
    return false;
  }

  try {
    // MSG91's Flow API sends a pre-approved DLT template with variables
    // filled in — required for transactional SMS to Indian numbers, since
    // free-text SMS content isn't DLT-registered and gets silently dropped
    // by Indian carriers. The template behind MSG91_DLT_TEMPLATE_ID must
    // itself contain VAR1/VAR2/VAR3 in the same order as the message below.
    const res = await fetch("https://api.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        flow_id: templateId,
        sender: senderId,
        mobiles: [guardianPhone.replace(/^\+/, "")],
        VAR1: vars.riderName,
        VAR2: vars.mapsUrl,
        VAR3: vars.timestamp,
      }),
    });
    if (!res.ok) {
      console.warn(`[notify-guardians] MSG91 ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[notify-guardians] MSG91 request failed", err);
    return false;
  }
}

async function initiateExotelCall(guardianPhone: string, message: string): Promise<boolean> {
  const apiKey = Deno.env.get("EXOTEL_API_KEY");
  const apiToken = Deno.env.get("EXOTEL_API_TOKEN");
  const sid = Deno.env.get("EXOTEL_SID");
  const subdomain = Deno.env.get("EXOTEL_SUBDOMAIN");
  const callerId = Deno.env.get("EXOTEL_CALLER_ID");
  const flowAppId = Deno.env.get("EXOTEL_FLOW_APP_ID");
  if (!apiKey || !apiToken || !sid || !subdomain || !callerId || !flowAppId) {
    console.warn("[notify-guardians] Exotel not configured — skipping call");
    return false;
  }

  try {
    // Exotel has no "speak this raw string" REST call — a call can only be
    // connected to a pre-built ExoML Flow (Exotel dashboard → Flows → new
    // Flow → add a "Text to Speech" applet reading {{CustomField}} →
    // publish, then copy its App ID into EXOTEL_FLOW_APP_ID). The dynamic
    // message is passed to that flow via CustomField on the connect call.
    const flowUrl = `http://my.exotel.com/${sid}/exoml/start_voice/${flowAppId}?CustomField=${encodeURIComponent(message)}`;

    const form = new URLSearchParams({
      From: callerId,
      To: guardianPhone,
      CallerId: callerId,
      Url: flowUrl,
    });

    const res = await fetch(`https://${subdomain}/v1/Accounts/${sid}/Calls/connect.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:${apiToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      console.warn(`[notify-guardians] Exotel ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[notify-guardians] Exotel request failed", err);
    return false;
  }
}

function buildMapsUrl(lat: number | null, lng: number | null): string {
  return lat !== null && lng !== null ? `https://maps.google.com/?q=${lat},${lng}` : "location unavailable";
}

function buildAlertMessage(riderName: string, mapsUrl: string, timestampIst: string): string {
  return (
    `URGENT: ${riderName} may have been in a road accident. ` +
    `Last known location: ${mapsUrl} ` +
    `Time: ${timestampIst} IST. ` +
    `Please call them or go to their location immediately.`
  );
}

async function alertGuardians(
  guardians: { phone_number: string }[],
  riderName: string,
  lat: number | null,
  lng: number | null,
  timestampIso: string
): Promise<{ smsOk: number; callOk: number }> {
  const mapsUrl = buildMapsUrl(lat, lng);
  const timestampIst = new Date(timestampIso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });
  const message = buildAlertMessage(riderName, mapsUrl, timestampIst);

  let smsOk = 0;
  let callOk = 0;
  await Promise.all(
    guardians.map(async (guardian) => {
      const [smsSent, callInitiated] = await Promise.all([
        sendMsg91Sms(guardian.phone_number, { riderName, mapsUrl, timestamp: timestampIst }),
        initiateExotelCall(guardian.phone_number, message),
      ]);
      if (smsSent) smsOk += 1;
      if (callInitiated) callOk += 1;
    })
  );
  return { smsOk, callOk };
}

// ─────────────────────────────────────────────────────────────────────────
// Path 1 — Database Webhook on crash_tickets insert
// ─────────────────────────────────────────────────────────────────────────

interface CrashTicketRecord {
  id: string;
  rider_id: string;
  rider_lat: number | null;
  rider_lng: number | null;
  created_at: string;
}

interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: CrashTicketRecord;
}

function isWebhookPayload(value: unknown): value is DatabaseWebhookPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "INSERT" || v.table !== "crash_tickets") return false;
  const record = v.record as Record<string, unknown> | undefined;
  if (!record || typeof record !== "object") return false;
  return (
    typeof record.id === "string" &&
    typeof record.rider_id === "string" &&
    (record.rider_lat === null || typeof record.rider_lat === "number") &&
    (record.rider_lng === null || typeof record.rider_lng === "number") &&
    typeof record.created_at === "string"
  );
}

async function handleCrashTicketWebhook(
  db: ReturnType<typeof createClient>,
  ticket: CrashTicketRecord
): Promise<Response> {
  try {
    const [{ data: profile }, { data: guardians, error: guardiansError }] = await Promise.all([
      db.from("profiles").select("name").eq("id", ticket.rider_id).maybeSingle(),
      db.from("guardians").select("phone_number").eq("user_id", ticket.rider_id),
    ]);
    if (guardiansError) throw guardiansError;

    if (!guardians || guardians.length === 0) {
      console.log(`[notify-guardians] no guardians for rider ${ticket.rider_id} — nothing to send`);
      return jsonResponse({ sent: 0, total: 0, note: "no guardians on file" });
    }

    const riderName = profile?.name?.trim() || "Your rider";
    const { smsOk, callOk } = await alertGuardians(guardians, riderName, ticket.rider_lat, ticket.rider_lng, ticket.created_at);

    const { error: updateError } = await db
      .from("crash_tickets")
      .update({
        sms_status: smsOk > 0 ? "sent" : "failed",
        call_status: callOk > 0 ? "initiated" : "failed",
        alerted_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);
    if (updateError) console.warn("[notify-guardians] failed to write delivery status", updateError);

    return jsonResponse({ total: guardians.length, smsSent: smsOk, callsInitiated: callOk });
  } catch (err) {
    console.error("[notify-guardians] webhook path error", err);
    await db
      .from("crash_tickets")
      .update({ sms_status: "failed", call_status: "failed", alerted_at: new Date().toISOString() })
      .eq("id", ticket.id)
      .then(undefined, () => undefined);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Path 2 — direct client call (severity-1 missed check-in, no crash_ticket)
// ─────────────────────────────────────────────────────────────────────────

interface DirectCallBody {
  rider_id: string;
  severity: number;
  timestamp: string;
  lat: number | null;
  lng: number | null;
}

function isDirectCallBody(value: unknown): value is DirectCallBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.rider_id === "string" &&
    v.rider_id.length > 0 &&
    typeof v.severity === "number" &&
    typeof v.timestamp === "string" &&
    !Number.isNaN(new Date(v.timestamp).getTime()) &&
    (v.lat === null || typeof v.lat === "number") &&
    (v.lng === null || typeof v.lng === "number")
  );
}

async function handleDirectCall(
  db: ReturnType<typeof createClient>,
  authClient: ReturnType<typeof createClient>,
  token: string,
  body: DirectCallBody
): Promise<Response> {
  // Authenticate the caller from their own session token rather than
  // trusting the request body's rider_id outright — otherwise anyone with
  // an account could spam alerts to a stranger's guardians just by
  // guessing/knowing their user id.
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }
  if (body.rider_id !== userData.user.id) {
    return jsonResponse({ error: "rider_id does not match the authenticated session" }, 403);
  }

  const [{ data: profile }, { data: guardians, error: guardiansError }] = await Promise.all([
    db.from("profiles").select("name").eq("id", body.rider_id).maybeSingle(),
    db.from("guardians").select("phone_number").eq("user_id", body.rider_id),
  ]);
  if (guardiansError) throw guardiansError;

  const list = guardians ?? [];
  if (list.length === 0) return jsonResponse({ sent: 0, total: 0 });

  const riderName = profile?.name?.trim() || "Your rider";
  const { smsOk } = await alertGuardians(list, riderName, body.lat, body.lng, body.timestamp);

  return jsonResponse({ sent: smsOk, total: list.length });
}

// ─────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase runtime env vars missing" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const db = createClient(supabaseUrl, serviceRoleKey);

  const body = await req.json().catch(() => null);

  try {
    if (isWebhookPayload(body)) {
      // The Database Webhook's own Bearer token must be the service role
      // key — this is the only path allowed to run with no per-user check.
      if (token !== serviceRoleKey) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      return await handleCrashTicketWebhook(db, body.record);
    }

    if (isDirectCallBody(body)) {
      if (!token) return jsonResponse({ error: "Missing Authorization header" }, 401);
      const authClient = createClient(supabaseUrl, serviceRoleKey);
      return await handleDirectCall(db, authClient, token, body);
    }

    return jsonResponse({ error: "Malformed request body" }, 400);
  } catch (err) {
    console.error("[notify-guardians] error", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
