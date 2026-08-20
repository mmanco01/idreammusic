import Link from "next/link";

import { approveBlogPost, rejectBlogPost } from "@/app/admin/review/actions";
import AgentControls from "@/app/admin/review/agent-controls";
import { getServerAuthContext } from "@/lib/auth";
import { getPendingBlogPosts } from "@/lib/data";
import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, any>;

type AgentJob = {
  id: string;
  job_type: string;
  muse_key: string;
  title: string;
  mission: string;
  baseline_version: string;
  candidate_version: string;
  status: string;
  risk_level: string;
  requested_source_count: number | null;
  requires_human_review: boolean;
  result_summary: JsonRecord | null;
  input: JsonRecord | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type SourceCandidate = {
  id: string;
  job_id: string;
  title: string;
  provenance_status: string;
  rights_status: string;
  disposition: string;
};

type CandidateDocument = {
  id: string;
  agent_job_id: string;
  title: string;
  document_text: string | null;
  curation_status: string;
  candidate_version: string | null;
};

type KnowledgeChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  heading: string | null;
  content: string;
  citation_text: string | null;
  token_estimate: number | null;
};

type ValidationRun = {
  id: string;
  job_id: string;
  status: string;
  benchmark_total: number;
  benchmark_passed: number;
  overall_score: number | string | null;
  retrieval_score: number | string | null;
  citation_score: number | string | null;
  response_score: number | string | null;
  structure_score: number | string | null;
  regressions: unknown;
  improvements: unknown;
  failure_categories: string[] | null;
  recommended_action: string | null;
  started_at: string;
};

type ReleaseCandidate = {
  id: string;
  job_id: string;
  validation_run_id: string;
  status: string;
  manifest: JsonRecord | null;
  approved_at: string | null;
  released_at: string | null;
  created_at: string;
};

type Approval = {
  id: string;
  job_id: string;
  release_candidate_id: string | null;
  approval_type: string;
  status: string;
  requested_reason: string;
  decision_notes: string | null;
  requested_at: string;
  decided_at: string | null;
};

const ACTIVE_STATUSES = [
  "NEW",
  "RESEARCHING",
  "RESEARCHED",
  "CURATING",
  "CURATED",
  "STAGING",
  "STAGED",
  "VALIDATING",
  "DIAGNOSING",
  "CODE_FIX",
  "REVALIDATING",
  "RELEASE_CANDIDATE",
  "AWAITING_APPROVAL",
  "HUMAN_REVIEW",
  "BLOCKED",
  "FAILED",
];

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function score(value: unknown): string {
  const parsed = num(value);
  return parsed === null ? "—" : parsed.toFixed(2);
}

function pillStyle(status?: string) {
  const normalized = String(status ?? "").toUpperCase();
  let background = "rgba(148, 163, 184, .12)";
  let border = "rgba(148, 163, 184, .35)";
  if (["PASS", "APPROVED", "RELEASED", "COMPLETE", "CURATED", "STAGED"].includes(normalized)) {
    background = "rgba(74, 222, 128, .10)";
    border = "rgba(74, 222, 128, .35)";
  } else if (["AWAITING_APPROVAL", "HUMAN_REVIEW", "PENDING", "VALIDATING"].includes(normalized)) {
    background = "rgba(250, 204, 21, .10)";
    border = "rgba(250, 204, 21, .35)";
  } else if (["FAILED", "REJECTED", "BLOCKED", "FAIL"].includes(normalized)) {
    background = "rgba(248, 113, 113, .10)";
    border = "rgba(248, 113, 113, .35)";
  }
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: ".28rem .58rem",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background,
    fontSize: ".78rem",
    lineHeight: 1.2,
  } as const;
}

function metricTest(job: AgentJob): boolean {
  return record(job.input).metrics_test === true;
}

function validationSummary(job: AgentJob) {
  const validation = record(record(job.result_summary).validation);
  const final = record(validation.final);
  const candidate = record(final.candidate);
  const baseline = record(final.baseline);
  const deltas = record(final.deltas);
  return { validation, final, candidate, baseline, deltas };
}

function ingestionSummary(job: AgentJob) {
  return record(record(job.result_summary).knowledge_ingestion);
}

