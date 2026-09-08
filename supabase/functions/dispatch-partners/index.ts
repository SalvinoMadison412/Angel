// dispatch-partners — Supabase Edge Function
//
// Fired by the crash_tickets trigger (migration 0019 + 0019e, via pg_net):
//   - INSERT of an open ticket  -> pick the 3 nearest on-duty partners within
//     RADIUS_KM, write them to crash_tickets.dispatch_queue (nearest first),
//     and push all 3.
//   - UPDATE handing the ticket to a different partner (release_crash_ticket)
//     -> push just the new responder.
// The atomic accept_crash_ticket() RPC assigns whoever taps accept first,
// and only lets one of the queued 3 do so.
//
// Auth: verify_jwt OFF; the trigger sends the shared secret in
// x-webhook-secret, matched against DISPATCH_WEBHOOK_SECRET.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the runtime.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const RADIUS_KM = 5;
const FANOUT = 3;
const LOCATION_FRESH_MS = 10 * 60 * 1000; // ignore partners whose location is older than this

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function pushTokens(rel: unknown): string[] {
  const t = rel as { token: string } | { token: string }[] | null;
  const arr = Array.isArray(t) ? t.map((x) => x.token) : t ? [t.token] : [];
  return arr.filter((x): x is string => typeof x === "string" && x.startsWith("ExponentPushToken"));
}

async function sendExpo(messages: unknown[]): Promise<{ sent: number; errors: unknown[] }> {
  let sent = 0;
  const errors: unknown[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
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
  return { sent, errors };
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

  const { data: ticket, error: ticketErr } = await db
    .from("crash_tickets")
    .select("id, severity, source, status, rider_lat, rider_lng, accepted_by")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketErr) {
    console.error("[dispatch-partners] ticket load failed", ticketErr);
    return json({ error: "ticket load failed" }, 500);
  }
  if (!ticket) return json({ skipped: `ticket ${ticketId} gone` });

  const isManual = ticket.source === "manual" || ticket.severity == null;
  const area =
    ticket.rider_lat != null && ticket.rider_lng != null
      ? `${ticket.rider_lat.toFixed(3)}, ${ticket.rider_lng.toFixed(3)}`
      : "location unavailable";
  const data = {
    ticketId: ticket.id,
    severity: ticket.severity,
    source: ticket.source,
    lat: ticket.rider_lat,
    lng: ticket.rider_lng,
  };

  // ── Hand-off: notify just the new responder ────────────────────────────
  if (ticket.status === "accepted" && ticket.accepted_by) {
    const { data: tok } = await db
      .from("partner_push_tokens")
      .select("token")
      .eq("partner_id", ticket.accepted_by)
      .maybeSingle();
    const tokens = pushTokens(tok);
    if (tokens.length === 0) return json({ reassignedTo: ticket.accepted_by, sent: 0, note: "no token" });
    const { sent, errors } = await sendExpo(
      tokens.map((to) => ({
        to,
        title: "You're now the responder",
        body: `${area} — a partner passed this crash to you. Tap to respond.`,
        priority: "high",
        sound: "default",
        channelId: "crash-tickets",
        data: { ...data, assigned: true },
      })),
    );
    return json({ reassignedTo: ticket.accepted_by, sent, errors });
  }

  // ── Initial dispatch: 3 nearest on-duty partners within RADIUS_KM ──────
  if (ticket.status !== "open") return json({ skipped: `ticket ${ticketId} ${ticket.status}` });

  const { data: rows, error: partnersErr } = await db
    .from("partners")
    .select("id, current_lat, current_lng, location_updated_at, partner_push_tokens ( token )")
    .eq("is_approved", true)
    .eq("is_active", true);
  if (partnersErr) {
    console.error("[dispatch-partners] partners load failed", partnersErr);
    return json({ error: "partners load failed" }, 500);
  }

  const fresh = (rows ?? []).filter(
    (p) =>
      p.current_lat != null &&
      p.current_lng != null &&
      p.location_updated_at != null &&
      Date.now() - Date.parse(p.location_updated_at) < LOCATION_FRESH_MS,
  );

  let ranked = fresh.map((p) => ({ p, km: 0 }));
  if (ticket.rider_lat != null && ticket.rider_lng != null) {
    ranked = fresh
      .map((p) => ({ p, km: haversineKm(ticket.rider_lat!, ticket.rider_lng!, p.current_lat!, p.current_lng!) }))
      .filter((x) => x.km <= RADIUS_KM)
      .sort((a, b) => a.km - b.km);
  }
  // ponytail: no rider coords -> can't do radius, dispatch to whoever's fresh
  // and on duty (rare: manual SOS still carries lat). Radius-widen / ops
  // escalation when nobody is within RADIUS_KM is not built — the ticket
  // stays open and guardians were already alerted rider-side.

  const top = ranked.slice(0, FANOUT);
  const queue = top.map((x) => x.p.id);

  await db.from("crash_tickets").update({ dispatch_queue: queue }).eq("id", ticket.id);

  const tokens = [...new Set(top.flatMap((x) => pushTokens(x.p.partner_push_tokens)))];
  if (tokens.length === 0) {
    return json({ candidates: queue.length, sent: 0, note: "no candidate tokens" });
  }

  const title = isManual ? "🆘 Rider needs help now" : `Crash alert — severity ${ticket.severity}`;
  const { sent, errors } = await sendExpo(
    tokens.map((to) => ({
      to,
      title,
      body: `${area} — tap to respond`,
      priority: "high",
      sound: "default",
      channelId: "crash-tickets",
      data,
    })),
  );

  console.log(
    `[dispatch-partners] ticket ${ticket.id}: ${ranked.length} in radius, queued ${queue.length}, ${sent} pushed`,
  );
  return json({ ticketId: ticket.id, inRadius: ranked.length, queued: queue.length, sent, errors });
});
