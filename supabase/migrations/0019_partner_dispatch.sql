-- Partner dispatch: push-notification fan-out + atomic accept for crash
-- tickets. Shared project (Angel rider app + Angel Partners app).
--
-- Scope is deliberately partner-side only — nothing rider-owned is touched:
--   1. partner_push_tokens        new table, partner-owns-own-row RLS
--   2. accept_crash_ticket()      SECURITY DEFINER RPC, atomic assignment
--   3. crash_tickets INSERT trigger -> dispatch-partners edge function,
--      which sends the Expo push fan-out
--
-- The crash_tickets.source column + nullable severity that the fan-out
-- relies on land in the companion migration 0019b_crash_ticket_source
-- (applied right after this one — nothing here depends on that column).
--
-- (The RLS gap in the brief — a partner losing read access on accept — is
-- already covered by crash_tickets_select_accepted_by_partner from
-- migration 0008. No policy change needed here.)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Partner push tokens
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.partner_push_tokens (
  partner_id uuid primary key references public.partners (id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

alter table public.partner_push_tokens enable row level security;

-- A partner reads/writes/deletes only their own token row. All four verbs
-- resolve the caller's partner id the same way partners' own policies do.
drop policy if exists "partner_push_tokens_select_own" on public.partner_push_tokens;
create policy "partner_push_tokens_select_own" on public.partner_push_tokens
  for select using (partner_id = (select id from public.partners where user_id = auth.uid()));

drop policy if exists "partner_push_tokens_insert_own" on public.partner_push_tokens;
create policy "partner_push_tokens_insert_own" on public.partner_push_tokens
  for insert with check (partner_id = (select id from public.partners where user_id = auth.uid()));

drop policy if exists "partner_push_tokens_update_own" on public.partner_push_tokens;
create policy "partner_push_tokens_update_own" on public.partner_push_tokens
  for update using (partner_id = (select id from public.partners where user_id = auth.uid()));

drop policy if exists "partner_push_tokens_delete_own" on public.partner_push_tokens;
create policy "partner_push_tokens_delete_own" on public.partner_push_tokens
  for delete using (partner_id = (select id from public.partners where user_id = auth.uid()));

-- Same posture as 0018's quiz tables: RLS is the control, but drop the
-- default anon grant so the token list isn't one "disable rls" away from
-- being world-readable. The dispatch edge function reads it as service_role,
-- which is unaffected by grants.
revoke all on public.partner_push_tokens from anon;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Atomic accept
-- ─────────────────────────────────────────────────────────────────────────
-- 'accepted' | 'already_taken' | 'not_eligible'. The single UPDATE with the
-- `accepted_by is null and status = 'open'` predicate is the race guard —
-- two partners tapping ACCEPT at once, exactly one UPDATE matches a row.
create or replace function public.accept_crash_ticket(p_ticket_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_updated int;
begin
  select id into v_partner_id
  from public.partners
  where user_id = auth.uid() and is_approved and is_active;

  if v_partner_id is null then
    return 'not_eligible';
  end if;

  update public.crash_tickets
     set accepted_by = v_partner_id,
         accepted_at = now(),
         status = 'accepted'
   where id = p_ticket_id
     and accepted_by is null
     and status = 'open';
  get diagnostics v_updated = row_count;

  if v_updated = 1 then
    return 'accepted';
  end if;
  return 'already_taken';
end;
$$;

revoke all on function public.accept_crash_ticket(uuid) from public, anon;
grant execute on function public.accept_crash_ticket(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Dispatch fan-out trigger
-- ─────────────────────────────────────────────────────────────────────────
-- Shared secret between this trigger and the dispatch-partners edge
-- function (which runs with verify_jwt = false). Generated here into Vault;
-- the SAME value must be set as the function's DISPATCH_WEBHOOK_SECRET
-- secret — see the deploy notes. Until it is, the function 401s and no
-- pushes go out (fails safe).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'dispatch_webhook_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'dispatch_webhook_secret',
      'Shared secret: crash_tickets INSERT trigger -> dispatch-partners edge function'
    );
  end if;
end $$;

create or replace function public.dispatch_partners_on_crash_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  -- Rider app only ever inserts status='open', but don't fan out for
  -- anything else if that changes.
  if new.status <> 'open' then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'dispatch_webhook_secret';

  -- Fire-and-forget (pg_net is async): the rider's insert transaction is
  -- never blocked on the push send. The function re-loads the ticket by id
  -- with service_role and trusts nothing else in this body.
  perform net.http_post(
    url := 'https://vqkwdwbzbwjplxqpqsuj.supabase.co/functions/v1/dispatch-partners',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('ticketId', new.id),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

-- Trigger-only — never meant to be reachable as a PostgREST RPC.
revoke all on function public.dispatch_partners_on_crash_ticket() from public, anon, authenticated;

drop trigger if exists dispatch_partners_on_crash_ticket on public.crash_tickets;
create trigger dispatch_partners_on_crash_ticket
  after insert on public.crash_tickets
  for each row
  execute function public.dispatch_partners_on_crash_ticket();
