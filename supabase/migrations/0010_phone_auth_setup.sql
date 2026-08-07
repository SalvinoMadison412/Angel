-- Phone auth setup — Supabase native phone provider backed by Twilio Verify.
--
-- What this migration is actually for: confirming/hardening the existing
-- profiles schema and signup trigger against the two asks below, without
-- introducing a duplicate column.
--
--   1. "profiles table has a phone_number column" — 0001_init.sql already
--      created public.profiles.phone for exactly this purpose, and it's
--      wired through the whole app (ProfileScreen, useProfile.ts). Adding a
--      second phone_number column alongside it would just create a source
--      of truth that can drift from the one the UI actually reads/writes.
--      Nothing to add here — see the guard below, which documents that
--      instead of silently doing nothing.
--
--   2. "trigger: when a new user signs up via phone, auto-create their
--      profile row with the phone number populated" — 0001_init.sql's
--      handle_new_user() trigger already does this on every auth.users
--      insert (phone signup, email signup, or OAuth), pulling new.phone
--      straight from the auth.users row Supabase itself populates during
--      phone verification. Re-declared below with `create or replace` so
--      this migration is the canonical place to look for it going forward,
--      but the body is unchanged from 0001.
--
-- Dashboard setup this migration cannot do (SQL has no access to project
-- auth settings): Authentication → Providers → Phone → Enable, provider
-- "Twilio Verify", with TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
-- TWILIO_VERIFY_SERVICE_SID. See README "Phone auth setup".

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) then
    raise exception 'public.profiles.phone is missing — expected it from 0001_init.sql. Investigate before proceeding.';
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger itself already exists (0001_init.sql) and points at this function
-- by name, so replacing the function body above is sufficient — no need to
-- drop/recreate on_auth_user_created.
