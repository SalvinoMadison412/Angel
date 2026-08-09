-- Security hardening pass ahead of Play Store release.
--
-- Supabase's advisor flags every SECURITY DEFINER function in `public` as
-- directly callable via PostgREST RPC by `anon`/`authenticated`
-- (`/rest/v1/rpc/<name>`), since Postgres grants EXECUTE on new functions
-- to the PUBLIC pseudo-role by default — every real role (including anon
-- and authenticated) inherits whatever PUBLIC can do, so revoking from
-- anon/authenticated directly, without also revoking from PUBLIC, is a
-- no-op (confirmed empirically: has_function_privilege() still returned
-- true after an anon/authenticated-only revoke). The fix has to target
-- PUBLIC itself.
--
-- Two different situations here:
--
-- 1. Trigger functions (`check_training_complete`, `enforce_guardian_limit`,
--    `handle_new_partner_signup`, `handle_new_user`, `set_updated_at`,
--    `sync_profile_subscription`) all `returns trigger` — Postgres itself
--    refuses to invoke a trigger-typed function directly ("trigger
--    functions can only be called as triggers"), so despite the advisor
--    warning these were never actually callable as an RPC exploit, and
--    revoking EXECUTE doesn't affect the trigger mechanism itself (trigger
--    firing isn't gated by the invoking client's EXECUTE privilege). This
--    revoke is defense-in-depth and silences the advisor, not a fix for a
--    real hole.
--
-- 2. `is_ticket_rider_for_partner(partner_id uuid)` (added in migration
--    0009 to break RLS recursion) is a real, directly-callable function. It
--    only ever answers "does *my own* auth.uid() have an accepted ticket
--    with this partner_id" — no cross-user data exposure — but it's
--    genuinely pointless for a logged-out (anon) caller, since auth.uid()
--    is null for them and the query is always false. Revoked from PUBLIC
--    and re-granted to `authenticated` only, which is what
--    partners_select_by_ticket_rider's RLS policy actually needs.
revoke execute on function public.check_training_complete() from public;
revoke execute on function public.enforce_guardian_limit() from public;
revoke execute on function public.handle_new_partner_signup() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.sync_profile_subscription() from public;
revoke execute on function public.is_ticket_rider_for_partner(uuid) from public;
grant execute on function public.is_ticket_rider_for_partner(uuid) to authenticated;
