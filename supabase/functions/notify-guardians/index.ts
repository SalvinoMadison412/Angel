// notify-guardians — Supabase Edge Function
//
// Called by the app the moment EmergencyCountdownScreen's countdown expires
// without the rider tapping "I'm okay" (see sendGuardianAlert in
// src/services/emergency/emergencyPipeline.ts). Sends one SMS via Twilio to
// every guardian on record for the rider, containing who, when, how severe,
// and a Google Maps link to their last known location.
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER   — an SMS-capable Twilio number, e.g. "+15551234567"
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
  // Which alert path triggered this — changes the SMS copy below.
  // "missed_checkin": severity-1 countdown expired with no rider response.
  // "confirmed_crash": severity 2-5, already dispatched to a responder.
  // Defaults to "missed_checkin" so existing callers (severity-1 path,
  // shipped before this field existed) keep their exact original copy.
  reason?: NotifyReason;
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
    const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");
    if (!twilioSid || !twilioToken || !twilioFrom) {
      return jsonResponse(
        { error: "Twilio is not configured — set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER" },
        500
      );
    }

    // Authenticate the caller from their own session token rather than
    // trusting the request body's rider_id outright — otherwise anyone
    // with an account could spam SMS to a stranger's guardians just by
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

    const [{ data: profile }, { data: guardians, error: guardiansError }] = await Promise.all([
      db.from("profiles").select("name").eq("id", body.rider_id).maybeSingle(),
      db.from("guardians").select("name, phone").eq("user_id", body.rider_id),
    ]);
    if (guardiansError) throw guardiansError;

    const riderName = profile?.name?.trim() || "Your rider";
    const when = new Date(body.timestamp).toLocaleString("en-IN", { hour12: false });
    const mapsLink =
      body.lat !== null && body.lng !== null
        ? `https://www.google.com/maps?q=${body.lat},${body.lng}`
        : "location unavailable";

    const reason = body.reason ?? "missed_checkin";
    const message =
      reason === "confirmed_crash"
        ? `Angel emergency alert: ${riderName} was in a crash (severity ${body.severity}/5) at ${when}. ` +
          `A responder has been dispatched. Last known location: ${mapsLink}`
        : `Angel emergency alert: ${riderName} may have been in a crash (severity ${body.severity}/5) ` +
          `at ${when} and did not respond to a 30-second check-in. Last known location: ${mapsLink}`;

    const list = guardians ?? [];
    let sent = 0;
    const failures: string[] = [];

    await Promise.all(
      list.map(async (guardian) => {
        try {
          const form = new URLSearchParams({ To: guardian.phone, From: twilioFrom, Body: message });
          const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          });
          if (!res.ok) {
            throw new Error(`Twilio ${res.status}: ${await res.text()}`);
          }
          sent += 1;
        } catch (err) {
          failures.push(`${guardian.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      })
    );

    if (failures.length > 0) {
      console.warn("[notify-guardians] some sends failed", failures);
    }

    return jsonResponse({ sent, total: list.length, failures });
  } catch (err) {
    console.error("[notify-guardians] error", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
