-- crash_tickets: also opened for severity-1 crashes and manual "I NEED HELP
-- NOW" SOS, not just severity 2-5. The rider app (emergencyPipeline.
-- createCrashTicket) now inserts a ticket for every rider-initiated
-- emergency so the dispatch-partners fan-out (migration 0019) reaches
-- partners in all three cases.
--
--   source='crash', severity 2-5  — detected crash, trigger + sensor fields set
--   source='crash', severity 1    — detected crash, trigger + sensor fields set
--   source='manual', severity NULL — SOS, trigger + all sensor fields NULL
--
-- Split from 0019_partner_dispatch to mirror the remote migration history
-- (applied as a separate migration: 0019b_crash_ticket_source). Ordered
-- after 0019 — nothing in 0019 depends on the source column.

alter table public.crash_tickets
  add column if not exists source text not null default 'crash'
    check (source in ('crash', 'manual'));

alter table public.crash_tickets alter column severity drop not null;

alter table public.crash_tickets drop constraint if exists crash_tickets_severity_check;
alter table public.crash_tickets
  add constraint crash_tickets_severity_check
    check (severity is null or severity between 1 and 5);
