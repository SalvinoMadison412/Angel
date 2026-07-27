-- Angel — initial schema, RLS, triggers, and mock responder seed data.
-- Paste this whole file into the Supabase SQL Editor (project → SQL Editor → New query) and run it once.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  phone text,
  subscription_tier int,
  subscription_expiry timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row the moment someone signs up via phone OTP.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- devices
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  calibration_offset_x numeric not null default 0,
  calibration_offset_y numeric not null default 0,
  calibration_offset_z numeric not null default 0,
  pairing_status text not null default 'unpaired'
    check (pairing_status in ('unpaired', 'pairing', 'paired')),
  created_at timestamptz not null default now()
);

alter table public.devices enable row level security;

create policy "devices_select_own" on public.devices
  for select using (auth.uid() = owner_id);
create policy "devices_insert_own" on public.devices
  for insert with check (auth.uid() = owner_id);
create policy "devices_update_own" on public.devices
  for update using (auth.uid() = owner_id);
create policy "devices_delete_own" on public.devices
  for delete using (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────
-- guardians
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  priority int not null default 1,
  alert_mode text not null default 'call'
    check (alert_mode in ('call', 'sms')),
  created_at timestamptz not null default now()
);

alter table public.guardians enable row level security;

create policy "guardians_select_own" on public.guardians
  for select using (auth.uid() = user_id);
create policy "guardians_insert_own" on public.guardians
  for insert with check (auth.uid() = user_id);
create policy "guardians_update_own" on public.guardians
  for update using (auth.uid() = user_id);
create policy "guardians_delete_own" on public.guardians
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- responders (publicly readable mock partner network)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.responders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('gig_partner', 'auto', 'car_uber')),
  platform_label text,
  rating numeric,
  vehicle_label text,
  lat double precision not null,
  lng double precision not null,
  available boolean not null default true
);

alter table public.responders enable row level security;

create policy "responders_select_all" on public.responders
  for select using (true);

-- ─────────────────────────────────────────────────────────────────────────
-- incidents
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  severity int not null check (severity between 1 and 5),
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'resolved')),
  lat double precision,
  lng double precision,
  assigned_responder_id uuid references public.responders (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.incidents enable row level security;

create policy "incidents_select_own" on public.incidents
  for select using (auth.uid() = user_id);
create policy "incidents_insert_own" on public.incidents
  for insert with check (auth.uid() = user_id);
create policy "incidents_update_own" on public.incidents
  for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- incident_events (timeline log shown on Live Incident Tracking)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  label text not null,
  occurred_at timestamptz not null default now()
);

alter table public.incident_events enable row level security;

create policy "incident_events_select_own" on public.incident_events
  for select using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_events.incident_id and i.user_id = auth.uid()
    )
  );
create policy "incident_events_insert_own" on public.incident_events
  for insert with check (
    exists (
      select 1 from public.incidents i
      where i.id = incident_events.incident_id and i.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- subscriptions
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier int not null check (tier in (3, 6, 12)),
  start_date date not null default current_date,
  end_date date not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
create policy "subscriptions_insert_own" on public.subscriptions
  for insert with check (auth.uid() = user_id);
create policy "subscriptions_update_own" on public.subscriptions
  for update using (auth.uid() = user_id);

-- Keep profiles.subscription_tier / subscription_expiry in sync whenever a
-- subscription is purchased, so the Home screen's denormalized read never
-- has to double-write from the client.
create or replace function public.sync_profile_subscription()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set subscription_tier = new.tier,
      subscription_expiry = new.end_date::timestamptz
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_subscription_upsert on public.subscriptions;
create trigger on_subscription_upsert
  after insert or update on public.subscriptions
  for each row execute function public.sync_profile_subscription();

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime — the Live Incident Tracking screen subscribes to these.
-- ─────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.incidents;
alter publication supabase_realtime add table public.incident_events;

-- ─────────────────────────────────────────────────────────────────────────
-- Seed mock responders (Bengaluru), since the partner app doesn't exist yet.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.responders (name, type, platform_label, rating, vehicle_label, lat, lng, available)
values
  ('Rakesh M.', 'gig_partner', 'Swiggy Rider', 4.9, 'KA-03 HJ 2214', 12.9721, 77.5951, true),
  ('Manjunath S.', 'gig_partner', 'Zomato Rider', 4.7, 'KA-05 BJ 8831', 12.9755, 77.6005, true),
  ('Fahad K.', 'gig_partner', 'Rapido Captain', 4.8, 'KA-01 EF 4471', 12.9690, 77.5910, true),
  ('Ganesh Auto', 'auto', 'BMTC Auto Union', 4.6, 'KA-04 AB 1123', 12.9735, 77.5985, true),
  ('Uber — Suresh N.', 'car_uber', 'Uber', 4.85, 'KA-02 CX 7790', 12.9705, 77.5940, true)
on conflict do nothing;
