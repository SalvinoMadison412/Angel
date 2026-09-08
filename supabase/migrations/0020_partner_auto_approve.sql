-- Partner onboarding removed: signing in (phone OTP / Google) is now enough
-- to respond to crashes. The training → quiz → rep-call → 24h approval funnel
-- from 0018 is disabled on the client, and this migration makes the server
-- agree — otherwise a brand-new partner would sit at is_approved = false and
-- accept_crash_ticket() / dispatch-partners would still refuse them.
--
-- Three parts:
--   1. handle_new_partner_signup() now stamps is_approved = true
--      (email/password signup path — kept as a fallback).
--   2. ensure_partner() — an RPC the partner app calls right after any
--      sign-in. signInWithOAuth() can't pass user metadata, so a Google
--      sign-in never trips the 'app = angel-partners' trigger and no
--      partners row gets created. This function creates one on demand for
--      auth.uid(), pulling name/phone from the auth.users record.
--   3. backfill every existing unapproved partner.

-- ── 1. signup trigger auto-approves ──────────────────────────────────────
create or replace function public.handle_new_partner_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'app' = 'angel-partners' then
    insert into public.partners (user_id, full_name, phone, is_active, is_approved)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.raw_user_meta_data->>'phone',
      false,
      true
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- ── 2. ensure_partner(): idempotent partner-row creation for the caller ──
create or replace function public.ensure_partner()
returns public.partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
  v_partner public.partners%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_partner from public.partners where user_id = auth.uid();
  if v_partner.id is not null then
    return v_partner;
  end if;

  select * into v_user from auth.users where id = auth.uid();

  insert into public.partners (user_id, full_name, phone, is_active, is_approved)
  values (
    auth.uid(),
    coalesce(
      v_user.raw_user_meta_data->>'full_name',
      v_user.raw_user_meta_data->>'name',
      ''
    ),
    coalesce(v_user.phone, v_user.raw_user_meta_data->>'phone'),
    false,
    true
  )
  on conflict (user_id) do nothing;

  select * into v_partner from public.partners where user_id = auth.uid();
  return v_partner;
end;
$$;

revoke all on function public.ensure_partner() from public, anon;
grant execute on function public.ensure_partner() to authenticated;

-- ── 3. backfill existing partners ───────────────────────────────────────
update public.partners set is_approved = true where not is_approved;
