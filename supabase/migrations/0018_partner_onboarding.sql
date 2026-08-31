-- Angel Partners — full driver onboarding flow.
--
-- Before 0018 the flow was: read 3 markdown modules -> wait for an admin to
-- flip is_approved by hand. This migration turns that into the real
-- four-stage funnel the product asks for:
--
--   1. courses  — watch 3 training videos          (partners.training_completed_at)
--   2. quiz     — pass the multiple-choice test    (partners.quiz_passed_at)
--   3. call     — a rep phones the partner         (partners.call_completed_at)
--   4. approval — within 24h of that call          (partners.is_approved)
--
-- Every one of those four columns is stamped server-side and is NOT
-- client-writable (see the column-privilege lockdown at the bottom) —
-- otherwise a partner could simply UPDATE their own row past the whole
-- funnel, which the pre-existing partners_update_own policy allowed.

-- ─────────────────────────────────────────────────────────────────────────
-- Stage 1 — courses are now videos.
--
-- content_markdown stays and stays NOT NULL: it's the text shown under the
-- player (transcript / summary), and the three modules seeded by 0006
-- already have it. video_url is nullable so a module with no video yet
-- still renders as the plain markdown reader it is today — the app decides
-- which UI to show by whether this is null.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.training_modules add column if not exists video_url text;

-- ─────────────────────────────────────────────────────────────────────────
-- Stages 2-3 on the partners row.
--
-- call_completed_at is set by a rep/admin out-of-band (Supabase dashboard),
-- the same way is_approved already is. It exists so the app can tell "we
-- haven't called you yet" apart from "we called you, you're in the 24h
-- window" — two different waiting screens with different copy.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.partners add column if not exists quiz_passed_at timestamptz;
alter table public.partners add column if not exists call_completed_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- quiz_questions
--
-- Deliberately has NO select policy: RLS is on and nothing grants
-- `authenticated` a read, so a partner cannot pull correct_index down to
-- the device and grade themselves. Questions reach the client only through
-- get_quiz_questions() below, which omits the answer key, and grading only
-- happens inside submit_quiz(). Table owner (postgres) bypasses RLS, which
-- is how both security-definer functions still see the rows.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null unique,
  choices text[] not null check (array_length(choices, 1) between 2 and 6),
  correct_index int2 not null,
  order_index int2 not null,
  created_at timestamptz not null default now(),
  -- correct_index is a 0-based index into choices; a seed typo that puts it
  -- out of range would silently make a question unanswerable.
  constraint quiz_questions_correct_index_in_range
    check (correct_index >= 0 and correct_index < array_length(choices, 1))
);

alter table public.quiz_questions enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- partner_quiz_attempts — one row per submission, kept for audit and so the
-- app can show "you scored 3/5, try again". Insert goes through
-- submit_quiz() only; the client has no insert policy of its own.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.partner_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  score int2 not null,
  total int2 not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists partner_quiz_attempts_partner_idx
  on public.partner_quiz_attempts (partner_id, created_at desc);

alter table public.partner_quiz_attempts enable row level security;

