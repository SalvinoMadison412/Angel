-- crash_tickets — guardian alert delivery status.
--
-- Not adding lat/lng columns here: 0005_partners_platform.sql already added
-- rider_lat/rider_lng (float8) to crash_tickets, populated at insert time by
-- CrashAlertScreen, and the Angel Partners app (separate repo, same
-- Supabase project) reads those same column names to plot the rider's
-- location for responders. Adding a second lat/lng pair would just create
-- two sources of truth for the same value with no way to keep them in sync,
-- and would silently break nothing today but invite drift later. The
-- notify-guardians edge function reads rider_lat/rider_lng directly.

alter table public.crash_tickets
  add column if not exists sms_status text
    check (sms_status in ('sent', 'failed', 'skipped')),
  add column if not exists call_status text
    check (call_status in ('initiated', 'failed', 'skipped')),
  add column if not exists alerted_at timestamptz;
