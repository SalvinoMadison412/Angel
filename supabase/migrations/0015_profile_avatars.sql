-- Profile photo upload: an `avatars` storage bucket plus the column on
-- `profiles` that stores each rider's public avatar URL.

alter table public.profiles add column if not exists avatar_url text;

-- Public bucket: avatars are shown in-app UI chrome, not sensitive medical
-- data (that stays in emergency_profiles, unaffected by this migration) —
-- fine to be publicly readable via URL, same tradeoff as most apps' profile
-- photos. Writes are still locked down below to the owning user only.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Every avatar is stored at `{auth.uid()}/<filename>` — policies key off
-- that first path segment so a rider can only write/replace/delete their
-- own file, never another rider's, while anyone (including logged-out
-- clients) can read any avatar by its public URL.
drop policy if exists "avatars_select_all" on storage.objects;
create policy "avatars_select_all" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
