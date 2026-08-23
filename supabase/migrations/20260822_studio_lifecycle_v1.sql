-- =====================================================================
-- iDreamMusic Studio Lifecycle v1
-- Date: 2026-08-22
--
-- Purpose
--   Add the canonical songwriter lifecycle without repurposing the
--   existing Spark / Draft / Final artifact-maturity model.
--
-- Canonical UX model
--   Lifecycle: Capture -> Craft -> Release
--   Craft focus: Explore / Shape / Develop / Refine / Demo
--   Artifact maturity: Spark / Draft / Final (unchanged)
--   Ready to Release: human gate, not an AI score
--
-- Design decisions
--   * Lifecycle is SONG-level state, so it gets its own table.
--   * public.song_workflow remains personal/per-user priority/workflow.
--   * public.songs.current_stage and public.song_versions.stage remain
--     Spark / Draft / Final and are not altered.
--   * public.songs.status / published_at remain the source of truth for
--     public visibility / actual publication evidence.
--   * Human lifecycle decisions (source = manual) are never silently
--     overwritten by synchronization logic.
--
-- Run first in a Supabase branch/dev environment. Backfill is separate.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'song_lifecycle_phase'
  ) then
    create type public.song_lifecycle_phase as enum (
      'capture',
      'craft',
      'release'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'song_craft_focus'
  ) then
    create type public.song_craft_focus as enum (
      'explore',
      'shape',
      'develop',
      'refine',
      'demo'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'song_lifecycle_source'
  ) then
    create type public.song_lifecycle_source as enum (
      'inferred',
      'manual',
      'system'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 2. SONG LIFECYCLE
-- One canonical lifecycle row per song.
-- ---------------------------------------------------------------------

create table if not exists public.song_lifecycle (
  song_id uuid primary key
    references public.songs(id) on delete cascade,

  lifecycle_phase public.song_lifecycle_phase not null,
  craft_focus public.song_craft_focus,
  lifecycle_source public.song_lifecycle_source not null default 'system',

  -- Human completion gate. Non-null means the songwriter explicitly
  -- marked the song Ready to Release. Actual release/publication remains
  -- represented by public.songs.status / published_at.
  ready_to_release_at timestamptz,
  ready_to_release_by uuid
    references public.profiles(id) on delete set null,

  updated_by uuid
    references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint song_lifecycle_craft_focus_check
    check (
      craft_focus is null
      or lifecycle_phase = 'craft'::public.song_lifecycle_phase
    ),

  constraint song_lifecycle_ready_by_check
    check (
      ready_to_release_at is not null
      or ready_to_release_by is null
    )
);

comment on table public.song_lifecycle is
  'Canonical iDreamMusic song lifecycle state: Capture/Craft/Release, independent of Spark/Draft/Final artifact maturity.';

comment on column public.song_lifecycle.craft_focus is
  'Optional current working focus inside Craft: Explore, Shape, Develop, Refine, or Demo. Null is valid.';

comment on column public.song_lifecycle.lifecycle_source is
  'inferred = migration/backfill; system = app/trigger automation; manual = songwriter decision. Manual state is never auto-overwritten.';

comment on column public.song_lifecycle.ready_to_release_at is
  'Human Ready-to-Release gate. This is deliberately separate from AI release-readiness scores and from public.songs.status.';

-- ---------------------------------------------------------------------
-- 3. INDEXES
-- ---------------------------------------------------------------------

create index if not exists song_lifecycle_phase_focus_idx
  on public.song_lifecycle (lifecycle_phase, craft_focus, updated_at desc);

create index if not exists song_lifecycle_ready_idx
  on public.song_lifecycle (ready_to_release_at desc)
  where ready_to_release_at is not null;

-- ---------------------------------------------------------------------
-- 4. UPDATED_AT TRIGGER
-- Use a lifecycle-specific function so this migration does not depend on
-- or modify the project's existing generic timestamp helper.
-- ---------------------------------------------------------------------

create or replace function public.set_song_lifecycle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_song_lifecycle_updated_at
  on public.song_lifecycle;

create trigger set_song_lifecycle_updated_at
before update on public.song_lifecycle
for each row
execute function public.set_song_lifecycle_updated_at();

-- ---------------------------------------------------------------------
-- 5. RLS
-- Mirrors the existing private Studio pattern: song owner or manager.
-- ---------------------------------------------------------------------

alter table public.song_lifecycle enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'song_lifecycle'
      and policyname = 'owners/managers can view song lifecycle'
  ) then
    create policy "owners/managers can view song lifecycle"
      on public.song_lifecycle
      for select
      using (
        public.owns_song(song_id)
        or public.is_owner_or_manager()
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'song_lifecycle'
      and policyname = 'owners/managers can insert song lifecycle'
  ) then
    create policy "owners/managers can insert song lifecycle"
      on public.song_lifecycle
      for insert
      with check (
        public.owns_song(song_id)
        or public.is_owner_or_manager()
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'song_lifecycle'
      and policyname = 'owners/managers can update song lifecycle'
  ) then
    create policy "owners/managers can update song lifecycle"
      on public.song_lifecycle
      for update
      using (
        public.owns_song(song_id)
        or public.is_owner_or_manager()
      )
      with check (
        public.owns_song(song_id)
        or public.is_owner_or_manager()
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'song_lifecycle'
      and policyname = 'owners/managers can delete song lifecycle'
  ) then
    create policy "owners/managers can delete song lifecycle"
      on public.song_lifecycle
      for delete
      using (
        public.owns_song(song_id)
        or public.is_owner_or_manager()
      );
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 6. SYSTEM SYNCHRONIZATION
-- Creates lifecycle rows for NEW songs and performs only safe forward
-- synchronization for non-manual state.
--
-- Rules:
--   * New published song => Release.
--   * New Spark => Capture.
--   * New Draft/Final not published => Craft.
--   * An explicit transition to published => Release, even if the prior
--     lifecycle row was manual (publishing is itself a human release action).
--   * Moving a non-manual song from Spark to Draft/Final while still in
--     Capture => Craft.
--   * Never auto-regress Release on unpublish.
--   * Other automatic synchronization never overwrites source = manual.
-- ---------------------------------------------------------------------

