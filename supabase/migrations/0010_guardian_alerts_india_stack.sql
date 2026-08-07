-- Guardian alerts, India stack — adds crash_tickets delivery-status columns,
-- a hard cap of 3 guardians per rider, and a database trigger that fires the
-- notify-guardians edge function (MSG91 SMS + Exotel voice call) the moment
-- a crash_tickets row is inserted, i.e. the instant a severity 2-5 crash
-- countdown starts — not only once the rider fails to cancel it.
--
-- Not touched here: public.guardians already has everything this needs
-- (id, user_id, name, phone, created_at, plus relationship/priority/
-- alert_mode) from 0001_init.sql. crash_tickets already has rider_lat/
-- rider_lng captured at insert time (see CrashAlertScreen) — this migration
-- doesn't rename those to lat/lng, it just adds delivery-status columns.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ONE-TIME MANUAL STEP — required before the trigger below can actually
-- reach the edge function. Do NOT put real secret values in this file or
-- any other file that gets committed.
--
-- Run this once in the Supabase SQL Editor (not part of this migration,
-- since it embeds a secret):
--
--   select vault.create_secret(
--     '<paste the same random string you set as the CRASH_TICKET_WEBHOOK_SECRET
--       edge function secret — see supabase/functions/notify-guardians>',
--     'crash_ticket_webhook_secret'
--   );
--
-- Generate the random string yourself, e.g. `openssl rand -hex 32`, then:
--   1. `supabase secrets set CRASH_TICKET_WEBHOOK_SECRET=<value>` (or paste
--      it into Dashboard → Edge Functions → notify-guardians → Secrets)
--   2. Run the vault.create_secret call above with that same value.
-- The trigger authenticates to the edge function with this shared secret
-- instead of a user session token, since a database trigger has no rider to
-- act on behalf of.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists "pg_net";

-- ─────────────────────────────────────────────────────────────────────────
-- crash_tickets — guardian delivery status
-- ─────────────────────────────────────────────────────────────────────────
alter table public.crash_tickets
  add column if not exists guardian_sms_sent boolean not null default false,
  add column if not exists guardian_call_initiated boolean not null default false,
  add column if not exists guardian_notified_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- guardians — hard cap of 3 per rider, enforced server-side so the app's
-- UI limit (GuardiansScreen hides "+ ADD" past 3) can't be bypassed by a
-- direct API call.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_guardian_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from public.guardians where user_id = new.user_id) >= 3 then
    raise exception 'A rider may have at most 3 guardians';
  end if;
  return new;
end;
$$;

drop trigger if exists on_guardian_insert_enforce_limit on public.guardians;
create trigger on_guardian_insert_enforce_limit
  before insert on public.guardians
  for each row execute function public.enforce_guardian_limit();

-- ─────────────────────────────────────────────────────────────────────────
-- crash_tickets insert → notify-guardians (MSG91 SMS + Exotel voice call)
--
-- Fires async via pg_net (fire-and-forget — the trigger doesn't wait for
-- or fail on the HTTP response, so a slow/broken notify-guardians deploy
-- can never block a rider's crash_tickets insert). Delivery status is
-- written back onto the crash_tickets row by the edge function itself once
-- it finishes, not by this trigger.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.notify_guardians_on_crash_ticket()
returns trigger
language plpgsql
security definer set search_path = public, vault, extensions
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'crash_ticket_webhook_secret'
  limit 1;

  -- Don't hard-fail the crash_tickets insert just because the one-time
  -- Vault setup above hasn't been done yet — log and move on. A rider's
  -- crash report must never be lost over a notification plumbing gap.
  if webhook_secret is null then
    raise warning 'crash_ticket_webhook_secret not set in Vault — skipping guardian notification for ticket %', new.id;
    return new;
  end if;

  perform net.http_post(
    -- Project ref is public (it's in every client-side EXPO_PUBLIC_SUPABASE_URL),
    -- safe to hardcode; the secret is what actually gates access.
    url := 'https://vqkwdwbzbwjplxqpqsuj.supabase.co/functions/v1/notify-guardians',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object('ticket_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists on_crash_ticket_insert_notify_guardians on public.crash_tickets;
create trigger on_crash_ticket_insert_notify_guardians
  after insert on public.crash_tickets
  for each row execute function public.notify_guardians_on_crash_ticket();
