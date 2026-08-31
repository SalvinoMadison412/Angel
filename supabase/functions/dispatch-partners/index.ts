// dispatch-partners — Supabase Edge Function
//
// Fired by the crash_tickets INSERT trigger (migration 0019, via pg_net).
// Sends an Expo push notification to every eligible partner so they're
// alerted even with the app closed. The first partner to accept is assigned
// atomically by the accept_crash_ticket() RPC — this function only notifies.
//
// Auth: verify_jwt is OFF. The trigger proves itself with a shared secret
// in the x-webhook-secret header, matched against DISPATCH_WEBHOOK_SECRET.
// That secret is generated into Vault by migration 0019 and must be set as
// this function's secret with the same value:
//   supabase secrets set DISPATCH_WEBHOOK_SECRET=<value from vault.decrypted_secrets>
// Until it's set the function 401s and no pushes go out (fails safe).
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the runtime.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("DISPATCH_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Runtime env missing" }, 500);

  const body = await req.json().catch(() => null);
  const ticketId = body?.ticketId;
  if (typeof ticketId !== "string" || ticketId.length === 0) {
    return json({ error: "Missing ticketId" }, 400);
  }

  const db = createClient(supabaseUrl, serviceRoleKey);

  // Re-load the ticket by id — the request body is not trusted for anything
  // else. Bail unless it's genuinely still open.
  const { data: ticket, error: ticketErr } = await db
    .from("crash_tickets")
    .select("id, severity, source, status, rider_lat, rider_lng")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketErr) {
    console.error("[dispatch-partners] ticket load failed", ticketErr);
    return json({ error: "ticket load failed" }, 500);
  }
  if (!ticket || ticket.status !== "open") {
    return json({ skipped: `ticket ${ticketId} not open` });
  }

  // Eligible: approved + on duty (v1 — no radius filter yet). A partner
  // with no registered token just contributes nothing to the fan-out.
  const { data: rows, error: partnersErr } = await db
    .from("partners")
    .select("id, partner_push_tokens ( token )")
    .eq("is_approved", true)
    .eq("is_active", true);
  if (partnersErr) {
    console.error("[dispatch-partners] partners load failed", partnersErr);
    return json({ error: "partners load failed" }, 500);
  }

  const tokens = [
    ...new Set(
      (rows ?? [])
        .flatMap((r) => {
          const t = r.partner_push_tokens as { token: string } | { token: string }[] | null;
          return Array.isArray(t) ? t.map((x) => x.token) : t ? [t.token] : [];
        })
        .filter((t): t is string => typeof t === "string" && t.startsWith("ExponentPushToken")),
    ),
  ];

  if (tokens.length === 0) return json({ sent: 0, note: "no eligible partner tokens" });

  const area =
    ticket.rider_lat != null && ticket.rider_lng != null
      ? `${ticket.rider_lat.toFixed(3)}, ${ticket.rider_lng.toFixed(3)}`
      : "location unavailable";

  // source='manual' (SOS) and severity-1 are real requests for help and are
  // dispatched the same as any crash. A manual SOS has no severity to show
  // or (later) rank by — treat it as top priority.
  const isManual = ticket.source === "manual" || ticket.severity == null;
  const title = isManual
    ? "🆘 Rider needs help now"
    : `Crash alert — severity ${ticket.severity}`;

  const messages = tokens.map((to) => ({
    to,
    title,
    body: `${area} — tap to respond`,
    priority: "high",
    sound: "default",
    channelId: "crash-tickets",
    data: {
      ticketId: ticket.id,
      severity: ticket.severity,
      source: ticket.source,
      lat: ticket.rider_lat,
      lng: ticket.rider_lng,
    },
  }));

  let sent = 0;
  const errors: unknown[] = [];
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) errors.push({ status: res.status, payload });
      else sent += batch.length;
    } catch (err) {
      errors.push(String(err));
    }
  }

  console.log(`[dispatch-partners] ticket ${ticket.id}: ${tokens.length} token(s), ${sent} sent, ${errors.length} batch error(s)`);
  return json({ ticketId: ticket.id, tokens: tokens.length, sent, errors });
});
