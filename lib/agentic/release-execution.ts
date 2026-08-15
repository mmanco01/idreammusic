import { createHash } from "node:crypto";

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(
    (key) => `${JSON.stringify(key)}:${stableJson(record[key])}`,
  ).join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export async function executeApprovedRelease({
  supabase,
  jobId,
  executedByUserId,
}: {
  supabase: any;
  jobId: string;
  executedByUserId: string;
}) {
  const { data: job, error: jobError } = await supabase
    .from("agent_jobs")
    .select("id,muse_key,baseline_version,candidate_version,status")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    throw new Error(jobError?.message || "Agent job could not be found.");
  }

  if (!["RELEASE_CANDIDATE", "RELEASED"].includes(String(job.status))) {
    throw new Error(
      `Release Manager cannot execute job ${jobId} while it is ${job.status}.`,
    );
  }

  const { data: releaseRows, error: releaseError } = await supabase
    .from("release_candidates")
    .select(`
      id,validation_run_id,muse_key,from_version,to_version,manifest,status,
      requires_approval,approved_by,approved_at,release_hash,released_at,created_at
    `)
    .eq("job_id", jobId)
    .in("status", ["APPROVED", "RELEASED"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (releaseError) {
    throw new Error(
      `Could not load approved release candidate: ${releaseError.message}`,
    );
  }

  const release = releaseRows?.[0];

  if (!release) {
    throw new Error("No APPROVED release candidate exists for this Agent job.");
  }

  const { data: approvalRows, error: approvalError } = await supabase
    .from("agent_approvals")
    .select("id,approval_type,status,decided_by,decided_at")
    .eq("job_id", jobId)
    .eq("release_candidate_id", release.id)
    .eq("approval_type", "RELEASE")
    .eq("status", "APPROVED")
    .order("decided_at", { ascending: false })
    .limit(2);

  if (approvalError) {
    throw new Error(
      `Could not verify human release approval: ${approvalError.message}`,
    );
  }

  if (approvalRows?.length !== 1) {
    throw new Error(
      `Exactly one APPROVED human RELEASE decision is required; found ${approvalRows?.length ?? 0}.`,
    );
  }

  const { data: validation, error: validationError } = await supabase
    .from("validation_runs")
    .select(`
      id,status,benchmark_total,benchmark_passed,baseline_version,candidate_version,
      overall_score,retrieval_score,citation_score,response_score,structure_score
    `)
    .eq("id", release.validation_run_id)
    .eq("job_id", jobId)
    .single();

  if (validationError || !validation) {
    throw new Error(
      validationError?.message ||
        "The approved release validation record could not be found.",
    );
  }

  if (
    validation.status !== "PASS" ||
    Number(validation.benchmark_total) <= 0 ||
    Number(validation.benchmark_total) !== Number(validation.benchmark_passed)
  ) {
    throw new Error(
      "The approved release validation record is not a complete PASS.",
    );
  }

  const approval = approvalRows[0];

  const releaseHash = sha256({
    jobId: job.id,
    museKey: job.muse_key,
    baselineVersion: job.baseline_version,
    candidateVersion: job.candidate_version,
    releaseCandidateId: release.id,
    validationRunId: validation.id,
    manifest: release.manifest,
    approvedBy: release.approved_by,
    approvedAt: release.approved_at,
    approvalId: approval.id,
    approvalDecidedBy: approval.decided_by,
    approvalDecidedAt: approval.decided_at,
    validation: {
      benchmarkTotal: validation.benchmark_total,
      benchmarkPassed: validation.benchmark_passed,
      overallScore: validation.overall_score,
      retrievalScore: validation.retrieval_score,
      citationScore: validation.citation_score,
      responseScore: validation.response_score,
      structureScore: validation.structure_score,
    },
  });

  const { data, error } = await supabase.rpc(
    "release_agent_candidate_knowledge",
    {
      p_job_id: jobId,
      p_release_candidate_id: release.id,
      p_executed_by: executedByUserId,
      p_release_hash: releaseHash,
    },
  );

  if (error) {
    throw new Error(`Release transaction failed: ${error.message}`);
  }

  return data;
}
