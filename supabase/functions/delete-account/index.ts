// delete-account — Supabase Edge Function
//
// Called from SettingsScreen's "Delete account" confirmation. Permanently
// deletes the authenticated caller's account and everything attached to it:
//
//   1. Remove their avatar object(s) from the `avatars` Storage bucket
//      (Storage isn't a Postgres table, so it isn't covered by the FK
//      cascade below — deleted explicitly, first, best-effort).
//   2. Delete the auth.users row via the service-role admin API.
//
// Step 2 alone is sufficient for every database row: profiles, devices,
// guardians, emergency_profiles, incidents (and incident_events via
// incidents), subscriptions, and crash_tickets all declare
// `references auth.users (id) on delete cascade` (see
// supabase/migrations/0001_init.sql, 0004_onboarding.sql,
// 0005_partners_platform.sql) — Postgres removes every one of them in the
// same transaction as the auth.users delete. This is deliberately relied on
// instead of deleting each table row-by-row from here: a single
// server-enforced cascade can't leave the account half-deleted the way a
// sequence of client-driven deletes could if one step failed partway
// through, and it can't drift from the schema — a future table added with
// the same `on delete cascade` is covered automatically.
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

const AVATAR_BUCKET = "avatars";

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

    // Same pattern as notify-guardians: authenticate from the caller's own
    // session token rather than trusting a body-supplied id — an account
    // deletion endpoint is the last place to trust client input for "who
    // am I deleting."
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
    const userId = userData.user.id;

    const db = createClient(supabaseUrl, serviceRoleKey);

    // Best-effort: an avatar that was never uploaded (list returns empty)
    // or a storage hiccup shouldn't block the account deletion that
    // actually matters. Every avatar lives under `{userId}/...` (see
    // useProfile.ts's uploadAvatar), so listing that one folder is enough —
    // no need to know the exact filename/extension.
    try {
      const { data: files, error: listError } = await db.storage.from(AVATAR_BUCKET).list(userId);
      if (listError) {
        console.warn(`[delete-account] avatar list failed for ${userId}: ${listError.message}`);
      } else if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        const { error: removeError } = await db.storage.from(AVATAR_BUCKET).remove(paths);
        if (removeError) {
          console.warn(`[delete-account] avatar removal failed for ${userId}: ${removeError.message}`);
        }
      }
    } catch (err) {
      console.warn(`[delete-account] avatar cleanup threw for ${userId}`, err);
    }

    const { error: deleteError } = await db.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    console.log(`[delete-account] deleted account ${userId}`);
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[delete-account] error", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
