-- Angel Partners' ActiveResponseScreen needs a "Call rider" button — the
-- rider's phone lives on the existing public.profiles table (Angel app,
-- migration 0001), which currently only grants a user select access to
-- their own row. This adds one narrowly-scoped policy so a partner can read
-- (only) the profile of the rider on a ticket they've accepted — nothing
-- else about profiles changes.

drop policy if exists "profiles_select_by_accepting_partner" on public.profiles;
create policy "profiles_select_by_accepting_partner" on public.profiles
  for select using (
    exists (
      select 1
      from public.crash_tickets ct
      join public.partners p on p.id = ct.accepted_by
      where ct.rider_id = profiles.id and p.user_id = auth.uid()
    )
  );
