-- Guardians table — up to 3 per rider, alerted on crash.
--
-- public.guardians already exists (0001_init.sql) with a `phone` column
-- plus a few extra fields (relationship, priority, alert_mode) the existing
-- Guardians UI already depends on. This migration renames phone ->
-- phone_number to match the schema the rest of this feature (and the
-- notify-guardians edge function) is written against, rather than dropping
-- and recreating the table. Written to also work standalone against a
-- database where guardians doesn't exist yet.

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone_number text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'guardians' and column_name = 'phone'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'guardians' and column_name = 'phone_number'
  ) then
    alter table public.guardians rename column phone to phone_number;
  end if;
end $$;

alter table public.guardians enable row level security;

drop policy if exists "guardians_select_own" on public.guardians;
create policy "guardians_select_own" on public.guardians
  for select using (auth.uid() = user_id);
drop policy if exists "guardians_insert_own" on public.guardians;
create policy "guardians_insert_own" on public.guardians
  for insert with check (auth.uid() = user_id);
drop policy if exists "guardians_update_own" on public.guardians;
create policy "guardians_update_own" on public.guardians
  for update using (auth.uid() = user_id);
drop policy if exists "guardians_delete_own" on public.guardians;
create policy "guardians_delete_own" on public.guardians
  for delete using (auth.uid() = user_id);

-- Max 3 guardians per rider. Enforced server-side (not just in the app UI)
-- via a trigger rather than a CHECK constraint — a CHECK can only see the
-- row being written, not count sibling rows, so this has to be a trigger.
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
