-- New-signup onboarding: collects what actually matters for an emergency
-- response (identity, blood group, medical conditions, emergency contacts,
-- bike info) without bolting sensitive medical data onto the general
-- profiles table.

-- ─────────────────────────────────────────────────────────────────────────
-- profiles — onboarding gate + resume pointer
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  -- Which step to resume on if the user exits mid-flow (1-indexed). Not
  -- inferred from field emptiness because a field can be legitimately
  -- empty either because the step hasn't been reached yet, or because the
  -- rider explicitly skipped it (blood group / contacts) — those are
  -- different states and only an explicit pointer tells them apart.
  add column if not exists onboarding_step smallint not null default 1;

-- ─────────────────────────────────────────────────────────────────────────
-- emergency_profiles — sensitive identity/medical data, own table, tight
-- RLS. Never bolted onto public.profiles.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.emergency_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  date_of_birth date,
  blood_group text check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  medical_conditions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.emergency_profiles enable row level security;

drop policy if exists "emergency_profiles_select_own" on public.emergency_profiles;
create policy "emergency_profiles_select_own" on public.emergency_profiles
  for select using (auth.uid() = user_id);
drop policy if exists "emergency_profiles_insert_own" on public.emergency_profiles;
create policy "emergency_profiles_insert_own" on public.emergency_profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "emergency_profiles_update_own" on public.emergency_profiles;
create policy "emergency_profiles_update_own" on public.emergency_profiles
  for update using (auth.uid() = user_id);
drop policy if exists "emergency_profiles_delete_own" on public.emergency_profiles;
create policy "emergency_profiles_delete_own" on public.emergency_profiles
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_emergency_profiles_update on public.emergency_profiles;
create trigger on_emergency_profiles_update
  before update on public.emergency_profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- devices — bike info, linked to the same paired-device row the
-- calibration flow already uses.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.devices
  add column if not exists bike_make text,
  add column if not exists bike_model text;
