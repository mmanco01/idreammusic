create or replace function public.release_agent_candidate_knowledge(
  p_job_id uuid,
  p_release_candidate_id uuid,
  p_executed_by uuid,
  p_release_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.agent_jobs%rowtype;
  v_release public.release_candidates%rowtype;
  v_validation public.validation_runs%rowtype;
  v_document_ids uuid[];
  v_expected_document_count integer := 0;
  v_distinct_document_count integer := 0;
  v_matching_draft_count integer := 0;
  v_all_candidate_draft_count integer := 0;
  v_expected_source_count integer := 0;
  v_active_source_count integer := 0;
  v_promoted_document_count integer := 0;
  v_approved_source_count integer := 0;
  v_approval_count integer := 0;
  v_release_artifact_id uuid;
  v_now timestamptz := now();
begin
  if p_release_hash is null or length(trim(p_release_hash)) < 32 then
    raise exception 'A valid release hash is required.';
  end if;

  select * into v_job
  from public.agent_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Agent job % does not exist.', p_job_id;
  end if;

  select * into v_release
  from public.release_candidates
  where id = p_release_candidate_id
    and job_id = p_job_id
  for update;

  if not found then
    raise exception 'Release candidate % does not belong to Agent job %.',
      p_release_candidate_id, p_job_id;
  end if;

  if v_job.status = 'RELEASED' and v_release.status = 'RELEASED' then
    return jsonb_build_object(
      'status','success',
      'alreadyReleased',true,
      'jobId',p_job_id,
      'releaseCandidateId',p_release_candidate_id,
      'jobStatus','RELEASED',
      'releaseCandidateStatus','RELEASED',
      'releaseHash',v_release.release_hash,
      'productionChanged',false
    );
  end if;

  if v_job.status <> 'RELEASE_CANDIDATE' then
    raise exception 'Agent job % must be RELEASE_CANDIDATE, not %.', p_job_id, v_job.status;
  end if;

  if v_release.status <> 'APPROVED' then
    raise exception 'Release candidate % must be APPROVED, not %.',
      p_release_candidate_id, v_release.status;
  end if;

  if v_release.requires_approval is distinct from true
     or v_release.approved_by is null
     or v_release.approved_at is null then
    raise exception 'Release candidate % does not contain completed human approval.',
      p_release_candidate_id;
  end if;

  select count(*) into v_approval_count
  from public.agent_approvals
  where job_id = p_job_id
    and release_candidate_id = p_release_candidate_id
    and approval_type = 'RELEASE'
    and status = 'APPROVED'
    and decided_by is not null
    and decided_at is not null;

  if v_approval_count <> 1 then
    raise exception 'Exactly one completed RELEASE approval is required; found %.',
      v_approval_count;
  end if;

  select * into v_validation
  from public.validation_runs
  where id = v_release.validation_run_id
    and job_id = p_job_id;

  if not found then
    raise exception 'The release candidate validation record is missing.';
  end if;

  if v_validation.status <> 'PASS'
     or v_validation.benchmark_total <= 0
     or v_validation.benchmark_total <> v_validation.benchmark_passed then
    raise exception 'Validation run % is not a complete PASS.', v_validation.id;
  end if;

  if v_validation.baseline_version <> v_release.from_version
     or v_validation.candidate_version <> v_release.to_version
     or v_release.from_version <> v_job.baseline_version
     or v_release.to_version <> v_job.candidate_version then
    raise exception 'Release versions do not match the validated Agent job versions.';
  end if;

  if jsonb_typeof(v_release.manifest -> 'candidateDocuments') <> 'array' then
    raise exception 'Release candidate manifest does not contain candidateDocuments.';
  end if;

  select count(*), count(distinct (item ->> 'id'))
  into v_expected_document_count, v_distinct_document_count
  from jsonb_array_elements(v_release.manifest -> 'candidateDocuments') as item;

  if v_expected_document_count <= 0 then
    raise exception 'Release candidate manifest contains no candidate documents.';
  end if;

  if v_expected_document_count <> v_distinct_document_count then
    raise exception 'Release candidate manifest contains duplicate document ids.';
  end if;

  select array_agg((item ->> 'id')::uuid)
  into v_document_ids
  from jsonb_array_elements(v_release.manifest -> 'candidateDocuments') as item;

  select count(*) into v_matching_draft_count
  from public.muse_knowledge_documents
  where id = any(v_document_ids)
    and agent_job_id = p_job_id
    and candidate_version = v_release.to_version
    and curation_status = 'draft';

  if v_matching_draft_count <> v_expected_document_count then
    raise exception 'Expected % exact draft candidate documents but found %.',
      v_expected_document_count, v_matching_draft_count;
  end if;

  select count(*) into v_all_candidate_draft_count
  from public.muse_knowledge_documents
  where agent_job_id = p_job_id
    and candidate_version = v_release.to_version
    and curation_status = 'draft';

  if v_all_candidate_draft_count <> v_expected_document_count then
    raise exception 'Candidate contains % draft documents but release manifest contains %.',
      v_all_candidate_draft_count, v_expected_document_count;
  end if;

  select count(distinct source_id)
  into v_expected_source_count
  from public.muse_knowledge_documents
  where id = any(v_document_ids);

  select count(*)
  into v_active_source_count
  from public.muse_knowledge_sources s
  where s.id in (
    select distinct d.source_id
    from public.muse_knowledge_documents d
    where d.id = any(v_document_ids)
  )
  and s.is_active = true;

  if v_active_source_count <> v_expected_source_count then
    raise exception 'All candidate sources must remain active before release; expected %, found %.',
      v_expected_source_count, v_active_source_count;
  end if;

  update public.muse_knowledge_sources
  set approved_by = v_release.approved_by,
      approved_at = coalesce(approved_at, v_now)
  where id in (
    select distinct d.source_id
    from public.muse_knowledge_documents d
    where d.id = any(v_document_ids)
  )
  and is_active = true;

  get diagnostics v_approved_source_count = row_count;

  if v_approved_source_count <> v_expected_source_count then
    raise exception 'Source approval count mismatch; expected %, updated %.',
      v_expected_source_count, v_approved_source_count;
  end if;

  update public.muse_knowledge_documents
  set curation_status = 'approved',
      approved_by = v_release.approved_by,
      approved_at = v_now
  where id = any(v_document_ids)
    and agent_job_id = p_job_id
    and candidate_version = v_release.to_version
    and curation_status = 'draft';

  get diagnostics v_promoted_document_count = row_count;

  if v_promoted_document_count <> v_expected_document_count then
    raise exception 'Document promotion count mismatch; expected %, updated %.',
      v_expected_document_count, v_promoted_document_count;
  end if;

  insert into public.agent_artifacts (
    job_id,parent_artifact_id,artifact_type,artifact_version,
    created_by_agent,payload,content_hash,immutable
  )
  values (
    p_job_id,null,'RELEASE_REPORT',1,'release-manager-v1',
    jsonb_build_object(
      'releaseCandidateId',p_release_candidate_id,
      'validationRunId',v_validation.id,
      'museKey',v_release.muse_key,
      'fromVersion',v_release.from_version,
      'toVersion',v_release.to_version,
      'approvedBy',v_release.approved_by,
      'executedBy',p_executed_by,
      'promotedDocumentCount',v_promoted_document_count,
      'approvedSourceCount',v_approved_source_count,
      'releaseHash',p_release_hash,
      'releasedAt',v_now
    ),
    p_release_hash,true
  )
  returning id into v_release_artifact_id;

  update public.release_candidates
  set status = 'RELEASED',
      released_at = v_now,
      release_hash = p_release_hash
  where id = p_release_candidate_id;

  update public.agent_jobs
  set status = 'RELEASED',
      current_agent = null,
      last_error = null
  where id = p_job_id;

  insert into public.agent_audit_events (
    job_id,event_type,actor_type,actor_name,from_status,to_status,payload
  )
  values (
    p_job_id,'RELEASE_EXECUTED','AGENT','release-manager-v1',
    'RELEASE_CANDIDATE','RELEASED',
    jsonb_build_object(
      'releaseCandidateId',p_release_candidate_id,
      'validationRunId',v_validation.id,
      'releaseArtifactId',v_release_artifact_id,
      'releaseHash',p_release_hash,
      'approvedBy',v_release.approved_by,
      'executedBy',p_executed_by,
      'promotedDocumentCount',v_promoted_document_count,
      'approvedSourceCount',v_approved_source_count
    )
  );

  return jsonb_build_object(
    'status','success',
    'alreadyReleased',false,
    'jobId',p_job_id,
    'releaseCandidateId',p_release_candidate_id,
    'validationRunId',v_validation.id,
    'releaseArtifactId',v_release_artifact_id,
    'jobStatus','RELEASED',
    'releaseCandidateStatus','RELEASED',
    'releaseHash',p_release_hash,
    'promotedDocumentCount',v_promoted_document_count,
    'approvedSourceCount',v_approved_source_count,
    'productionChanged',true
  );
end;
$$;

revoke execute on function public.release_agent_candidate_knowledge(
  uuid,uuid,uuid,text
) from public, anon, authenticated;

grant execute on function public.release_agent_candidate_knowledge(
  uuid,uuid,uuid,text
) to service_role;