drop policy if exists "partner_quiz_attempts_select_own" on public.partner_quiz_attempts;
create policy "partner_quiz_attempts_select_own" on public.partner_quiz_attempts
  for select using (
    exists (select 1 from public.partners p where p.id = partner_quiz_attempts.partner_id and p.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- get_quiz_questions() — the answer key never leaves the server.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.get_quiz_questions()
returns table (id uuid, question text, choices text[], order_index int2)
language sql
security definer set search_path = public
stable
as $$
  select q.id, q.question, q.choices, q.order_index
  from public.quiz_questions q
  order by q.order_index;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- submit_quiz(p_answers) — grades, records the attempt, and on a pass
-- stamps partners.quiz_passed_at.
--
-- p_answers is {"<question_id>": <choice_index>, ...}. A question the
-- partner left out is simply wrong (the -> lookup is null, and null = x is
-- never true), so a partial submission can't accidentally score as a pass.
--
-- Returns the graded result rather than making the client re-query, and
-- deliberately does NOT return which questions were missed — that would
-- leak the answer key one wrong submission at a time.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.submit_quiz(p_answers jsonb)
returns table (score int2, total int2, passed boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_partner public.partners%rowtype;
  v_score int2;
  v_total int2;
  v_passed boolean;
begin
  select * into v_partner from public.partners where user_id = auth.uid();
  if not found then
    raise exception 'No partner row for the current user';
  end if;

  -- The quiz is stage 2: the courses gate it. Without this check a partner
  -- could skip straight past the videos by calling this RPC directly.
  if v_partner.training_completed_at is null then
    raise exception 'Finish all training courses before taking the quiz';
  end if;

  select count(*)::int2 into v_total from public.quiz_questions;
  if v_total = 0 then
    raise exception 'No quiz questions are configured';
  end if;

  select count(*)::int2 into v_score
  from public.quiz_questions q
  where (p_answers ->> q.id::text)::int = q.correct_index;

  -- 80% to pass, rounded against the actual question count so the bar
  -- doesn't silently move when questions are added.
  v_passed := v_score::numeric / v_total >= 0.8;

  insert into public.partner_quiz_attempts (partner_id, score, total, passed)
  values (v_partner.id, v_score, v_total, v_passed);

  -- Guarded by "is null" so a retake after passing can't push the timestamp
  -- forward (and so retakes stay harmless in general).
  if v_passed and v_partner.quiz_passed_at is null then
    update public.partners set quiz_passed_at = now() where id = v_partner.id;
  end if;

  return query select v_score, v_total, v_passed;
end;
$$;

revoke all on function public.get_quiz_questions() from public, anon;
revoke all on function public.submit_quiz(jsonb) from public, anon;
grant execute on function public.get_quiz_questions() to authenticated;
grant execute on function public.submit_quiz(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Lock down which partners columns a partner may write.
--
-- 0005's partners_update_own policy is row-scoped only ("this is my row"),
-- so until now a partner could UPDATE their own is_approved to true and
-- walk straight into the live-ticket app without training, a quiz, or a
-- call. RLS has no column granularity, but Postgres column privileges do —
-- so keep the policy as the row filter and let the grant be the column
-- filter. Anything not listed (is_approved, training_completed_at,
-- quiz_passed_at, call_completed_at, id, user_id, created_at) is now
-- writable only by the security-definer functions and triggers that own
-- each stage, and by service_role from the dashboard.
--
-- The listed columns are exactly what the app writes as the signed-in user:
-- is_active (the on/off-duty toggle) and the three location columns (the
-- background location task). See usePartner.ts.
-- ─────────────────────────────────────────────────────────────────────────
revoke update on public.partners from authenticated;
grant update (full_name, phone, is_active, current_lat, current_lng, location_updated_at)
  on public.partners to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Seed 5 placeholder questions so the flow is testable end-to-end before
-- the real course content lands — same approach as 0006's lorem-ipsum
-- modules. `question` is unique so re-running this is a no-op.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.quiz_questions (question, choices, correct_index, order_index)
values
  (
    'A crash is scored severity 5. What does that indicate?',
    array['A false positive from a dropped phone', 'A minor slow-speed tip-over', 'A high-force impact needing immediate response', 'The rider has already confirmed they are safe'],
    2, 1
  ),
  (
    'You arrive at a scene and the rider is unconscious. What is your first action?',
    array['Move them off the road immediately', 'Escalate to emergency services', 'Close the ticket and leave', 'Wait for another partner to arrive'],
    1, 2
  ),
  (
    'When should you escalate a ticket to emergency services?',
    array['Only if the rider asks you to', 'Never — that is the rider''s responsibility', 'Any time there are red-flag injuries or you are unsure', 'Only for severity 5 crashes'],
    2, 3
  ),
  (
    'What does accepting a crash ticket commit you to?',
    array['Travelling to the scene and responding', 'Calling the rider only', 'Nothing — it just hides the alert', 'Paying for the rider''s medical costs'],
    0, 4
  ),
  (
    'Your live location is shared with the rider while you are responding. When does that stop?',
    array['It never stops once you are registered', 'When you go off duty or the ticket closes', 'Only when you uninstall the app', 'After 24 hours'],
    1, 5
  )
on conflict (question) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- Supabase's default "grant all on all tables to anon, authenticated" applies
-- to the two new tables as well. RLS already covers both (quiz_questions has
-- no select policy at all; attempts are select-own), but a table grant left
-- in place means the answer key is one accidental `disable row level
-- security` away from being readable. Revoke it so the key is protected by
-- two independent mechanisms rather than one.
--
-- The security-definer functions above are unaffected — they run as the
-- table owner, not as the caller.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.quiz_questions from anon, authenticated;
revoke insert, update, delete on public.partner_quiz_attempts from anon, authenticated;
