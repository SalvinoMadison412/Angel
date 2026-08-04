-- Fixes: every query touching public.partners or public.crash_tickets that
-- has to evaluate more than one RLS policy failed with:
--   code 42P17, "infinite recursion detected in policy for relation
--   crash_tickets"
-- This was mistaken for two separate bugs during QA (partner sign-in
-- appearing to hang forever, and crash-ticket creation silently failing on
-- the rider side) — it's one bug. Root cause: partners.partners_select_by_ticket_rider
-- subqueries crash_tickets, and crash_tickets' partner-facing policies
-- (crash_tickets_select_open_for_partners, crash_tickets_accept_for_partners)
-- subquery partners right back. Postgres has to evaluate RLS on partners
-- while evaluating RLS on crash_tickets, which re-triggers RLS on
-- crash_tickets, forever — even for a plain "select my own partner row"
-- query, because Postgres combines every applicable SELECT policy on a
-- table (not just the one that would obviously match).
--
-- Fix: move the crash_tickets lookup inside partners_select_by_ticket_rider
-- into a SECURITY DEFINER function. A SECURITY DEFINER function executes as
-- its owner and — unless it explicitly opts back in — does not re-apply RLS
-- to the tables it queries internally, so its read of crash_tickets doesn't
-- re-trigger crash_tickets' own policies. That breaks the cycle: evaluating
-- any policy on partners no longer requires evaluating RLS on crash_tickets,
-- so crash_tickets' policies (which do query partners) no longer recurse
-- either.

create or replace function public.is_ticket_rider_for_partner(partner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.crash_tickets ct
    where ct.accepted_by = partner_id and ct.rider_id = auth.uid()
  );
$$;

drop policy if exists "partners_select_by_ticket_rider" on public.partners;
create policy "partners_select_by_ticket_rider" on public.partners
  for select using (public.is_ticket_rider_for_partner(id));
