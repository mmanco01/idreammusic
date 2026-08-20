-- iDreamMusic AI Usage Metrics v1
-- Captures per-call OpenAI usage and an estimated USD cost.
-- Cost is telemetry/forecasting data, not an accounting ledger.

create extension if not exists pgcrypto;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  provider text not null default 'openai',
  activity_type text not null,
  operation text null,
  model text not null,
  response_id text null,

  user_id uuid null,
  song_id text null,
  conversation_id text null,
  analysis_run_id text null,
  agent_job_id text null,

  input_tokens bigint not null default 0,
  cached_input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  reasoning_tokens bigint not null default 0,
  total_tokens bigint not null default 0,

  web_search_calls integer not null default 0,

  input_cost_usd numeric(18, 8) null,
  output_cost_usd numeric(18, 8) null,
  tool_cost_usd numeric(18, 8) null,
  estimated_cost_usd numeric(18, 8) null,

  duration_ms integer null,
  status text not null default 'success',
  pricing_version text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at desc);

create index if not exists ai_usage_events_activity_created_idx
  on public.ai_usage_events (activity_type, created_at desc);

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

create index if not exists ai_usage_events_song_created_idx
  on public.ai_usage_events (song_id, created_at desc);

create index if not exists ai_usage_events_agent_job_idx
  on public.ai_usage_events (agent_job_id)
  where agent_job_id is not null;

create index if not exists ai_usage_events_analysis_run_idx
  on public.ai_usage_events (analysis_run_id)
  where analysis_run_id is not null;

alter table public.ai_usage_events enable row level security;

-- Routes currently use the signed-in Supabase session. This allows them to
-- write only telemetry belonging to that user. Anonymous Muse chat can write
-- only anonymous rows. Service-role agent workers bypass RLS as usual.
drop policy if exists "ai usage insert own or anonymous" on public.ai_usage_events;
create policy "ai usage insert own or anonymous"
  on public.ai_usage_events
  for insert
  to anon, authenticated
  with check (
    (auth.uid() is not null and user_id = auth.uid())
    or
    (auth.uid() is null and user_id is null)
  );

drop policy if exists "ai usage read own" on public.ai_usage_events;
create policy "ai usage read own"
  on public.ai_usage_events
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.ai_usage_events is
  'Per-call AI usage telemetry for iDreamMusic. estimated_cost_usd is calculated from a dated pricing map and is not an invoice amount.';
