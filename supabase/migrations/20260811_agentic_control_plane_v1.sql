-- iDreamMusic Agent Control Plane v1
-- Candidate work only. No production Muse content is modified by this migration.

create extension if not exists pgcrypto;

create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  parent_job_id uuid references public.agent_jobs(id) on delete set null,
  idempotency_key text unique,
  job_type text not null,
  muse_key text not null check (
    muse_key in (
      'calliope','clio','erato','euterpe','melpomene',
      'polyhymnia','terpsichore','thalia','urania'
    )
  ),
  title text not null,
  mission text not null,
  baseline_version text not null,
  candidate_version text not null,
  status text not null default 'NEW' check (
    status in (
      'NEW',
      'RESEARCHING','RESEARCHED',
      'CURATING','CURATED',
      'STAGING','STAGED',
      'VALIDATING',
      'DIAGNOSING','CODE_FIX','REVALIDATING',
      'RELEASE_CANDIDATE','AWAITING_APPROVAL','RELEASED',
      'HUMAN_REVIEW','BLOCKED','FAILED',
      'REJECTED','CANCELLED','ROLLED_BACK'
    )
  ),
  current_agent text,
  priority integer not null default 50 check (priority between 0 and 100),
  risk_level text not null default 'LOW' check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
  requested_source_count integer check (requested_source_count is null or requested_source_count > 0),
  autonomy_policy jsonb not null default '{}'::jsonb,
  input jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 3 check (max_retries >= 0),
  requires_human_review boolean not null default false,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists agent_jobs_status_idx on public.agent_jobs(status, priority desc, created_at);
create index if not exists agent_jobs_muse_idx on public.agent_jobs(muse_key, created_at desc);

create table if not exists public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  parent_artifact_id uuid references public.agent_artifacts(id) on delete set null,
  artifact_type text not null,
  artifact_version integer not null default 1 check (artifact_version > 0),
  created_by_agent text not null,
  payload jsonb not null default '{}'::jsonb,
  content_hash text,
  immutable boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists agent_artifacts_job_idx on public.agent_artifacts(job_id, created_at);

create table if not exists public.source_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  muse_key text not null,
  title text not null,
  author text,
  publisher text,
  publication_date date,
  source_url text,
  source_type text,
  retrieved_at timestamptz not null default now(),
  target_capabilities text[] not null default '{}',
  relevance_reason text not null,
  authority_score numeric(5,2) check (authority_score between 0 and 100),
  novelty_score numeric(5,2) check (novelty_score between 0 and 100),
  overlap_score numeric(5,2) check (overlap_score between 0 and 100),
  provenance_status text not null default 'UNKNOWN'
    check (provenance_status in ('COMPLETE','PARTIAL','UNKNOWN','INVALID')),
  rights_status text not null default 'UNKNOWN'
    check (rights_status in ('CLEARED','PUBLIC_DOMAIN','LICENSED','USER_PROVIDED','UNKNOWN','RESTRICTED')),
  research_notes text,
  disposition text not null default 'CANDIDATE'
    check (disposition in ('CANDIDATE','ACCEPTED','REJECTED','DEFERRED')),
  source_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists source_candidates_job_idx on public.source_candidates(job_id, disposition);
create index if not exists source_candidates_muse_idx on public.source_candidates(muse_key, created_at desc);

create table if not exists public.curation_decisions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  source_candidate_id uuid not null references public.source_candidates(id) on delete cascade,
  decision text not null check (decision in ('ACCEPT','REJECT','DEFER','HUMAN_REVIEW')),
  authority_score numeric(5,2) check (authority_score between 0 and 100),
  relevance_score numeric(5,2) check (relevance_score between 0 and 100),
  muse_fit_score numeric(5,2) check (muse_fit_score between 0 and 100),
  evidence_quality_score numeric(5,2) check (evidence_quality_score between 0 and 100),
  novelty_score numeric(5,2) check (novelty_score between 0 and 100),
  duplication_score numeric(5,2) check (duplication_score between 0 and 100),
  rationale text not null,
  conflict_notes text,
  reviewer_type text not null default 'AGENT' check (reviewer_type in ('AGENT','HUMAN')),
  reviewer_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists curation_decisions_job_idx on public.curation_decisions(job_id, created_at);

