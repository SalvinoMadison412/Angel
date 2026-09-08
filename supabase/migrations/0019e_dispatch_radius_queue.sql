-- Dispatch v2: 5 km radius + top-3 queue with hand-off failover.
--
-- On a new crash the edge function now picks the 3 nearest on-duty partners
-- within 5 km and writes them to crash_tickets.dispatch_queue (nearest
-- first). Only those 3 may accept. Whoever accepts first is the responder;
-- the other two wait. If the responder taps "can't respond", the ticket is
-- handed to the next partner in the queue (release_crash_ticket), who gets a
-- push. Queue exhausted -> ticket re-opens (guardians were already alerted
-- rider-side).

alter table public.crash_tickets
  add column if not exists dispatch_queue uuid[] not null default '{}',
  add column if not exists dispatch_declined uuid[] not null default '{}';

-- ── accept: must be one of the dispatched candidates ──────────────────────
create or replace function public.accept_crash_ticket(p_ticket_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_queue uuid[];
  v_updated int;
begin
  select id into v_partner_id
  from public.partners
  where user_id = auth.uid() and is_approved and is_active;

  if v_partner_id is null then
    return 'not_eligible';
  end if;

  select dispatch_queue into v_queue from public.crash_tickets where id = p_ticket_id;

  -- Empty queue = dispatch hasn't landed yet, or a pre-v2 ticket: fall back
  -- to "any approved + active partner", same as before.
  -- ponytail: brief window between INSERT and the edge function writing the
  -- queue where anyone can accept; acceptable for v1.
  if array_length(v_queue, 1) is not null and not (v_partner_id = any (v_queue)) then
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

-- ── release: hand off to the next partner in the queue ────────────────────
-- 'reassigned' | 'reopened' | 'not_yours'
create or replace function public.release_crash_ticket(p_ticket_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  t public.crash_tickets%rowtype;
  v_next uuid;
begin
  select id into v_partner_id from public.partners where user_id = auth.uid();

  select * into t from public.crash_tickets where id = p_ticket_id;
  if t.id is null or t.accepted_by is null or t.accepted_by <> v_partner_id then
    return 'not_yours';
  end if;

  select cand into v_next
  from unnest(t.dispatch_queue) with ordinality as u(cand, ord)
  where cand <> v_partner_id
    and not (cand = any (t.dispatch_declined || v_partner_id))
  order by ord
  limit 1;

  if v_next is not null then
    update public.crash_tickets
       set accepted_by = v_next,
           accepted_at = now(),
           dispatch_declined = dispatch_declined || v_partner_id
     where id = p_ticket_id;
    return 'reassigned';
  end if;

  update public.crash_tickets
     set accepted_by = null,
         accepted_at = null,
         status = 'open',
         dispatch_declined = dispatch_declined || v_partner_id
   where id = p_ticket_id;
  return 'reopened';
end;
$$;

revoke all on function public.release_crash_ticket(uuid) from public, anon;
grant execute on function public.release_crash_ticket(uuid) to authenticated;

-- ── trigger: also fire when a ticket is handed to a different partner ─────
create or replace function public.dispatch_partners_on_crash_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_fire boolean := false;
begin
  if tg_op = 'INSERT' then
    v_fire := new.status = 'open';
  elsif tg_op = 'UPDATE' then
    -- a hand-off: someone else was responder, now it's a different partner.
    -- The first accept (old.accepted_by is null) needs no push — that app
    -- navigates itself.
    v_fire := new.status = 'accepted'
          and new.accepted_by is not null
          and old.accepted_by is not null
          and new.accepted_by is distinct from old.accepted_by;
  end if;

  if not v_fire then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'dispatch_webhook_secret';

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

revoke all on function public.dispatch_partners_on_crash_ticket() from public, anon, authenticated;

drop trigger if exists dispatch_partners_on_crash_ticket on public.crash_tickets;
create trigger dispatch_partners_on_crash_ticket
  after insert or update of accepted_by on public.crash_tickets
  for each row
  execute function public.dispatch_partners_on_crash_ticket();