function curationSummary(job: AgentJob) {
  return record(record(job.result_summary).curation);
}

function researchSummary(job: AgentJob) {
  return record(record(job.result_summary).research);
}

function pipelineStep(status: string): number {
  if (["NEW", "RESEARCHING"].includes(status)) return 0;
  if (["RESEARCHED", "CURATING"].includes(status)) return 1;
  if (["CURATED", "STAGING"].includes(status)) return 2;
  if (["STAGED", "VALIDATING", "REVALIDATING", "DIAGNOSING", "CODE_FIX"].includes(status)) return 3;
  if (["RELEASE_CANDIDATE", "AWAITING_APPROVAL", "HUMAN_REVIEW"].includes(status)) return 4;
  if (status === "RELEASED") return 5;
  return 0;
}

function Pipeline({ status }: { status: string }) {
  const labels = ["Research", "Curation", "Knowledge", "Validation", "Human review", "Release"];
  const current = pipelineStep(status);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(90px, 1fr))",
        gap: ".35rem",
        marginTop: ".9rem",
        overflowX: "auto",
      }}
    >
      {labels.map((label, index) => (
        <div
          key={label}
          style={{
            minWidth: 90,
            padding: ".45rem .5rem",
            borderRadius: 8,
            border: "1px solid rgba(148,163,184,.22)",
            background:
              index < current
                ? "rgba(74,222,128,.08)"
                : index === current
                  ? "rgba(250,204,21,.10)"
                  : "rgba(148,163,184,.05)",
            fontSize: ".75rem",
            textAlign: "center",
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="card" style={{ minHeight: 128 }}>
      <div className="eyebrow">{label}</div>
      <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: ".35rem" }}>{value}</div>
      <p className="copy" style={{ margin: ".35rem 0 0" }}>
        {note}
      </p>
    </div>
  );
}

function DetailsSection({
  job,
  sources,
  documents,
  chunks,
  validation,
  release,
  approval,
}: {
  job: AgentJob;
  sources: SourceCandidate[];
  documents: CandidateDocument[];
  chunks: KnowledgeChunk[];
  validation?: ValidationRun;
  release?: ReleaseCandidate;
  approval?: Approval;
}) {
  const curation = curationSummary(job);
  const ingestion = ingestionSummary(job);
  const v = validationSummary(job);

  const chunksByDocument = new Map<string, KnowledgeChunk[]>();
  for (const chunk of chunks) {
    const list = chunksByDocument.get(chunk.document_id) ?? [];
    list.push(chunk);
    chunksByDocument.set(chunk.document_id, list);
  }

  const completeProvenance = sources.filter((item) => item.provenance_status === "COMPLETE").length;
  const accepted = sources.filter((item) => item.disposition === "ACCEPTED").length;

  return (
    <details style={{ marginTop: "1rem" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Review details</summary>
      <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
        <div>
          <div className="eyebrow">Research & curation</div>
          <p className="copy" style={{ margin: ".35rem 0" }}>
            {sources.length} researched sources · {completeProvenance}/{sources.length || 0} provenance complete ·{" "}
            {accepted} accepted
          </p>
          {Object.keys(curation).length ? (
            <p className="copy" style={{ margin: ".2rem 0" }}>
              Curation: {String(curation.accepted_count ?? 0)} accepted ·{" "}
              {String(curation.rejected_count ?? 0)} rejected ·{" "}
              {String(curation.deferred_count ?? 0)} deferred ·{" "}
              {String(curation.human_review_count ?? 0)} human-review flags
            </p>
          ) : null}
        </div>

        <div>
          <div className="eyebrow">Candidate knowledge</div>
          <p className="copy" style={{ margin: ".35rem 0" }}>
            {documents.length} documents · {String(ingestion.total_chunk_count ?? chunks.length)} chunks
          </p>
          {documents.length ? (
            <div style={{ display: "grid", gap: ".65rem", marginTop: ".6rem" }}>
              {documents.map((document) => {
                const documentChunks = (chunksByDocument.get(document.id) ?? []).sort(
                  (a, b) => a.chunk_index - b.chunk_index,
                );
                return (
                  <details
                    key={document.id}
                    style={{
                      border: "1px solid rgba(148,163,184,.18)",
                      borderRadius: 10,
                      padding: ".65rem .75rem",
                    }}
                  >
                    <summary style={{ cursor: "pointer" }}>
                      <strong>{document.title}</strong>{" "}
                      <span style={{ opacity: .7 }}>
                        · {documentChunks.length} chunk{documentChunks.length === 1 ? "" : "s"}
                      </span>
                    </summary>
                    <div style={{ display: "grid", gap: ".7rem", marginTop: ".7rem" }}>
                      {documentChunks.map((chunk) => (
                        <div key={chunk.id}>
                          <strong>{chunk.heading || `Chunk ${chunk.chunk_index + 1}`}</strong>
                          <p
                            className="copy"
                            style={{
                              margin: ".3rem 0 0",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {chunk.content}
                          </p>
                          {chunk.citation_text ? (
                            <p className="copy" style={{ margin: ".25rem 0 0", opacity: .72 }}>
                              Source: {chunk.citation_text}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <p className="copy">No staged candidate documents yet.</p>
          )}
        </div>

        <div>
          <div className="eyebrow">Validation</div>
          {Object.keys(v.final).length || validation ? (
            <>
              <p className="copy" style={{ margin: ".35rem 0" }}>
                Classification: <strong>{String(v.final.classification ?? validation?.status ?? "—")}</strong>
              </p>
              <p className="copy" style={{ margin: ".2rem 0" }}>
                Candidate overall: <strong>{score(v.candidate.averageOverallScore ?? validation?.overall_score)}</strong>
                {" · "}Baseline overall: <strong>{score(v.baseline.averageOverallScore)}</strong>
                {" · "}Delta: <strong>{score(v.deltas.averageOverall)}</strong>
              </p>
              {validation ? (
                <p className="copy" style={{ margin: ".2rem 0" }}>
                  Benchmarks: {validation.benchmark_passed}/{validation.benchmark_total} passed
                </p>
              ) : null}
              {Array.isArray(v.final.watchItems) && v.final.watchItems.length ? (
                <div style={{ marginTop: ".5rem" }}>
                  <strong>Watch items</strong>
                  <ul>
                    {v.final.watchItems.map((item: unknown, index: number) => (
                      <li key={index}>{String(item)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="copy">Validation has not been completed yet.</p>
          )}
        </div>

        {release || approval ? (
          <div>
            <div className="eyebrow">Release governance</div>
            <p className="copy" style={{ margin: ".35rem 0" }}>
              Release candidate: <strong>{release?.status ?? "—"}</strong>
              {" · "}Human approval: <strong>{approval?.status ?? "—"}</strong>
            </p>
            {approval?.requested_reason ? (
              <p className="copy" style={{ margin: ".2rem 0" }}>
                {approval.requested_reason}
              </p>
            ) : null}
            {approval?.decision_notes ? (
              <p className="copy" style={{ margin: ".2rem 0" }}>
                Decision: {approval.decision_notes}
              </p>
            ) : null}
          </div>
        ) : null}

        {job.last_error ? (
          <div>
            <div className="eyebrow">Last error</div>
            <p className="copy" style={{ margin: ".35rem 0" }}>
              {job.last_error}
            </p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function AgentCard({
  job,
  sources,
  documents,
  chunks,
  validation,
  release,
  approval,
}: {
  job: AgentJob;
  sources: SourceCandidate[];
  documents: CandidateDocument[];
  chunks: KnowledgeChunk[];
  validation?: ValidationRun;
  release?: ReleaseCandidate;
  approval?: Approval;
}) {
  const testJob = metricTest(job);
  const v = validationSummary(job);
  const ingestion = ingestionSummary(job);
  const provenanceComplete = sources.filter((item) => item.provenance_status === "COMPLETE").length;
  const candidateCount = sources.length;
  const chunkCount = Number(ingestion.total_chunk_count ?? chunks.length ?? 0);

  let action:
    | "research"
    | "curate"
    | "stage-knowledge"
    | "validate"
    | "prepare-release"
    | "approve-release"
    | "release"
    | null = null;
  let label = "";
  let confirmMessage: string | undefined;

  if (!testJob) {
    if (job.status === "NEW") {
      action = "research";
      label = "Run Research";
    } else if (job.status === "RESEARCHED") {
      action = "curate";
      label = "Run Curation";
    } else if (["CURATED", "STAGING"].includes(job.status)) {
      action = "stage-knowledge";
      label = job.status === "STAGING" ? "Resume Knowledge" : "Stage Knowledge";
    } else if (["STAGED", "VALIDATING"].includes(job.status)) {
      action = "validate";
      label = job.status === "STAGED" ? "Start Validation" : "Continue Validation";
    } else if (job.status === "RELEASE_CANDIDATE" && release?.status === "APPROVED") {
      action = "release";
      label = "Release to Production";
      confirmMessage =
        `Release ${job.candidate_version} to production for ${titleCase(job.muse_key)}? ` +
        "This is the production-changing step.";
    } else if (job.status === "RELEASE_CANDIDATE") {
      action = "prepare-release";
      label = "Prepare Human Review";
    } else if (job.status === "AWAITING_APPROVAL") {
      action = "approve-release";
      label = "Approve Release";
      confirmMessage =
        `Approve ${job.candidate_version} for release? Approval does not change production until Release to Production is clicked.`;
    }
  }

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          gap: ".6rem",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="pillRow" style={{ marginBottom: ".7rem" }}>
            <span style={pillStyle(job.status)}>{titleCase(job.status)}</span>
            <span className="pill">{titleCase(job.muse_key)}</span>
            <span className="pill">{job.candidate_version}</span>
            <span className="pill">{job.risk_level} risk</span>
            {testJob ? <span style={pillStyle("HUMAN_REVIEW")}>Metrics test · promotion locked</span> : null}
          </div>
          <h2 className="h3" style={{ marginBottom: ".35rem" }}>
            {job.title}
          </h2>
          <p className="copy" style={{ maxWidth: 850, marginTop: 0 }}>
            {job.mission}
          </p>
        </div>
        <Link className="button" href="/admin/metrics">
          Metrics
        </Link>
      </div>

      <Pipeline status={job.status} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: ".65rem",
          marginTop: "1rem",
        }}
      >
        <div>
          <div className="eyebrow">Sources</div>
          <strong>{candidateCount || "—"}</strong>
          <div className="copy" style={{ fontSize: ".85rem" }}>
            {candidateCount ? `${provenanceComplete}/${candidateCount} provenance complete` : "Research not complete"}
          </div>
        </div>
        <div>
          <div className="eyebrow">Knowledge</div>
          <strong>{chunkCount || "—"}</strong>
          <div className="copy" style={{ fontSize: ".85rem" }}>
            candidate chunks
          </div>
        </div>
        <div>
          <div className="eyebrow">Muse IQ</div>
          <strong>{score(v.candidate.averageOverallScore ?? validation?.overall_score)}</strong>
          <div className="copy" style={{ fontSize: ".85rem" }}>
            {String(v.final.classification ?? validation?.status ?? "not validated")}
          </div>
        </div>
        <div>
          <div className="eyebrow">Approval</div>
          <strong>{approval?.status ?? "—"}</strong>
          <div className="copy" style={{ fontSize: ".85rem" }}>
            {release?.status ? `release ${release.status.toLowerCase()}` : "not prepared"}
          </div>
        </div>
      </div>

      {testJob ? (
        <p className="copy" style={{ marginTop: "1rem" }}>
          This job is marked <code>metrics_test</code>. Review Center intentionally disables promotion actions.
        </p>
      ) : null}

      {action ? (
        <div className="button-row" style={{ marginTop: "1rem" }}>
          <AgentControls
            jobId={job.id}
            action={action}
            label={label}
            confirmMessage={confirmMessage}
          />
          {job.status === "AWAITING_APPROVAL" ? (
            <AgentControls
              jobId={job.id}
              action="return-for-work"
              label="Return for Work"
              tone="secondary"
              requireNotes
              confirmMessage="Return this release candidate for human follow-up? Production will not change."
            />
          ) : null}
        </div>
      ) : job.status === "HUMAN_REVIEW" ? (
        <p className="copy" style={{ marginTop: "1rem" }}>
          Human intervention is required before this job can continue.
        </p>
      ) : null}

      <DetailsSection
        job={job}
        sources={sources}
        documents={documents}
        chunks={chunks}
        validation={validation}
        release={release}
        approval={approval}
      />

      <div className="commentMeta" style={{ marginTop: "1rem" }}>
        <span>Updated {formatDate(job.updated_at)}</span>
        <span>•</span>
        <span>{job.id}</span>
      </div>
    </div>
  );
}

async function loadAgentData() {
  const admin = getAgentAdminClient() as any;

  const { data: jobsData, error: jobsError } = await admin
    .from("agent_jobs")
    .select(
      "id,job_type,muse_key,title,mission,baseline_version,candidate_version,status,risk_level,requested_source_count,requires_human_review,result_summary,input,last_error,created_at,updated_at",
    )
    .in("status", ACTIVE_STATUSES)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(30);

  if (jobsError) throw new Error(`Could not load Agent jobs: ${jobsError.message}`);

  const jobs = (jobsData ?? []) as AgentJob[];
  const ids = jobs.map((job) => job.id);

  if (!ids.length) {
    return {
      jobs,
      sources: [] as SourceCandidate[],
      documents: [] as CandidateDocument[],
      chunks: [] as KnowledgeChunk[],
      validations: [] as ValidationRun[],
      releases: [] as ReleaseCandidate[],
      approvals: [] as Approval[],
    };
  }

  const [sourceResult, documentResult, validationResult, releaseResult, approvalResult] = await Promise.all([
    admin
      .from("source_candidates")
      .select("id,job_id,title,provenance_status,rights_status,disposition")
      .in("job_id", ids),
    admin
      .from("muse_knowledge_documents")
      .select("id,agent_job_id,title,document_text,curation_status,candidate_version")
      .in("agent_job_id", ids)
      .order("title", { ascending: true }),
    admin
      .from("validation_runs")
      .select(
        "id,job_id,status,benchmark_total,benchmark_passed,overall_score,retrieval_score,citation_score,response_score,structure_score,regressions,improvements,failure_categories,recommended_action,started_at",
      )
      .in("job_id", ids)
      .order("started_at", { ascending: false }),
    admin
      .from("release_candidates")
      .select("id,job_id,validation_run_id,status,manifest,approved_at,released_at,created_at")
      .in("job_id", ids)
      .order("created_at", { ascending: false }),
    admin
      .from("agent_approvals")
      .select(
        "id,job_id,release_candidate_id,approval_type,status,requested_reason,decision_notes,requested_at,decided_at",
      )
      .in("job_id", ids)
      .eq("approval_type", "RELEASE")
      .order("requested_at", { ascending: false }),
  ]);

  for (const [label, result] of [
    ["source candidates", sourceResult],
    ["candidate documents", documentResult],
    ["validation runs", validationResult],
    ["release candidates", releaseResult],
    ["release approvals", approvalResult],
  ] as const) {
    if (result.error) {
      throw new Error(`Could not load ${label}: ${result.error.message}`);
    }
  }

  const documents = (documentResult.data ?? []) as CandidateDocument[];
  const documentIds = documents.map((item) => item.id);

  let chunks: KnowledgeChunk[] = [];
  if (documentIds.length) {
    const { data: chunkData, error: chunkError } = await admin
      .from("muse_knowledge_chunks")
      .select("id,document_id,chunk_index,heading,content,citation_text,token_estimate")
      .in("document_id", documentIds)
      .order("chunk_index", { ascending: true })
      .limit(1000);

    if (chunkError) {
      throw new Error(`Could not load candidate knowledge chunks: ${chunkError.message}`);
    }
    chunks = (chunkData ?? []) as KnowledgeChunk[];
  }

  return {
    jobs,
    sources: (sourceResult.data ?? []) as SourceCandidate[],
    documents,
    chunks,
    validations: (validationResult.data ?? []) as ValidationRun[],
    releases: (releaseResult.data ?? []) as ReleaseCandidate[],
    approvals: (approvalResult.data ?? []) as Approval[],
  };
}

async function loadHistory() {
  const admin = getAgentAdminClient() as any;
  const { data, error } = await admin
    .from("agent_jobs")
    .select(
      "id,job_type,muse_key,title,mission,baseline_version,candidate_version,status,risk_level,requested_source_count,requires_human_review,result_summary,input,last_error,created_at,updated_at",
    )
    .in("status", ["RELEASED", "REJECTED", "CANCELLED", "ROLLED_BACK"])
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(`Could not load Agent history: ${error.message}`);
  return (data ?? []) as AgentJob[];
}

export default async function ReviewCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { user, profile } = await getServerAuthContext();
  const canCommunityReview = profile?.role === "owner" || profile?.role === "manager";
  const params = await searchParams;
  const requestedView = params.view === "community" || params.view === "history" ? params.view : "agent";

  if (!user) {
    return (
      <section className="section-tight">
        <div className="container pageStack">
          <div className="card">
            <div className="eyebrow">Manager lane</div>
            <h1 className="h2">Review Center</h1>
            <p className="copy">Sign in with an authorized manager account to review iDreamMusic work.</p>
            <Link className="button primary" href="/auth/sign-in?next=/admin/review">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!canCommunityReview) {
    return (
      <section className="section-tight">
        <div className="container pageStack">
          <div className="card">
            <div className="eyebrow">Manager lane</div>
            <h1 className="h2">Review Center</h1>
            <p className="copy">This page is reserved for owner and manager accounts.</p>
          </div>
        </div>
      </section>
    );
  }

  let agentAuthorized = true;
  try {
    await requireAgentAdmin();
  } catch (error) {
    agentAuthorized = false;
    if (!(error instanceof AgentAuthorizationError)) {
      console.error("Review Center agent authorization check failed:", error);
    }
  }

  const pendingPosts = await getPendingBlogPosts();

  let agentData:
    | Awaited<ReturnType<typeof loadAgentData>>
    | null = null;
  let history: AgentJob[] = [];
  let agentError: string | null = null;

  if (agentAuthorized) {
    try {
      agentData = await loadAgentData();
      if (requestedView === "history") {
        history = await loadHistory();
      }
    } catch (error) {
      agentError = error instanceof Error ? error.message : "Could not load Agent review data.";
    }
  }

  const jobs = agentData?.jobs ?? [];
  const awaitingApproval = jobs.filter((job) => job.status === "AWAITING_APPROVAL").length;
  const humanReview = jobs.filter(
    (job) => job.status === "HUMAN_REVIEW",
  ).length;

  const latestValidation = new Map<string, ValidationRun>();
  for (const row of agentData?.validations ?? []) {
    if (!latestValidation.has(row.job_id)) latestValidation.set(row.job_id, row);
  }
  const latestRelease = new Map<string, ReleaseCandidate>();
  for (const row of agentData?.releases ?? []) {
    if (!latestRelease.has(row.job_id)) latestRelease.set(row.job_id, row);
  }
  const latestApproval = new Map<string, Approval>();
  for (const row of agentData?.approvals ?? []) {
    if (!latestApproval.has(row.job_id)) latestApproval.set(row.job_id, row);
  }

  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Manager lane</div>
            <h1 className="h2">Review Center</h1>
            <p className="copy" style={{ maxWidth: 840 }}>
              Human control for Agent releases and community moderation. Candidate Muse knowledge stays outside
              production until a human explicitly approves and releases it.
            </p>
            <div className="button-row">
              <Link className={requestedView === "agent" ? "button primary" : "button"} href="/admin/review">
                Agent Releases
              </Link>
              <Link
                className={requestedView === "community" ? "button primary" : "button"}
                href="/admin/review?view=community"
              >
                Community
              </Link>
              <Link
                className={requestedView === "history" ? "button primary" : "button"}
                href="/admin/review?view=history"
              >
                History
              </Link>
              <Link className="button" href="/admin/metrics">
                AI Metrics
              </Link>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <SummaryCard label="Agent attention" value={jobs.length} note="active control-plane jobs" />
          <SummaryCard label="Awaiting approval" value={awaitingApproval} note="human release decisions" />
          <SummaryCard label="Human review" value={humanReview} note="jobs requiring intervention" />
          <SummaryCard label="Community" value={pendingPosts.length} note="pending public posts" />
        </div>

        {requestedView === "agent" ? (
          <>
            {!agentAuthorized ? (
              <div className="card">
                <h2 className="h3">Agent review access required</h2>
                <p className="copy">
                  Community moderation is available, but this account is not authorized for Agent Control Plane
                  actions.
                </p>
              </div>
            ) : agentError ? (
              <div className="card">
                <h2 className="h3">Agent queue could not load</h2>
                <p className="copy">{agentError}</p>
              </div>
            ) : jobs.length ? (
              <>
                <div className="card">
                  <div className="eyebrow">Human gate</div>
                  <h2 className="h3">Agent pipeline & release queue</h2>
                  <p className="copy">
                    Advance one governed step at a time. Research, curation, staging and validation may use AI.
                    Approval records your human decision. Only <strong>Release to Production</strong> changes the live
                    Muse knowledge set.
                  </p>
                </div>
                {jobs.map((job) => {
                  const sources = (agentData?.sources ?? []).filter((item) => item.job_id === job.id);
                  const documents = (agentData?.documents ?? []).filter((item) => item.agent_job_id === job.id);
                  const documentIds = new Set(documents.map((item) => item.id));
                  const chunks = (agentData?.chunks ?? []).filter((item) => documentIds.has(item.document_id));
                  return (
                    <AgentCard
                      key={job.id}
                      job={job}
                      sources={sources}
                      documents={documents}
                      chunks={chunks}
                      validation={latestValidation.get(job.id)}
                      release={latestRelease.get(job.id)}
                      approval={latestApproval.get(job.id)}
                    />
                  );
                })}
              </>
            ) : (
              <div className="card">
                <h2 className="h3">Agent queue is clear</h2>
                <p className="copy">No active Agent jobs currently need attention.</p>
              </div>
            )}
          </>
        ) : null}

        {requestedView === "community" ? (
          <>
            <div className="card">
              <div className="eyebrow">Community</div>
              <h2 className="h3">Public-post moderation</h2>
              <p className="copy">
                This is the original blog/community approval lane, retained separately from governed Agent releases.
              </p>
            </div>
            {pendingPosts.length ? (
              pendingPosts.map((post) => (
                <div className="card" key={post.id}>
                  <div className="pillRow" style={{ marginBottom: ".8rem" }}>
                    <span className="pill">{post.approval_status}</span>
                    <span className="pill">{post.post_type}</span>
                    {post.song_title ? <span className="pill">{post.song_title}</span> : null}
                  </div>
                  <h2 className="h3">{post.title}</h2>
                  <p className="copy">{post.excerpt || "No excerpt yet."}</p>
                  <div className="commentMeta" style={{ marginTop: ".8rem" }}>
                    <span>{post.author_name || "Unknown author"}</span>
                    <span>•</span>
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                  <div className="button-row">
                    <form action={approveBlogPost}>
                      <input type="hidden" name="postId" value={post.id} />
                      <button className="button primary" type="submit">
                        Approve
                      </button>
                    </form>
                    <form action={rejectBlogPost}>
                      <input type="hidden" name="postId" value={post.id} />
                      <button className="button" type="submit">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <div className="card">
                <h2 className="h3">Community queue is clear</h2>
                <p className="copy">No pending public posts are waiting on approval.</p>
              </div>
            )}
          </>
        ) : null}

        {requestedView === "history" ? (
          !agentAuthorized ? (
            <div className="card">
              <h2 className="h3">Agent history access required</h2>
              <p className="copy">This account is not authorized to view Agent Control Plane history.</p>
            </div>
          ) : agentError ? (
            <div className="card">
              <h2 className="h3">History could not load</h2>
              <p className="copy">{agentError}</p>
            </div>
          ) : history.length ? (
            history.map((job) => (
              <div className="card" key={job.id}>
                <div className="pillRow" style={{ marginBottom: ".65rem" }}>
                  <span style={pillStyle(job.status)}>{titleCase(job.status)}</span>
                  <span className="pill">{titleCase(job.muse_key)}</span>
                  <span className="pill">{job.candidate_version}</span>
                </div>
                <h2 className="h3">{job.title}</h2>
                <p className="copy">{job.mission}</p>
                <div className="commentMeta">
                  <span>Updated {formatDate(job.updated_at)}</span>
                  <span>•</span>
                  <span>{job.id}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="card">
              <h2 className="h3">No Agent release history yet</h2>
              <p className="copy">Released, rejected, cancelled and rolled-back jobs will appear here.</p>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
