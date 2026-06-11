-- iDreamMusic lifecycle schema
-- Spark -> Draft -> Final with notes, blog approval, comments, reactions, and attachments.

create extension if not exists pgcrypto;

create type app_role as enum ('owner', 'manager', 'writer', 'listener');
create type song_stage as enum ('spark', 'draft', 'final');
create type content_visibility as enum ('private', 'public');
create type song_status as enum ('private', 'shared', 'published', 'archived');
create type blog_post_type as enum ('song_journal', 'dream_log', 'release_story', 'general_blog');
create type approval_status as enum ('pending', 'approved', 'rejected');
create type comment_entity_type as enum ('song', 'song_version', 'blog_post');
create type reaction_type as enum ('like', 'favorite', 'moved_me', 'want_more');
create type attachment_type as enum ('audio', 'image', 'pdf', 'doc', 'video');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  slug text unique,
  bio text,
  avatar_url text,
  role app_role not null default 'listener',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.muses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.currents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  title_working text not null,
  title_final text,
  slug text not null unique,
  current_stage song_stage not null default 'spark',
  status song_status not null default 'private',
  muse_id uuid references public.muses(id) on delete set null,
  summary text,
  hook_line text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.song_currents (
  song_id uuid not null references public.songs(id) on delete cascade,
  current_id uuid not null references public.currents(id) on delete cascade,
  primary key (song_id, current_id)
);

create table if not exists public.song_stages (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  stage song_stage not null,
  entered_at timestamptz not null default now(),
  completed_at timestamptz,
  is_current boolean not null default false,
  notes text,
  unique (song_id, stage, entered_at)
);

create table if not exists public.song_versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  version_number integer not null,
  stage song_stage not null,
  title text,
  lyrics text,
  chord_chart text,
  melody_notes text,
  arrangement_notes text,
  story_behind_song text,
  visibility content_visibility not null default 'private',
  is_stage_primary boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (song_id, version_number)
);

create table if not exists public.writer_notes (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  song_version_id uuid references public.song_versions(id) on delete set null,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  body text not null,
  visibility content_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  song_id uuid references public.songs(id) on delete set null,
  song_version_id uuid references public.song_versions(id) on delete set null,
  title text not null,
  slug text not null unique,
  excerpt text,
  body text not null,
  post_type blog_post_type not null default 'song_journal',
  approval_status approval_status not null default 'pending',
  approval_note text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type comment_entity_type not null,
  entity_id uuid not null,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body text not null,
  is_hidden boolean not null default false,
  is_flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type comment_entity_type not null,
  entity_id uuid not null,
  reaction reaction_type not null,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id, reaction)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  song_version_id uuid references public.song_versions(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  file_type attachment_type not null,
  bucket text not null default 'song-assets',
  storage_path text not null,
  mime_type text,
  title text,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'listener'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger set_songs_updated_at
before update on public.songs
for each row execute procedure public.set_updated_at();

create trigger set_writer_notes_updated_at
before update on public.writer_notes
for each row execute procedure public.set_updated_at();

create trigger set_blog_posts_updated_at
before update on public.blog_posts
for each row execute procedure public.set_updated_at();

create trigger set_comments_updated_at
before update on public.comments
for each row execute procedure public.set_updated_at();

create or replace function public.is_owner_or_manager()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('owner', 'manager')
  );
$$;

create or replace function public.owns_song(target_song_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.songs
    where id = target_song_id
      and owner_user_id = auth.uid()
  );
$$;

create or replace function public.song_is_public(target_song_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.songs
    where id = target_song_id
      and status = 'published'
  );
$$;

alter table public.profiles enable row level security;
alter table public.muses enable row level security;
alter table public.currents enable row level security;
alter table public.songs enable row level security;
alter table public.song_currents enable row level security;
alter table public.song_stages enable row level security;
alter table public.song_versions enable row level security;
alter table public.writer_notes enable row level security;
alter table public.blog_posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.attachments enable row level security;

create policy "profiles readable by authenticated users"
on public.profiles for select
using (auth.uid() is not null);

create policy "users can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "muses are public"
on public.muses for select
using (true);

create policy "currents are public"
on public.currents for select
using (true);

create policy "owners and managers can manage taxonomy"
on public.muses for all
using (public.is_owner_or_manager())
with check (public.is_owner_or_manager());

create policy "owners and managers can manage currents"
on public.currents for all
using (public.is_owner_or_manager())
with check (public.is_owner_or_manager());

create policy "owners can view own songs and public songs"
on public.songs for select
using (owner_user_id = auth.uid() or status = 'published' or public.is_owner_or_manager());

create policy "writers can insert own songs"
on public.songs for insert
with check (owner_user_id = auth.uid() or public.is_owner_or_manager());

create policy "owners/managers can update songs"
on public.songs for update
using (owner_user_id = auth.uid() or public.is_owner_or_manager())
with check (owner_user_id = auth.uid() or public.is_owner_or_manager());

create policy "owners/managers can delete songs"
on public.songs for delete
using (owner_user_id = auth.uid() or public.is_owner_or_manager());

create policy "song currents visible with visible song"
on public.song_currents for select
using (public.song_is_public(song_id) or public.owns_song(song_id) or public.is_owner_or_manager());

create policy "owners/managers can manage song currents"
on public.song_currents for all
using (public.owns_song(song_id) or public.is_owner_or_manager())
with check (public.owns_song(song_id) or public.is_owner_or_manager());

create policy "song stages visible with visible song"
on public.song_stages for select
using (public.song_is_public(song_id) or public.owns_song(song_id) or public.is_owner_or_manager());

