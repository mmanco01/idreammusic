import type {
  MuseIntelligenceResult,
} from "@/lib/muses/intelligence";
import type {
  MuseKnowledgeCitation,
  MuseKnowledgeRetrievalMetrics,
} from "@/lib/muses/knowledge-types";

export type MuseIqDifficulty =
  | "foundational"
  | "standard"
  | "advanced";

export type MuseIqBenchmark = {
  id: string;
  benchmark_key: string;
  version: string;
  muse_slug: string;
  capability: string;
  difficulty: MuseIqDifficulty;
  question: string;
  evaluation_mode:
    | "general"
    | "song_aware"
    | "collaboration";
  expected_concepts: string[];
  expected_source_titles: string[];
  disallowed_concepts: string[];
  minimum_expected_concepts: number;
  minimum_retrieved_count: number;
  minimum_cited_count: number;
  minimum_average_relevance: number | null;
  minimum_overall_score: number;
  weight_retrieval: number;
  weight_citation: number;
  weight_response: number;
  weight_structure: number;
};

export type MuseIqChatResponse = {
  status: "success" | "error";
  message?: string;
  mode?: "chat" | "collaborate";
  conversationId?: string | null;
  messageId?: string | null;
  reply?: string;
  intelligence?: MuseIntelligenceResult;
  knowledgeCitations?: MuseKnowledgeCitation[];
  knowledgeMetrics?: MuseKnowledgeRetrievalMetrics;
};

export type MuseIqScoreResult = {
  retrievalScore: number;
  citationScore: number;
  responseScore: number;
  structureScore: number;
  overallScore: number;
  passed: boolean;
  structureValid: boolean;
  citationKeysValid: boolean;
  citationMode:
    | "inline"
    | "separate"
    | "none";
  expectedConceptsFound: string[];
  expectedConceptsMissing: string[];
  failureCategories: string[];
  evaluatorNotes: string;
  benchmarkExplanation: string;
  evaluatorDetails: Record<string, unknown>;
};