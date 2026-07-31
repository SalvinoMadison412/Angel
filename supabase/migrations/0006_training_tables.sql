-- Angel Partners — training modules a partner must complete (and an admin
-- approve, out-of-band via the Supabase dashboard) before they can go on
-- duty. Lives in the same shared project as crash_tickets/partners
-- (migration 0005) even though only the Angel Partners app reads/writes
-- these tables.

-- ─────────────────────────────────────────────────────────────────────────
-- training_modules — reference content, same "publicly readable" shape as
-- the existing responders table (see 0001_init.sql): not sensitive, and a
-- partner needs to read these before they're approved, so scoping select to
-- "own row" style ownership doesn't apply here.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_markdown text not null,
  order_index int2 not null,
  created_at timestamptz not null default now()
);

alter table public.training_modules enable row level security;

drop policy if exists "training_modules_select_all" on public.training_modules;
create policy "training_modules_select_all" on public.training_modules
  for select using (true);

-- ─────────────────────────────────────────────────────────────────────────
-- partner_training_completions
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.partner_training_completions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  module_id uuid not null references public.training_modules (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (partner_id, module_id)
);

alter table public.partner_training_completions enable row level security;

drop policy if exists "partner_training_completions_select_own" on public.partner_training_completions;
create policy "partner_training_completions_select_own" on public.partner_training_completions
  for select using (
    exists (select 1 from public.partners p where p.id = partner_training_completions.partner_id and p.user_id = auth.uid())
  );
drop policy if exists "partner_training_completions_insert_own" on public.partner_training_completions;
create policy "partner_training_completions_insert_own" on public.partner_training_completions
  for insert with check (
    exists (select 1 from public.partners p where p.id = partner_training_completions.partner_id and p.user_id = auth.uid())
  );

-- Once every module has a completion row for a given partner, stamp
-- partners.training_completed_at — computed server-side (not trusted from
-- the client) so "training complete" can't be spoofed by writing the
-- partners row directly, and so it's correct regardless of which client
-- recorded the last completion. Guarded by "is null" so this only ever
-- fires once per partner.
create or replace function public.check_training_complete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  total_modules int;
  completed_modules int;
begin
  select count(*) into total_modules from public.training_modules;
  select count(*) into completed_modules
    from public.partner_training_completions
    where partner_id = new.partner_id;

  if total_modules > 0 and completed_modules >= total_modules then
    update public.partners
    set training_completed_at = now()
    where id = new.partner_id and training_completed_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_training_completion_insert on public.partner_training_completions;
create trigger on_training_completion_insert
  after insert on public.partner_training_completions
  for each row execute function public.check_training_complete();

-- ─────────────────────────────────────────────────────────────────────────
-- Seed 3 placeholder modules — content is lorem ipsum, titles are the real
-- deliverable per the prompt that added this. `title` is unique so re-
-- running this migration doesn't pile up duplicates.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.training_modules add constraint training_modules_title_unique unique (title);

insert into public.training_modules (title, content_markdown, order_index)
values
  (
    'Understanding crash severity levels',
    E'# Understanding crash severity levels\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Angel''s on-device sensor scores every crash 1-5 based on impact force, rotation speed, and tilt angle.\n\n## Severity 2-3\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\n## Severity 4-5\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.',
    1
  ),
  (
    'First response at a crash scene',
    E'# First response at a crash scene\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n## On arrival\n\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\n## Assessing the rider\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    2
  ),
  (
    'When to escalate to emergency services',
    E'# When to escalate to emergency services\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\n## Red flags\n\nSed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.\n\n## Making the call\n\nNemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.',
    3
  )
on conflict (title) do nothing;