create or replace function public.sync_song_lifecycle_from_song()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  initial_phase public.song_lifecycle_phase;
  became_published boolean := false;
begin
  if new.status::text = 'published' or new.published_at is not null then
    initial_phase := 'release'::public.song_lifecycle_phase;
  elsif new.current_stage::text = 'spark' then
    initial_phase := 'capture'::public.song_lifecycle_phase;
  else
    initial_phase := 'craft'::public.song_lifecycle_phase;
  end if;

  insert into public.song_lifecycle (
    song_id,
    lifecycle_phase,
    lifecycle_source,
    updated_by
  )
  values (
    new.id,
    initial_phase,
    'system'::public.song_lifecycle_source,
    new.owner_user_id
  )
  on conflict (song_id) do nothing;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- A transition into published state is itself an explicit release action.
  -- It is therefore allowed to move even a previously manual Craft row into
  -- Release. Merely editing an ALREADY-published song does not do this, which
  -- preserves a songwriter's deliberate Release -> Craft loopback.
  became_published :=
    (old.status::text <> 'published' and new.status::text = 'published')
    or (old.published_at is null and new.published_at is not null);

  if became_published then
    update public.song_lifecycle
    set
      lifecycle_phase = 'release'::public.song_lifecycle_phase,
      craft_focus = null,
      lifecycle_source = 'system'::public.song_lifecycle_source,
      updated_by = new.owner_user_id,
      updated_at = now()
    where song_id = new.id;

  -- A Spark can remain a Spark artifact while a songwriter manually brings
  -- it into Craft. This automatic rule only advances non-manual Capture when
  -- artifact maturity itself advances beyond Spark.
  elsif new.current_stage::text <> 'spark' then
    update public.song_lifecycle
    set
      lifecycle_phase = 'craft'::public.song_lifecycle_phase,
      lifecycle_source = 'system'::public.song_lifecycle_source,
      updated_by = new.owner_user_id,
      updated_at = now()
    where song_id = new.id
      and lifecycle_source <> 'manual'::public.song_lifecycle_source
      and lifecycle_phase = 'capture'::public.song_lifecycle_phase;
  end if;

  return new;
end;
$$;
drop trigger if exists sync_song_lifecycle_from_song_trigger
  on public.songs;

create trigger sync_song_lifecycle_from_song_trigger
after insert or update of current_stage, status, published_at
on public.songs
for each row
execute function public.sync_song_lifecycle_from_song();

commit;

-- =====================================================================
-- VERIFICATION (read-only)
-- =====================================================================

-- Confirm enums.
select
  t.typname,
  e.enumlabel,
  e.enumsortorder
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
  and t.typname in (
    'song_lifecycle_phase',
    'song_craft_focus',
    'song_lifecycle_source'
  )
order by t.typname, e.enumsortorder;

-- Confirm table, RLS, and policies.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'song_lifecycle';

select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'song_lifecycle'
order by policyname;

-- Existing songs intentionally remain unbackfilled until the separate
-- preview/review script is approved and applied.
select count(*) as lifecycle_rows_before_backfill
from public.song_lifecycle;