create table if not exists public.candidate_builds (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  muse_key text not null,
  baseline_version text not null,
  candidate_version text not null,
  status text not null default 'BUILDING'
    check (status in ('BUILDING','BUILT','SMOKE_TEST_FAILED','FAILED','ARCHIVED')),
  source_ids uuid[] not null default '{}',
  chunk_ids text[] not null default '{}',
  chunk_count integer not null default 0 check (chunk_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  provenance_complete boolean not null default false,
  retrieval_smoke_tests jsonb not null default '[]'::jsonb,
  build_manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists candidate_builds_job_idx on public.candidate_builds(job_id, created_at desc);

create table if not exists public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  build_id uuid references public.candidate_builds(id) on delete set null,
  run_type text not null check (run_type in ('BASELINE','REGRESSION','EXPLORATORY','REVALIDATION')),
  baseline_version text not null,
  candidate_version text not null,
  status text not null default 'RUNNING' check (status in ('RUNNING','PASS','FAIL','HUMAN_REVIEW','ERROR')),
  benchmark_total integer not null default 0 check (benchmark_total >= 0),
  benchmark_passed integer not null default 0 check (benchmark_passed >= 0),
  overall_score numeric(8,3),
  retrieval_score numeric(8,3),
  citation_score numeric(8,3),
  response_score numeric(8,3),
  structure_score numeric(8,3),
  failure_categories text[] not null default '{}',
  regressions jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  new_capability_results jsonb not null default '[]'::jsonb,
  root_cause_hypothesis text,
  recommended_action text,
  raw_report jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists validation_runs_job_idx on public.validation_runs(job_id, started_at desc);

create table if not exists public.change_proposals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  validation_run_id uuid references public.validation_runs(id) on delete set null,
  root_cause text not null check (
    root_cause in (
      'KNOWLEDGE_GAP','BAD_SOURCE','BAD_CHUNK','METADATA','RETRIEVAL',
      'PROMPT','RESPONSE_FORMATTING','APPLICATION_CODE','VALIDATOR_DEFECT','UNKNOWN'
    )
  ),
  proposed_change_type text not null,
  files_affected text[] not null default '{}',
  before_behavior text,
  proposed_change text not null,
  reason text not null,
  risk_level text not null default 'LOW' check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
  tests_added text[] not null default '{}',
  branch_name text,
  commit_sha text,
  rollback_plan text,
  status text not null default 'PROPOSED'
    check (status in ('PROPOSED','APPLIED_TO_CANDIDATE','REJECTED','HUMAN_REVIEW','VALIDATED')),
  created_at timestamptz not null default now()
);

create index if not exists change_proposals_job_idx on public.change_proposals(job_id, created_at desc);

create table if not exists public.release_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  build_id uuid references public.candidate_builds(id) on delete set null,
  validation_run_id uuid not null references public.validation_runs(id) on delete restrict,
  muse_key text not null,
  from_version text not null,
  to_version text not null,
  manifest jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING'
    check (status in ('PENDING','AWAITING_APPROVAL','APPROVED','REJECTED','RELEASED','ROLLED_BACK')),
  requires_approval boolean not null default true,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  released_at timestamptz,
  release_hash text,
  created_at timestamptz not null default now()
);

create index if not exists release_candidates_job_idx on public.release_candidates(job_id, created_at desc);

create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  release_candidate_id uuid references public.release_candidates(id) on delete cascade,
  approval_type text not null check (
    approval_type in ('RELEASE','CANON','BENCHMARK','SOURCE_CONFLICT','SOURCE_REMOVAL','HIGH_RISK_CHANGE')
  ),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_reason text not null,
  decision_notes text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);

create index if not exists agent_approvals_job_idx on public.agent_approvals(job_id, status);

create table if not exists public.agent_audit_events (
  id bigint generated always as identity primary key,
  job_id uuid references public.agent_jobs(id) on delete set null,
  event_type text not null,
  actor_type text not null check (actor_type in ('SYSTEM','ORCHESTRATOR','AGENT','HUMAN')),
  actor_name text not null,
  from_status text,
  to_status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_audit_events_job_idx on public.agent_audit_events(job_id, created_at);

-- Keep updated_at correct.
create or replace function public.touch_agent_job_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agent_jobs_updated_at on public.agent_jobs;
create trigger trg_agent_jobs_updated_at
before update on public.agent_jobs
for each row execute function public.touch_agent_job_updated_at();

-- RLS: these are control-plane tables. v1 intentionally exposes no direct browser policies.
-- Server-side APIs should use a protected service-role client after authenticating/authorizing the human.
alter table public.agent_jobs enable row level security;
alter table public.agent_artifacts enable row level security;
alter table public.source_candidates enable row level security;
alter table public.curation_decisions enable row level security;
alter table public.candidate_builds enable row level security;
alter table public.validation_runs enable row level security;
alter table public.change_proposals enable row level security;
alter table public.release_candidates enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_audit_events enable row level security;

comment on table public.agent_jobs is
'iDreamMusic governed agent work orders. Frozen/released Muse baselines are never edited by an agent job.';
comment on table public.agent_audit_events is
'Append-oriented audit history for agent, orchestrator, and human decisions.';
