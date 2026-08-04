-- Fixes: partner sign-up unconditionally failed RLS ("new row violates
-- row-level security policy for table partners") because the client
-- inserted the partners row itself, immediately after auth.signUp() —
-- racing whatever delay exists before the new session's JWT is usable
-- for authenticated requests (and unusable at all if email confirmation
-- is required). Moving the insert into a trigger on auth.users removes
-- the race entirely: it runs server-side, in the same transaction as
-- account creation, as the table owner (bypasses RLS), independent of
-- the client's session state.
--
-- auth.users is shared with the Angel rider app (same Supabase project),
-- which never calls auth.signUp() (riders use phone OTP / Google OAuth),
-- but an OTP/OAuth sign-in can also insert a new auth.users row. The
-- trigger must not create a partners row for a rider account, so it only
-- fires when the signup call tagged itself via user metadata.

alter table public.partners
  add constraint partners_user_id_key unique (user_id);

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
      false
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_partner on auth.users;
create trigger on_auth_user_created_partner
  after insert on auth.users
  for each row
  execute function public.handle_new_partner_signup();
