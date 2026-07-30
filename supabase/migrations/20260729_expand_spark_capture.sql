-- Expanded Spark Capture
-- Adds soft-delete support and aligns the song-assets bucket with the
-- browser-side capture limits. The existing songs / versions / notes /
-- attachments model already supports multiple capture ingredients.

begin;

alter table public.songs
  add column if not exists deleted_at timestamptz;

alter table public.songs
  add column if not exists deleted_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'songs_deleted_by_fkey'
      and conrelid = 'public.songs'::regclass
  ) then
    alter table public.songs
      add constraint songs_deleted_by_fkey
      foreign key (deleted_by)
      references public.profiles(id)
      on delete set null;
  end if;
end
$$;

create index if not exists songs_owner_active_updated_idx
  on public.songs (owner_user_id, updated_at desc)
  where deleted_at is null;

create index if not exists songs_owner_trash_deleted_idx
  on public.songs (owner_user_id, deleted_at desc)
  where deleted_at is not null;

-- The UI defaults to 50 MB audio and 25 MB documents. Preserve any larger
-- bucket limit that is already configured.
update storage.buckets
set file_size_limit = greatest(coalesce(file_size_limit, 0), 52428800)
where id = 'song-assets';

-- Existing object paths follow <muse-or-unassigned>/<user>/<song>/<file>.
-- Tighten write access so authenticated users can only modify their own path.
drop policy if exists "owners can upload song assets" on storage.objects;
drop policy if exists "owners can update own song assets" on storage.objects;
drop policy if exists "owners can delete own song assets" on storage.objects;
drop policy if exists "Spark capture owners can upload song assets" on storage.objects;
drop policy if exists "Spark capture owners can update song assets" on storage.objects;
drop policy if exists "Spark capture owners can delete song assets" on storage.objects;

create policy "Spark capture owners can upload song assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'song-assets'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );

create policy "Spark capture owners can update song assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'song-assets'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'song-assets'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );

create policy "Spark capture owners can delete song assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'song-assets'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );

commit;
