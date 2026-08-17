-- Durable Agent worker lease.
--
-- Prevents overlapping serverless/cron invocations from advancing
-- the same Muse Sweep simultaneously.
--
-- A lease is temporary and may be reclaimed after expiration.
-- The owner may also explicitly release it when work completes.

create table if not exists public.agent_worker_leases (
  lease_key text primary key,
  owner_token uuid not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),

  constraint agent_worker_leases_expiry_check
    check (expires_at > acquired_at)
);

create index if not exists
  agent_worker_leases_expires_idx
on public.agent_worker_leases(expires_at);

alter table public.agent_worker_leases
  enable row level security;

revoke all
on table public.agent_worker_leases
from public, anon, authenticated;


create or replace function public.acquire_agent_worker_lease(
  p_lease_key text,
  p_owner_token uuid,
  p_lease_seconds integer default 600
)
returns table (
  acquired boolean,
  claimed_lease_key text,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease_key text;
  v_expires_at timestamptz;
  v_existing_expires_at timestamptz;
begin
  if nullif(btrim(p_lease_key), '') is null then
    raise exception
      'Lease key is required.';
  end if;

  if p_owner_token is null then
    raise exception
      'Lease owner token is required.';
  end if;

  if
    p_lease_seconds < 30
    or p_lease_seconds > 1800
  then
    raise exception
      'Lease duration must be between 30 and 1800 seconds.';
  end if;

  insert into public.agent_worker_leases as lease
    (
      lease_key,
      owner_token,
      acquired_at,
      expires_at,
      updated_at
    )
  values
    (
      btrim(p_lease_key),
      p_owner_token,
      now(),
      now() + make_interval(
        secs => p_lease_seconds
      ),
      now()
    )
  on conflict (lease_key)
  do update
  set
    owner_token =
      excluded.owner_token,
    acquired_at =
      excluded.acquired_at,
    expires_at =
      excluded.expires_at,
    updated_at =
      excluded.updated_at
  where
    lease.expires_at <= now()
    or lease.owner_token =
      excluded.owner_token
  returning
    lease.lease_key,
    lease.expires_at
  into
    v_lease_key,
    v_expires_at;

  if found then
    return query
      select
        true,
        v_lease_key,
        v_expires_at;

    return;
  end if;

  select
    lease.expires_at
  into
    v_existing_expires_at
  from public.agent_worker_leases as lease
  where
    lease.lease_key =
      btrim(p_lease_key);

  return query
    select
      false,
      btrim(p_lease_key),
      v_existing_expires_at;
end;
$$;


create or replace function public.release_agent_worker_lease(
  p_lease_key text,
  p_owner_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.agent_worker_leases
  where
    lease_key =
      btrim(p_lease_key)
    and owner_token =
      p_owner_token;

  get diagnostics
    v_deleted = row_count;

  return v_deleted = 1;
end;
$$;


revoke execute
on function public.acquire_agent_worker_lease(
  text,
  uuid,
  integer
)
from public, anon, authenticated;

grant execute
on function public.acquire_agent_worker_lease(
  text,
  uuid,
  integer
)
to service_role;


revoke execute
on function public.release_agent_worker_lease(
  text,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.release_agent_worker_lease(
  text,
  uuid
)
to service_role;


comment on table public.agent_worker_leases is
  'Temporary distributed leases preventing overlapping Agent worker execution.';

comment on function public.acquire_agent_worker_lease(
  text,
  uuid,
  integer
) is
  'Atomically acquires or reclaims an expired Agent worker lease.';

comment on function public.release_agent_worker_lease(
  text,
  uuid
) is
  'Releases an Agent worker lease only when called by its current owner.';