create policy "owners/managers can manage song stages"
on public.song_stages for all
using (public.owns_song(song_id) or public.is_owner_or_manager())
with check (public.owns_song(song_id) or public.is_owner_or_manager());

create policy "versions visible when public or owned"
on public.song_versions for select
using (
  public.owns_song(song_id)
  or public.is_owner_or_manager()
  or (visibility = 'public' and public.song_is_public(song_id))
);

create policy "owners/managers can manage versions"
on public.song_versions for all
using (public.owns_song(song_id) or public.is_owner_or_manager())
with check (public.owns_song(song_id) or public.is_owner_or_manager());

create policy "notes visible if public or owner"
on public.writer_notes for select
using (
  author_user_id = auth.uid()
  or public.is_owner_or_manager()
  or (visibility = 'public' and public.song_is_public(song_id))
);

create policy "authors can insert notes"
on public.writer_notes for insert
with check (author_user_id = auth.uid() and (public.owns_song(song_id) or public.is_owner_or_manager()));

create policy "authors can update own notes"
on public.writer_notes for update
using (author_user_id = auth.uid() or public.is_owner_or_manager())
with check (author_user_id = auth.uid() or public.is_owner_or_manager());

create policy "authors can delete own notes"
on public.writer_notes for delete
using (author_user_id = auth.uid() or public.is_owner_or_manager());

create policy "approved blogs are public; authors/managers can view their own queue"
on public.blog_posts for select
using (
  approval_status = 'approved'
  or author_user_id = auth.uid()
  or public.is_owner_or_manager()
);

create policy "authors can draft blog posts"
on public.blog_posts for insert
with check (author_user_id = auth.uid() or public.is_owner_or_manager());

create policy "authors can edit pending/rejected, managers can edit all"
on public.blog_posts for update
using (author_user_id = auth.uid() or public.is_owner_or_manager())
with check (
  public.is_owner_or_manager()
  or (
    author_user_id = auth.uid()
    and approval_status in ('pending', 'rejected')
  )
);

create policy "managers can delete any blog; authors can delete own unapproved blog"
on public.blog_posts for delete
using (
  public.is_owner_or_manager()
  or (author_user_id = auth.uid() and approval_status <> 'approved')
);

create policy "public can read visible comments on public content"
on public.comments for select
using (
  not is_hidden
  and (
    (entity_type = 'song' and public.song_is_public(entity_id))
    or (entity_type = 'song_version' and exists (
      select 1 from public.song_versions v
      where v.id = entity_id
        and v.visibility = 'public'
        and public.song_is_public(v.song_id)
    ))
    or (entity_type = 'blog_post' and exists (
      select 1 from public.blog_posts b
      where b.id = entity_id
        and b.approval_status = 'approved'
    ))
    or author_user_id = auth.uid()
    or public.is_owner_or_manager()
  )
);

create policy "authenticated users can comment on public content"
on public.comments for insert
with check (
  auth.uid() is not null
  and author_user_id = auth.uid()
  and (
    (entity_type = 'song' and public.song_is_public(entity_id))
    or (entity_type = 'song_version' and exists (
      select 1 from public.song_versions v
      where v.id = entity_id
        and v.visibility = 'public'
        and public.song_is_public(v.song_id)
    ))
    or (entity_type = 'blog_post' and exists (
      select 1 from public.blog_posts b
      where b.id = entity_id
        and b.approval_status = 'approved'
    ))
  )
);

create policy "authors can update own comments; managers moderate all"
on public.comments for update
using (author_user_id = auth.uid() or public.is_owner_or_manager())
with check (author_user_id = auth.uid() or public.is_owner_or_manager());

create policy "authors can delete own comments; managers moderate all"
on public.comments for delete
using (author_user_id = auth.uid() or public.is_owner_or_manager());

create policy "public can read reactions on public content"
on public.reactions for select
using (true);

create policy "authenticated users can react once per type"
on public.reactions for insert
with check (auth.uid() is not null and user_id = auth.uid());

create policy "users can delete own reactions"
on public.reactions for delete
using (user_id = auth.uid() or public.is_owner_or_manager());

create policy "attachments visible with public songs or to owners"
on public.attachments for select
using (public.song_is_public(song_id) or public.owns_song(song_id) or public.is_owner_or_manager());

create policy "owners/managers can manage attachments"
on public.attachments for all
using (uploaded_by = auth.uid() or public.is_owner_or_manager())
with check (uploaded_by = auth.uid() or public.is_owner_or_manager());

create view public.public_song_cards
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  coalesce(s.title_final, s.title_working) as title,
  s.current_stage,
  s.summary,
  s.hook_line,
  m.slug as muse_slug,
  coalesce(array_agg(distinct c.slug) filter (where c.slug is not null), '{}') as current_labels,
  s.updated_at
from public.songs s
left join public.muses m on m.id = s.muse_id
left join public.song_currents sc on sc.song_id = s.id
left join public.currents c on c.id = sc.current_id
where s.status = 'published'
group by s.id, m.slug;

grant select on public.public_song_cards to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('song-assets', 'song-assets', true)
on conflict (id) do update set public = excluded.public;

create policy "authenticated can read public song assets if song visible"
on storage.objects for select
using (
  bucket_id = 'song-assets'
  and auth.role() = 'authenticated'
);

create policy "owners can upload song assets"
on storage.objects for insert
with check (
  bucket_id = 'song-assets'
  and auth.uid() is not null
);

create policy "owners can update own song assets"
on storage.objects for update
using (
  bucket_id = 'song-assets'
  and auth.uid() is not null
)
with check (
  bucket_id = 'song-assets'
  and auth.uid() is not null
);

create policy "owners can delete own song assets"
on storage.objects for delete
using (
  bucket_id = 'song-assets'
  and auth.uid() is not null
);
