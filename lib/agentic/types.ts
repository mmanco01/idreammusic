export const MUSE_KEYS = [
  "calliope",
  "clio",
  "erato",
  "euterpe",
  "melpomene",
  "polyhymnia",
  "terpsichore",
  "thalia",
  "urania",
] as const;

export type MuseKey = (typeof MUSE_KEYS)[number];

export type JobStatus =
  | "NEW"
  | "RESEARCHING"
  | "RESEARCHED"
  | "CURATING"
  | "CURATED"
  | "STAGING"
  | "STAGED"
  | "VALIDATING"
  | "DIAGNOSING"
  | "CODE_FIX"
  | "REVALIDATING"
  | "RELEASE_CANDIDATE"
  | "AWAITING_APPROVAL"
  | "RELEASED"
  | "HUMAN_REVIEW"
  | "BLOCKED"
  | "FAILED"
  | "REJECTED"
  | "CANCELLED"
  | "ROLLED_BACK";

export type AgentRole =
  | "ORCHESTRATOR"
  | "RESEARCH"
  | "CURATION"
  | "INGESTION"
  | "VALIDATION"
  | "CODE_IMPROVEMENT"
  | "RELEASE_MANAGER";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AgentJob {
  id: string;
  job_type: string;
  muse_key: MuseKey;
  title: string;
  mission: string;
  baseline_version: string;
  candidate_version: string;
  status: JobStatus;
  current_agent: AgentRole | null;
  requested_source_count: number | null;
  risk_level: RiskLevel;
  retry_count: number;
  max_retries: number;
  requires_human_review: boolean;
  input: Record<string, unknown>;
}

export interface HandoffEnvelope<T = unknown> {
  taskId: string;
  parentTaskId?: string;
  agent: AgentRole;
  muse: MuseKey;
  baselineVersion: string;
  candidateVersion: string;
  inputArtifactIds: string[];
  outputArtifactIds: string[];
  status: "COMPLETE" | "BLOCKED" | "FAILED" | "HUMAN_REVIEW";
  confidence: number;
  riskLevel: RiskLevel;
  provenance: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  warnings: string[];
  errors: string[];
  recommendedNextAgent?: AgentRole;
  recommendedNextAction: string;
  result: T;
}

export type RootCause =
  | "KNOWLEDGE_GAP"
  | "BAD_SOURCE"
  | "BAD_CHUNK"
  | "METADATA"
  | "RETRIEVAL"
  | "PROMPT"
  | "RESPONSE_FORMATTING"
  | "APPLICATION_CODE"
  | "VALIDATOR_DEFECT"
  | "UNKNOWN";

export interface OrchestratorDecision {
  nextAgent?: AgentRole;
  nextStatus: JobStatus;
  action:
    | "START_RESEARCH"
    | "START_CURATION"
    | "START_INGESTION"
    | "START_VALIDATION"
    | "DIAGNOSE_FAILURE"
    | "APPLY_CODE_FIX"
    | "REVALIDATE"
    | "PREPARE_RELEASE"
    | "REQUEST_APPROVAL"
    | "PROMOTE_RELEASE"
    | "STOP";
  reason: string;
  humanApprovalRequired: boolean;
}
