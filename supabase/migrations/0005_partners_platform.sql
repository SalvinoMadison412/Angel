-- Angel Partners platform — a separate Expo app for trained responders.
-- Severity 2-5 crash events create a crash_tickets row that nearby, approved
-- Partners can see (while open) and accept; severity 1 stays on the existing
-- guardian-SMS-only path and never touches this table. The Angel Partners
-- app itself is built separately — this migration only adds what the shared
-- backend and the Angel app's rider-facing screens (CrashAlertScreen,
-- ActiveTicketScreen) need. Does not alter any existing table.

-- ─────────────────────────────────────────────────────────────────────────
-- partners
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  -- Admin must approve after training completes — an unapproved partner
  -- must never see or accept a live crash ticket (enforced below, not just
  -- by app-side UI).
  is_approved boolean not null default false,
  training_completed_at timestamptz,
  current_lat float8,
  current_lng float8,
  location_updated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.partners enable row level security;

drop policy if exists "partners_select_own" on public.partners;
create policy "partners_select_own" on public.partners
  for select using (auth.uid() = user_id);
drop policy if exists "partners_insert_own" on public.partners;
create policy "partners_insert_own" on public.partners
  for insert with check (auth.uid() = user_id);
drop policy if exists "partners_update_own" on public.partners;
create policy "partners_update_own" on public.partners
  for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- crash_tickets
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.crash_tickets (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references auth.users (id) on delete cascade,
  -- Severity 1 never reaches this table — it stays on the lighter
  -- guardian-SMS-only path (EmergencyCountdownScreen), unchanged.
  severity int2 not null check (severity between 2 and 5),
  trigger text check (trigger in ('impact', 'tilt')),
  impact_g float4,
  gyro_dps float4,
  tilt_deg float4,
  rider_lat float8,
  rider_lng float8,
  status text not null default 'open'
    check (status in ('open', 'accepted', 'closed', 'escalated')),
  accepted_by uuid references public.partners (id) on delete set null,
  accepted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.crash_tickets enable row level security;

-- Riders manage their own tickets — created the moment a severity 2-5
-- countdown starts (CrashAlertScreen), closed if they cancel or mark
-- themselves safe from ActiveTicketScreen. Not in the original policy list
-- but required for both of those to work at all: without an update policy,
-- a rider closing their own ticket would just fail RLS.
drop policy if exists "crash_tickets_select_own_rider" on public.crash_tickets;
create policy "crash_tickets_select_own_rider" on public.crash_tickets
  for select using (auth.uid() = rider_id);
drop policy if exists "crash_tickets_insert_own_rider" on public.crash_tickets;
create policy "crash_tickets_insert_own_rider" on public.crash_tickets
  for insert with check (auth.uid() = rider_id);
drop policy if exists "crash_tickets_update_own_rider" on public.crash_tickets;
create policy "crash_tickets_update_own_rider" on public.crash_tickets
  for update using (auth.uid() = rider_id);

-- Partners see open tickets and can accept one — scoped to approved, active
-- partners only, not just any authenticated user (the plain "accepted_by is
-- null" condition on its own would let anyone claim a ticket). The with
-- check stops a partner from assigning a ticket to someone else's partner
-- id. Postgres RLS ORs every applicable policy's USING/WITH CHECK together,
-- so this composes with crash_tickets_update_own_rider above rather than
-- overriding it — a rider closing their own ticket still passes via that
-- policy regardless of this one.
drop policy if exists "crash_tickets_select_open_for_partners" on public.crash_tickets;
create policy "crash_tickets_select_open_for_partners" on public.crash_tickets
  for select using (
    status = 'open'
    and exists (
      select 1 from public.partners p
      where p.user_id = auth.uid() and p.is_active and p.is_approved
    )
  );
drop policy if exists "crash_tickets_accept_for_partners" on public.crash_tickets;
create policy "crash_tickets_accept_for_partners" on public.crash_tickets
  for update using (
    accepted_by is null
    and exists (
      select 1 from public.partners p
      where p.user_id = auth.uid() and p.is_active and p.is_approved
    )
  )
  with check (
    accepted_by = (select id from public.partners where user_id = auth.uid())
  );

-- Riders need to read the partner assigned to their own ticket (name,
-- phone, live location) once one accepts — ActiveTicketScreen's "Call
-- partner" and map pin depend on this. Not in the original policy list but
-- required for deliverable 3 to actually work: partners_select_own alone
-- only lets a partner read their own row, not the rider they're helping.
drop policy if exists "partners_select_by_ticket_rider" on public.partners;
create policy "partners_select_by_ticket_rider" on public.partners
  for select using (
    exists (
      select 1 from public.crash_tickets ct
      where ct.accepted_by = partners.id and ct.rider_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime — ActiveTicketScreen subscribes to its own ticket row so it
-- updates the moment a partner accepts, no refresh needed.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crash_tickets'
  ) then
    alter publication supabase_realtime add table public.crash_tickets;
  end if;
end $$;
