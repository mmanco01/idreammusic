import type { RootCause } from "./types";

export const GOVERNANCE = {
  productionBaselineIsReadOnly: true,
  releaseRequiresHumanApproval: true,
  canonChangeRequiresHumanApproval: true,
  benchmarkChangeRequiresHumanApproval: true,
  sourceRemovalRequiresHumanApproval: true,
  highRiskChangeRequiresHumanApproval: true,
  agentMayLowerPassThreshold: false,
  agentMayRewriteExpectedBenchmarkAnswer: false,
  agentMayDeleteProvenance: false,
  agentMayWriteProductionKnowledge: false,
  queueMessagesArchiveOnSuccess: true,
} as const;

export const CANON = {
  coreClaim:
    "iDreamMusic treats songs as caught rather than merely written; the songwriter notices, captures, and shapes songs arriving through currents.",
  currents: {
    dreamborne: "dreams / unconscious",
    lifeborne: "lived experience",
    storyborne: "characters and narrative",
    craftborne: "technique, groove, and songwriting craft",
  },
  muses: {
    calliope: "Storyborne",
    clio: "History/Lifeborne",
    erato: "Love/Lifeborne",
    euterpe: "Craftborne",
    melpomene: "Blues/Pain/Storyborne",
    polyhymnia: "Faithborne/Sacred",
    terpsichore: "Dance/Rhythmborne",
    thalia: "Comedy/Playborne",
    urania: "Cosmic/Dreamborne",
  },
} as const;

export const ROOT_CAUSE_ROUTE: Record<RootCause, string> = {
  KNOWLEDGE_GAP: "RESEARCH",
  BAD_SOURCE: "CURATION",
  BAD_CHUNK: "INGESTION",
  METADATA: "INGESTION",
  RETRIEVAL: "CODE_IMPROVEMENT",
  PROMPT: "CODE_IMPROVEMENT",
  RESPONSE_FORMATTING: "CODE_IMPROVEMENT",
  APPLICATION_CODE: "CODE_IMPROVEMENT",
  VALIDATOR_DEFECT: "HUMAN_REVIEW",
  UNKNOWN: "HUMAN_REVIEW",
};
