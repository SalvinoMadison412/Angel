-- Twilio's WhatsApp sandbox requires every guardian to individually opt in
-- (send a join message from their own WhatsApp) before Twilio will deliver
-- anything to them — guardians added before this existed were silently
-- never actually reachable. This tracks, per guardian, whether that opt-in
-- has happened, so the app can show the rider who still needs to be
-- re-shared with and notify-guardians can skip anyone who hasn't opted in
-- yet instead of wasting a Twilio call that was always going to fail.
--
-- NOTE ON FILE NUMBERING: this is filed as 0010 per explicit instruction,
-- even though 0013-0016 already exist and are already applied to the live
-- project — there's a real gap (0010-0012 were never used) predating this
-- migration. Numeric ordering doesn't matter functionally here (this
-- project applies migrations by running each file's SQL directly, not via
-- a CLI that enforces strict sequential application — see README's
-- Supabase section), but a future reader scanning the directory by name
-- should know 0010 was written and applied after 0016, not before it.

alter table public.guardians add column if not exists is_active boolean not null default false;

-- Read access to is_active rides on the existing guardians_select_own
-- policy (RLS is row-scoped, not column-scoped, so a rider selecting their
-- own guardian row already sees this column — no new SELECT policy is
-- needed). What needs explicit locking down is WRITE access: a rider must
-- not be able to flip their own guardian's is_active to true by just
-- calling supabase.from("guardians").update({ is_active: true }) — only
-- twilio-status-webhook (running as the service role, which bypasses RLS
-- and column grants entirely) should ever set it. RLS's `for update using`
-- only scopes which ROWS a client can touch, not which COLUMNS within an
-- allowed row — column-level privilege grants are the actual mechanism for
-- that in Postgres, so: revoke the blanket UPDATE grant PostgREST/Supabase
-- gives `authenticated` by default on every table, then re-grant UPDATE on
-- exactly the columns a rider should be able to edit themselves (excludes
-- is_active). A client update statement that includes is_active now fails
-- with a permission error regardless of what the RLS policy would have
-- allowed row-wise.
revoke update on public.guardians from authenticated;
grant update (name, phone, relationship, priority, alert_mode) on public.guardians to authenticated;

-- Same reasoning applies to INSERT — without this, a rider could just
-- include `is_active: true` in the initial addGuardian() insert instead of
-- a follow-up update and self-activate that way. user_id is intentionally
-- excluded too: it's set from the authenticated session in every insert
-- this app performs (see useGuardians.ts's addGuardian), never trusted from
-- client input, and guardians_insert_own's `with check (auth.uid() =
-- user_id)` only works at all if user_id is actually being written — so it
-- stays grantable, RLS is what keeps a client from writing someone else's.
revoke insert on public.guardians from authenticated;
grant insert (user_id, name, phone, relationship, priority, alert_mode) on public.guardians to authenticated;
