-- iDreamMusic Muse Gap Analysis v1
-- Evidence-backed planning for future Muse depth work.
-- This migration does not create research jobs or modify production Muse knowledge.

create extension if not exists pgcrypto;

create table if not exists public.muse_gap_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_version text not null default 'muse-gap-analysis-v1',
  source_depth integer not null default 2 check (source_depth > 0),
  target_depth integer not null default 3 check (target_depth > source_depth),
  status text not null default 'RUNNING'
    check (status in ('RUNNING','COMPLETE','FAILED')),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists muse_gap_analysis_runs_created_idx
  on public.muse_gap_analysis_runs(created_at desc);

create table if not exists public.muse_gap_analysis_recommendations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.muse_gap_analysis_runs(id) on delete cascade,
  muse_key text not null check (
    muse_key in (
      'calliope','clio','erato','euterpe','melpomene',
      'polyhymnia','terpsichore','thalia','urania'
    )
  ),
  current_version text,
  recommendation text not null
    check (recommendation in ('HOLD','DEEPEN')),
  gap_score numeric(6,2) not null check (gap_score between 0 and 100),
  weak_capabilities text[] not null default '{}',
  requested_source_count integer
    check (requested_source_count is null or requested_source_count > 0),
  proposed_mission text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','REJECTED','JOB_CREATED')),
  decision_notes text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_job_id uuid references public.agent_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (run_id, muse_key)
);

create index if not exists muse_gap_analysis_recommendations_run_idx
  on public.muse_gap_analysis_recommendations(run_id, muse_key);

create index if not exists muse_gap_analysis_recommendations_status_idx
  on public.muse_gap_analysis_recommendations(status, recommendation);

alter table public.muse_gap_analysis_runs enable row level security;
alter table public.muse_gap_analysis_recommendations enable row level security;

comment on table public.muse_gap_analysis_runs is
'iDreamMusic evidence-backed Muse learning-gap analyses. Analysis alone never creates research work.';

comment on table public.muse_gap_analysis_recommendations is
'Per-Muse HOLD/DEEPEN recommendations. A human approval is required before a Depth-03 job can be created.';
