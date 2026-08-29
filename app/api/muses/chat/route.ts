import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  getMuseBySlug,
  MUSE_OPTIONS,
} from "@/lib/muses";
import {
  MUSE_INTELLIGENCE_TEXT_FORMAT,
  parseMuseIntelligenceOutput,
  type MuseIntelligenceResult,
  type MuseMemoryCandidate,
} from "@/lib/muses/intelligence";
import {
  buildMuseContext,
  saveMuseContextSnapshot,
} from "@/lib/muses/context";
import {
  buildSongKnowledgeQuery,
  hydrateStoredCitation,
  resolveKnowledgeCitations,
  retrieveMuseKnowledge,
  saveMuseKnowledgeCitations,
} from "@/lib/muses/knowledge";
import type {
  MuseKnowledgeCitation,
  MuseKnowledgeCitationRequest,
  MuseKnowledgePromptItem,
  MuseKnowledgeRetrievalMetrics,
} from "@/lib/muses/knowledge-types";
import { getMusePlatformConfig } from "@/lib/muses/platform";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recordAIUsage } from "@/lib/ai/usage";
import {
  getAgentAdminClient,
  isAgentWorkerRequest,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

export const runtime = "nodejs";

type MuseChatMode = "chat" | "collaborate";

type MuseChatRequest = {
  mode?: unknown;
  museSlug?: unknown;
  message?: unknown;
  songId?: unknown;
  conversationId?: unknown;
  agentJobId?: unknown;
  originalQuestion?: unknown;
  primaryMuseSlug?: unknown;
  collaboratorMuseSlug?: unknown;
  primaryResponse?: unknown;
};

type MuseMemoryActionRequest = {
  memoryId?: unknown;
  status?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function citationKeysFromReply(
  reply: string,
): string[] {
  const keys: string[] = [];

  for (
    const bracketMatch of reply.matchAll(
      /\[([^\]]+)\]/g,
    )
  ) {
    const bracketContent =
      bracketMatch[1] ?? "";

    const bracketKeys =
      bracketContent.match(
        /\bK[1-9][0-9]?\b/g,
      ) ?? [];

    keys.push(...bracketKeys);
  }

  return Array.from(
    new Set(keys),
  );
}

function collectCitationText(
  value: unknown,
  output: string[],
) {
  if (typeof value === "string") {
    output.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCitationText(item, output);
    }
    return;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    for (
      const nested of Object.values(
        value as Record<string, unknown>,
      )
    ) {
      collectCitationText(
        nested,
        output,
      );
    }
  }
}

function citationTextFromResult(
  result: MuseIntelligenceResult,
): string {
  const output: string[] = [];

  collectCitationText(result, output);

  return output.join("\n");
}

function fallbackSupportedClaim({
  reply,
  citationKey,
  sourceTitle,
}: {
  reply: string;
  citationKey: string;
  sourceTitle: string;
}): string {
  const escapedKey =
    citationKey.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  const citationPattern =
    new RegExp(
      `\\[[^\\]]*\\b${escapedKey}\\b[^\\]]*\\]`,
      "i",
    );

  const citedLine =
    reply
      .split(/\n+/)
      .map((line) =>
        line.trim(),
      )
      .find((line) =>
        citationPattern.test(line),
      );

  const cleanedLine =
    citedLine
      ?.replace(
        /\[[^\]]+\]/g,
        "",
      )
      .replace(/\s+/g, " ")
      .trim();

  if (cleanedLine) {
    return cleanedLine.slice(
      0,
      500,
    );
  }

  return (
    `Supports the Muse response using the retrieved source "${sourceTitle}".`
  );
}

function reconcileKnowledgeCitationRequests({
  result,
  retrieved,
}: {
  result: MuseIntelligenceResult;
  retrieved: MuseKnowledgePromptItem[];
}): MuseKnowledgeCitationRequest[] {
  const retrievedByKey =
    new Map(
      retrieved.map((item) => [
        item.citationKey.toUpperCase(),
        item,
      ]),
    );

  const requestsByKey =
    new Map<
      string,
      MuseKnowledgeCitationRequest
    >();
  const citationText =
    citationTextFromResult(result);

  for (
    const request of
      result.knowledgeCitations ?? []
  ) {
    const citationKey =
      cleanString(
        request.citationKey,
        8,
      ).toUpperCase();

    const source =
      retrievedByKey.get(
        citationKey,
      );

    if (!source) {
      continue;
    }

    requestsByKey.set(
      citationKey,
      {
        citationKey,
        supportedClaim:
          cleanString(
            request.supportedClaim,
            500,
          ) ||
          fallbackSupportedClaim({
            reply: citationText,
            citationKey,
            sourceTitle:
              source.title,
          }),
      },
    );
  }

  // The model can cite a valid retrieved key in the prose or in
  // structured intelligence such as diagnostics and creative lenses.
  // Reconcile those keys so every displayed citation can resolve
  // to its exact retrieved source.
  for (
    const citationKey of
      citationKeysFromReply(
        citationText,
      )
  ) {
    if (
      requestsByKey.has(
        citationKey,
      )
    ) {
      continue;
    }

    const source =
      retrievedByKey.get(
        citationKey,
      );

    if (!source) {
      continue;
    }

    requestsByKey.set(
      citationKey,
      {
        citationKey,
        supportedClaim:
          fallbackSupportedClaim({
            reply: citationText,
            citationKey,
            sourceTitle:
              source.title,
          }),
      },
    );
  }

  return Array.from(
    requestsByKey.values(),
  );
}

const MEMORY_COMMITMENT_TYPES = new Set([
  "decision",
  "accepted_suggestion",
  "rejected_suggestion",
  "songwriter_preference",
  "lyric_choice",
  "form_choice",
]);

const MEMORY_STATUS_TEST_LANGUAGE =
  /\b(do not (?:label|treat|call)|unless i explicitly|not (?:my|a) preference|question to confirm|current (?:muse )?recommendation|memory-status test|regression test)\b/i;

const EXPLICIT_USER_COMMITMENT =
  /\b(?:i|we)\s+(?:prefer|want|choose|accept|approve|decide|decided|am keeping|are keeping|will keep|want to keep|would like to keep|do not want|don't want|never want|always want)\b|\blet'?s\s+(?:keep|use|choose|go with|preserve|avoid)\b|\bthat is my preference\b|\bgo with that\b/i;

const MEMORY_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "could",
  "from",
  "have",
  "into",
  "just",
  "later",
  "might",
  "more",
  "should",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "toward",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

function memoryTokens(
  value: unknown,
): Set<string> {
  if (typeof value !== "string") {
    return new Set();
  }

  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9'\s-]/g, " ")
      .split(/\s+/)
      .map((token) =>
        token.replace(/^'+|'+$/g, ""),
      )
      .filter(
        (token) =>
          token.length >= 4 &&
          !MEMORY_STOP_WORDS.has(token),
      ),
  );
}

function memoryOverlap(
  left: unknown,
  right: unknown,
): number {
  const leftTokens = memoryTokens(left);
  const rightTokens = memoryTokens(right);

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let shared = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.min(
    leftTokens.size,
    rightTokens.size,
  );
}

function hasAcceptedMemoryEvidence({
  memory,
  context,
}: {
  memory: MuseMemoryCandidate;
  context: any;
}): boolean {
  const acceptedMemories =
    Array.isArray(context?.acceptedMemories)
      ? context.acceptedMemories
      : [];

  const recordedDecisions =
    Array.isArray(context?.recordedDecisions)
      ? context.recordedDecisions
      : [];

  return (
    acceptedMemories.some(
      (accepted: any) =>
        memoryOverlap(
          memory.content,
          accepted?.content,
        ) >= 0.72,
    ) ||
    recordedDecisions.some(
      (decision: any) =>
        memoryOverlap(
          memory.content,
          decision?.decision_text,
        ) >= 0.72,
    )
  );
}

function hasExplicitCurrentUserCommitment({
  memory,
  currentUserMessage,
}: {
  memory: MuseMemoryCandidate;
  currentUserMessage: string;
}): boolean {
  if (
    !currentUserMessage ||
    MEMORY_STATUS_TEST_LANGUAGE.test(
      currentUserMessage,
    )
  ) {
    return false;
  }

  if (
    !EXPLICIT_USER_COMMITMENT.test(
      currentUserMessage,
    )
  ) {
    return false;
  }

  return (
    memoryOverlap(
      memory.content,
      currentUserMessage,
    ) >= 0.42
  );
}

function commitmentIsGrounded({
  memory,
  currentUserMessage,
  context,
}: {
  memory: MuseMemoryCandidate;
  currentUserMessage: string;
  context: any;
}): boolean {
  return (
    hasAcceptedMemoryEvidence({
      memory,
      context,
    }) ||
    hasExplicitCurrentUserCommitment({
      memory,
      currentUserMessage,
    })
  );
}

function unconfirmedMemoryType(
  memory: MuseMemoryCandidate,
): MuseMemoryCandidate["type"] {
  if (
    memory.type === "songwriter_preference" ||
    memory.type === "accepted_suggestion"
  ) {
    return "muse_recommendation";
  }

  return "question_to_confirm";
}

function normalizeMemoryCandidates({
  result,
  currentUserMessage,
  context,
}: {
  result: MuseIntelligenceResult;
  currentUserMessage: string;
  context: any;
}): MuseMemoryCandidate[] {
  return result.memoryCandidates
    .slice(0, 2)
    .map((memory) => {
      if (
        memory.type === "muse_recommendation" ||
        memory.type === "question_to_confirm"
      ) {
        return memory;
      }

      if (
        !MEMORY_COMMITMENT_TYPES.has(
          memory.type,
        )
      ) {
        return memory;
      }

      if (
        commitmentIsGrounded({
          memory,
          currentUserMessage,
          context,
        })
      ) {
        return memory;
      }

      return {
        ...memory,
        type: unconfirmedMemoryType(memory),
      };
    });
}

function buildKnowledgeMetrics({
  searchId,
  retrieved,
  cited,
  requestedCount,
}: {
  searchId: string | null;
  retrieved: MuseKnowledgePromptItem[];
  cited: MuseKnowledgeCitation[];
  requestedCount: number;
}): MuseKnowledgeRetrievalMetrics {
  const scores = retrieved
    .map((item) => item.relevanceScore)
    .filter((score) => Number.isFinite(score));

  return {
    requestedCount,
    retrievedCount: retrieved.length,
    citedCount: cited.length,
    averageRelevance: scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
    highestRelevance: scores.length
      ? Math.max(...scores)
      : null,
    searchId,
  };
}

async function getOwnedSong(
  supabase: any,
  songId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("songs")
    .select(
      "id, slug, title_working, title_final, owner_user_id",
    )
    .eq("id", songId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load the song: ${error.message}`,
    );
  }

  return data;
}

async function findConversation({
  supabase,
  userId,
  songId,
  museSlug,
  conversationId,
}: {
  supabase: any;
  userId: string;
  songId: string;
  museSlug: string;
  conversationId?: string;
}) {
  if (conversationId) {
    const { data, error } = await supabase
      .from("muse_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("owner_user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data;
    }
  }

  const { data, error } = await supabase
    .from("muse_conversations")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("song_id", songId)
    .eq("primary_muse_slug", museSlug)
    .eq("status", "active")
    .order("last_message_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function ensureConversation({
  supabase,
  userId,
  song,
  museSlug,
  conversationId,
}: {
  supabase: any;
  userId: string;
  song: any;
  museSlug: string;
  conversationId?: string;
}) {
  const existing = await findConversation({
    supabase,
    userId,
    songId: song.id,
    museSlug,
    conversationId,
  });

  if (existing) {
    return existing;
  }

  const title =
    song.title_final ||
    song.title_working ||
    "Untitled song";
  const muse = getMuseBySlug(museSlug);

  const { data, error } = await supabase
    .from("muse_conversations")
    .insert({
      owner_user_id: userId,
      song_id: song.id,
      primary_muse_slug: museSlug,
      title: `${title} with ${muse?.name ?? museSlug}`,
      status: "active",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Could not create the Muse conversation.",
    );
  }

  return data;
}

async function insertMessage({
  supabase,
  conversationId,
  ownerUserId,
  songId,
  museSlug,
  role,
  kind,
  content,
  questionText,
  comparisonWith,
  structuredResult,
  modelName,
}: {
  supabase: any;
  conversationId: string;
  ownerUserId: string;
  songId: string;
  museSlug?: string | null;
  role: "user" | "assistant" | "system";
  kind:
    | "primary"
    | "collaborator"
    | "synthesis"
    | "system";
  content: string;
  questionText?: string | null;
  comparisonWith?: string | null;
  structuredResult?: Record<string, unknown>;
  modelName?: string | null;
}) {
  const { data, error } = await supabase
    .from("muse_messages")
    .insert({
      conversation_id: conversationId,
      owner_user_id: ownerUserId,
      song_id: songId,
      muse_slug: museSlug ?? null,
      role,
      kind,
      content,
      question_text: questionText ?? null,
      comparison_with: comparisonWith ?? null,
      structured_result: structuredResult ?? {},
      model_name: modelName ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Could not save the Muse message.",
    );
  }

  return data;
}

async function saveMemoryCandidates({
  supabase,
  result,
  conversationId,
  userId,
  songId,
  museSlug,
  sourceMessageId,
}: {
  supabase: any;
  result: MuseIntelligenceResult;
  conversationId: string;
  userId: string;
  songId: string;
  museSlug: string;
  sourceMessageId: string;
}) {
  if (!result.memoryCandidates.length) {
    return [];
  }

  const rows = result.memoryCandidates.map(
    (memory) => ({
      conversation_id: conversationId,
      owner_user_id: userId,
      song_id: songId,
      muse_slug: museSlug,
      memory_type: memory.type,
      content: memory.content,
      reason: memory.reason,
      importance: memory.importance,
      confidence: memory.confidence,
      status: "proposed",
      source_message_id: sourceMessageId,
    }),
  );

  const { data, error } = await supabase
    .from("muse_memories")
    .insert(rows)
    .select(
      "id, memory_type, content, reason, importance, confidence, status, source_message_id",
    );

  if (error) {
    console.error(
      "Unable to save Muse memory candidates:",
      error.message,
    );

    return [];
  }

  return data ?? [];
}

async function saveUnresolvedQuestions({
  supabase,
  result,
  conversationId,
  userId,
  songId,
  songVersionId,
  museSlug,
  sourceMessageId,
}: {
  supabase: any;
  result: MuseIntelligenceResult;
  conversationId: string;
  userId: string;
  songId: string;
  songVersionId?: string | null;
  museSlug: string;
  sourceMessageId: string;
}) {
  if (!result.unresolvedQuestions.length) {
    return;
  }

  const { data: existing } = await supabase
    .from("muse_unresolved_questions")
    .select("question")
    .eq("owner_user_id", userId)
    .eq("song_id", songId)
    .eq("muse_slug", museSlug)
    .eq("status", "open");

  const existingQuestions = new Set(
    (existing ?? []).map((row: any) =>
      String(row.question)
        .trim()
        .toLowerCase(),
    ),
  );

  const rows = result.unresolvedQuestions
    .filter(
      (question) =>
        !existingQuestions.has(
          question.trim().toLowerCase(),
        ),
    )
    .map((question) => ({
      conversation_id: conversationId,
      owner_user_id: userId,
      song_id: songId,
      song_version_id: songVersionId ?? null,
      muse_slug: museSlug,
      question,
      priority: 3,
      status: "open",
      source_message_id: sourceMessageId,
    }));

  if (!rows.length) {
    return;
  }

  const { error } = await supabase
    .from("muse_unresolved_questions")
    .insert(rows);

  if (error) {
    console.error(
      "Unable to save unresolved Muse questions:",
      error.message,
    );
  }
}

async function saveDiagnosticFindings({
  supabase,
  result,
  conversationId,
  messageId,
  userId,
  songId,
  songVersionId,
  museSlug,
}: {
  supabase: any;
  result: MuseIntelligenceResult;
  conversationId: string;
  messageId: string;
  userId: string;
  songId: string;
  songVersionId?: string | null;
  museSlug: string;
}) {
  if (!result.diagnostics.length) {
    return;
  }

  const rows = result.diagnostics.map(
    (diagnostic) => ({
      conversation_id: conversationId,
      message_id: messageId,
      owner_user_id: userId,
      song_id: songId,
      song_version_id: songVersionId ?? null,
      muse_slug: museSlug,
      diagnostic_key: diagnostic.key,
      diagnostic_label: diagnostic.label,
      score: diagnostic.score,
      finding: diagnostic.finding,
      evidence: diagnostic.evidence,
      confidence: diagnostic.confidence,
      change_direction:
        diagnostic.changeFromPrevious,
    }),
  );

  const { error } = await supabase
    .from("muse_diagnostic_findings")
    .upsert(rows, {
      onConflict: "message_id,diagnostic_key",
    });

  if (error) {
    console.error(
      "Unable to save Muse diagnostic findings:",
      error.message,
    );
  }
}

async function updateConversationState({
  supabase,
  conversationId,
  context,
}: {
  supabase: any;
  conversationId: string;
  context: any;
}) {
  const { error } = await supabase
    .from("muse_conversations")
    .update({
      current_song_version_id:
        context.currentVersion?.id ?? null,
      current_transcript_id:
        context.latestTranscript?.id ?? null,
      current_analysis_run_id:
        context.latestAnalysis?.id ?? null,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) {
    console.error(
      "Unable to update Muse conversation state:",
      error.message,
    );
  }
}

async function promoteAcceptedMemoryToDecision({
  supabase,
  memory,
  userId,
}: {
  supabase: any;
  memory: any;
  userId: string;
}) {
  const promotableTypes = new Set([
    "decision",
    "accepted_suggestion",
    "rejected_suggestion",
    "songwriter_preference",
    "muse_recommendation",
    "lyric_choice",
    "form_choice",
  ]);

  if (!promotableTypes.has(memory.memory_type)) {
    return null;
  }

  const { data: conversation } = await supabase
    .from("muse_conversations")
    .select("current_song_version_id")
    .eq("id", memory.conversation_id)
    .eq("owner_user_id", userId)
    .maybeSingle();

  const { data: existing } = await supabase
    .from("muse_creative_decisions")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("song_id", memory.song_id)
    .eq("source_message_id", memory.source_message_id)
    .eq("decision_text", memory.content)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const status =
    memory.memory_type === "rejected_suggestion"
      ? "rejected"
      : "accepted";

  const decisionTypeByMemory: Record<string, string> = {
    decision: "creative",
    accepted_suggestion: "accepted_idea",
    rejected_suggestion: "rejected_idea",
    songwriter_preference: "preference",
    muse_recommendation: "accepted_idea",
    lyric_choice: "lyric",
    form_choice: "form",
  };

  const { data, error } = await supabase
    .from("muse_creative_decisions")
    .insert({
      conversation_id: memory.conversation_id,
      owner_user_id: userId,
      song_id: memory.song_id,
      song_version_id:
        conversation?.current_song_version_id ?? null,
      muse_slug: memory.muse_slug,
      decision_type:
        decisionTypeByMemory[memory.memory_type] ??
        "creative",
      decision_text: memory.content,
      reason: memory.reason,
      status,
      source_message_id: memory.source_message_id,
      decided_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error(
      "Unable to promote accepted Muse memory to a creative decision:",
      error.message,
    );

    return null;
  }

  return data;
}

function makeStructuredPrompt({
  context,
  question,
  museName,
  museDomain,
  mode,
  primaryMuseName,
  primaryMuseDomain,
  primaryResponse,
}: {
  context: unknown;
  question: string;
  museName: string;
  museDomain: string;
  mode: MuseChatMode;
  primaryMuseName?: string;
  primaryMuseDomain?: string;
  primaryResponse?: string;
}) {
  const collaborationSection =
    mode === "collaborate"
      ? `
The songwriter originally asked:

${question}

${primaryMuseName}, Muse of ${primaryMuseDomain}, responded:

${primaryResponse}

You are joining as ${museName}, Muse of ${museDomain}.
Give a genuinely different second perspective. Do not merely agree,
summarize, or restate the first Muse. Explain what your specialty notices
that the first Muse may not emphasize.

In the reply field, end with the exact heading:
"How my perspective differs from ${primaryMuseName}"
and explain the distinction in two to four sentences.
`
      : `
The songwriter says:

${question}

Respond as ${museName}, Muse of ${museDomain}.
`;

  return `
Here is the current private iDreamMusic context:

${JSON.stringify(context, null, 2)}

${collaborationSection}

Return the required structured Muse intelligence result.

Guidance for the structured fields:
- reply: the complete graceful response shown to the songwriter.
- primaryObservation: the single most important grounded observation.
  Its category should normally match one of your named diagnostic keys.
- diagnostics: assess each named diagnostic area that can be grounded in
  the supplied material, up to five areas. Give a 0ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ100 working score,
  evidence, confidence, and changeFromPrevious. Use unknown when there is
  no trustworthy earlier diagnostic comparison.
- lensAssessments: separately assess lyric, form, melody, performance, and
  audience. Use null when the supplied material does not support that lens.
  Never infer melody or performance from lyrics alone.
- versionComparison: include only when at least two song versions are
  available. Identify meaningful changes and elements worth protecting.
- recommendations: no more than three focused recommendations.
- unresolvedQuestions: questions worth carrying into a future session.
- memoryCandidates: return no more than two. Preserve the source and
  confirmation status honestly:
  - muse_recommendation: a current Muse recommendation the songwriter has
    not explicitly accepted;
  - question_to_confirm: a possible preference, choice, decision, rejection,
    or boundary that still requires the songwriter's confirmation;
  - songwriter_preference: use only when the songwriter explicitly stated
    or accepted the preference in the current message, an accepted memory,
    or a recorded decision;
  - decision, accepted_suggestion, rejected_suggestion, lyric_choice, and
    form_choice: use only when explicit songwriter commitment is present;
  - unresolved_question and next_step: may be used without commitment.
  Never convert a Muse recommendation into a songwriter preference.
  The server will conservatively downgrade unsupported commitment labels.
- proposedTask: include only when one concrete task would clearly help.
- suggestedCollaborator: include only when another Muse has a specific,
  distinct contribution tied to a detected need.
- lyricWork: include only when analyzing existing lyrics, transcription, or
  comparing songwriter-provided lyric alternatives. likelyLyric must be exact
  language already present in supplied lyrics, transcript, or writer notes;
  otherwise use null. suggestedLines may quote only songwriter-provided
  language and must use transcript, existing_lyric, or writer_note as the
  source. Never generate new lyric language or use muse_suggestion for a new
  response.
- formWork: include only when structure is central to the question or finding.
- knowledgeCitations: include every supplied knowledge citation key actually
  used in the reply or structured findings, with a brief supportedClaim.
  Use no more than five keys and leave the array empty when no library source
  was used. Before returning, verify that every bracketed citation key used
  anywhere in the reply appears exactly once in knowledgeCitations.
- When relying on a library item, place its key immediately after the supported
  statement in the reply, such as [K1]. Never invent or alter a citation key.
  Do not cite a key in the reply unless it is also present in knowledgeCitations.
- Treat primary texts, material artifacts, institutional histories, scholarly
  references, editorial syntheses, and personal sources as distinct evidence.
  Do not present editorial synthesis or later reception as ancient fact.
- Ground evidence in the supplied context. Never invent audio evidence.
- Distinguish transcript, existing lyrics, writer notes, analysis, accepted
  decisions, and new Muse suggestions.
- Scores are directional creative judgments, not objective grades.
- Keep the entire structured result concise enough to complete reliably:
  - reply: no more than 450 words;
  - each diagnostic finding: no more than 55 words;
  - each evidence item: no more than 20 words;
  - each lens summary: no more than 70 words;
  - each lens strength or risk: no more than 18 words;
  - each nextMove: no more than 35 words;
  - each recommendation reasoning: no more than 55 words;
  - version comparison summary: no more than 80 words;
  - lyric and form reasoning: no more than 90 words.
- Return only the structured response. Do not add markdown fences,
  commentary before the JSON, or commentary after it.
  `.trim();
}

function mapHistoryMessages(
  messages: any[],
  memories: any[],
  taskActions: any[],
  citations: any[],
) {
  const memoriesByMessage = new Map<string, any[]>();
  const taskActionByMessage = new Map<string, any>();
  const citationsByMessage =
    new Map<string, MuseKnowledgeCitation[]>();

  for (const memory of memories) {
    if (!memory.source_message_id) {
      continue;
    }

    const current =
      memoriesByMessage.get(
        memory.source_message_id,
      ) ?? [];

    current.push(memory);

    memoriesByMessage.set(
      memory.source_message_id,
      current,
    );
  }

  for (const action of taskActions) {
    taskActionByMessage.set(
      action.source_message_id,
      {
        status: action.status,
        taskId: action.task_id,
      },
    );
  }

  for (const citation of citations) {
    const current =
      citationsByMessage.get(
        citation.message_id,
      ) ?? [];

    current.push(
      hydrateStoredCitation(citation),
    );

    citationsByMessage.set(
      citation.message_id,
      current,
    );
  }

  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    museSlug: message.muse_slug,
    kind: message.kind,
    question: message.question_text,
    comparisonWith: message.comparison_with,
    createdAt: message.created_at,
    structuredResult: message.structured_result,
    memories:
      memoriesByMessage.get(message.id) ?? [],
    taskAction:
      taskActionByMessage.get(message.id) ?? null,
    knowledgeCitations:
      citationsByMessage.get(message.id) ?? [],
  }));
}

type OpenAIResponseMetadata = {
  status?: string | null;
  incomplete_details?: {
    reason?: string | null;
  } | null;
};

function responseFailureDetail(
  response: OpenAIResponseMetadata,
) {
  const status =
    response.status ?? "unknown";

  const reason =
    response.incomplete_details?.reason ??
    "not provided";

  return `status=${status}; incomplete_reason=${reason}`;
}

function shouldRetryMuseResponse(
  error: unknown,
) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error
      ? Number(
          (error as { status?: unknown })
            .status,
        )
      : null;

  if (
    status !== null &&
    Number.isFinite(status) &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 409 &&
    status !== 429
  ) {
    return false;
  }

  return true;
}

async function createMuseResponse({
  openai,
  model,
  muse,
  prompt,
  telemetry,
}: {
  openai: OpenAI;
  model: string;
  muse: NonNullable<
    ReturnType<typeof getMuseBySlug>
  >;
  prompt: string;
  telemetry?: {
    supabase: any;
    userId?: string | null;
    songId?: string | null;
    conversationId?: string | null;
    mode: MuseChatMode;
    role: string;
  };
}) {
  const attempts = [
    {
      maxOutputTokens: 5600,
      extraInstruction: "",
    },
    {
      maxOutputTokens: 8000,
      extraInstruction: `
IMPORTANT RETRY:
The previous attempt was incomplete or malformed.
Return a fresh, complete structured result from the beginning.
Be concise. Do not repeat yourself. Do not use markdown fences.
Every required property must be present, and the JSON must close cleanly.
      `.trim(),
    },
  ];

  let lastError: unknown = null;

  for (
    let attemptIndex = 0;
    attemptIndex < attempts.length;
    attemptIndex += 1
  ) {
    const attempt =
      attempts[attemptIndex];

    const openAIStartedAt = Date.now();
    try {
      const response =
        await openai.responses.create({
          model,
          instructions:
            muse.systemPrompt,
          input: attempt.extraInstruction
            ? `${prompt}\n\n${attempt.extraInstruction}`
            : prompt,
          text: {
            format:
              MUSE_INTELLIGENCE_TEXT_FORMAT as any,
          },
          max_output_tokens:
            attempt.maxOutputTokens,
          store: false,
        });
      const metadata =
        response as OpenAIResponseMetadata;

      if (telemetry) {
        await recordAIUsage({
          supabase: telemetry.supabase,
          activityType: "talk_to_muse",
          operation: "structured_response",
          model: response.model ?? model,
          responseId: response.id,
          usage: response.usage,
          userId: telemetry.userId ?? null,
          songId: telemetry.songId ?? null,
          conversationId: telemetry.conversationId ?? null,
          durationMs: Date.now() - openAIStartedAt,
          status: metadata.status ?? "completed",
          metadata: {
            muse_slug: muse.slug,
            muse_name: muse.name,
            mode: telemetry.mode,
            role: telemetry.role,
            attempt: attemptIndex + 1,
            max_output_tokens: attempt.maxOutputTokens,
          },
        });
      }
      if (
        metadata.status === "incomplete"
      ) {
        throw new Error(
          `${muse.name}'s structured response was incomplete (${responseFailureDetail(
            metadata,
          )}).`,
        );
      }

      const outputText =
        response.output_text?.trim();

      if (!outputText) {
        throw new Error(
          `${muse.name} did not return structured response text (${responseFailureDetail(
            metadata,
          )}).`,
        );
      }

      return parseMuseIntelligenceOutput(
        outputText,
      );
    } catch (error) {
      lastError = error;

      const isLastAttempt =
        attemptIndex ===
        attempts.length - 1;

      if (
        isLastAttempt ||
        !shouldRetryMuseResponse(error)
      ) {
        break;
      }

      console.warn(
        `Retrying ${muse.name} structured response after attempt ${
          attemptIndex + 1
        }:`,
        error,
      );
    }
  }

  const detail =
    lastError instanceof Error
      ? lastError.message
      : "Unknown structured response error.";

  throw new Error(
    `${muse.name}'s full creative-lens analysis could not be completed because the structured result was cut off or malformed after two attempts. ${detail}`,
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const songId = cleanString(
      url.searchParams.get("songId"),
      100,
    );
    const museSlug = cleanString(
      url.searchParams.get("museSlug"),
      50,
    );
    const scope = cleanString(
      url.searchParams.get("scope"),
      30,
    );
    const isCouncilRequest = scope === "council";

    if (
      !songId ||
      (!isCouncilRequest && !museSlug)
    ) {
      return NextResponse.json({
        status: "success",
        conversation: null,
        messages: [],
        councilEntries: [],
      });
    }

    const muse = isCouncilRequest
      ? null
      : getMuseBySlug(museSlug);

    if (!isCouncilRequest && !muse) {
      return NextResponse.json(
        {
          status: "error",
          message: "Unsupported Muse.",
        },
        { status: 400 },
      );
    }

    const supabase =
      await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Supabase is not available.",
        },
        { status: 500 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Please sign in to load this Muse conversation.",
        },
        { status: 401 },
      );
    }

    const song = await getOwnedSong(
      supabase,
      songId,
      user.id,
    );

    if (!song) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "The song was not found or does not belong to you.",
        },
        { status: 404 },
      );
    }

    if (isCouncilRequest) {
      const { data: conversations, error: conversationError } =
        await (supabase as any)
          .from("muse_conversations")
          .select("id, primary_muse_slug, last_message_at")
          .eq("owner_user_id", user.id)
          .eq("song_id", songId)
          .eq("status", "active")
          .order("last_message_at", { ascending: false });

      if (conversationError) {
        throw new Error(conversationError.message);
      }

      const conversationIds = (conversations ?? []).map(
        (conversation: any) => conversation.id,
      );

      if (!conversationIds.length) {
        return NextResponse.json({
          status: "success",
          councilEntries: [],
        });
      }

      const conversationMuseById = new Map(
        (conversations ?? []).map((conversation: any) => [
          conversation.id,
          conversation.primary_muse_slug,
        ]),
      );

      const { data: councilMessages, error: councilMessageError } =
        await (supabase as any)
          .from("muse_messages")
          .select(
            "id, conversation_id, role, kind, muse_slug, content, question_text, comparison_with, structured_result, created_at",
          )
          .in("conversation_id", conversationIds)
          .eq("role", "assistant")
          .order("created_at", { ascending: false });

      if (councilMessageError) {
        throw new Error(councilMessageError.message);
      }

      const latestByMuse = new Map<string, any>();

      for (const message of councilMessages ?? []) {
        const messageMuseSlug =
          message.muse_slug ||
          conversationMuseById.get(message.conversation_id);
        const messageMuse = getMuseBySlug(messageMuseSlug);

        if (
          !messageMuse ||
          latestByMuse.has(messageMuse.slug)
        ) {
          continue;
        }

        latestByMuse.set(messageMuse.slug, {
          id: message.id,
          museSlug: messageMuse.slug,
          museName: messageMuse.name,
          domain: messageMuse.domain,
          kind: message.kind,
          content: message.content,
          question: message.question_text,
          comparisonWith: message.comparison_with,
          structuredResult: message.structured_result,
          createdAt: message.created_at,
        });
      }

      return NextResponse.json({
        status: "success",
        councilEntries: Array.from(latestByMuse.values()),
      });
    }

    const conversation =
      await findConversation({
        supabase,
        userId: user.id,
        songId,
        museSlug: muse!.slug,
      });

    if (!conversation) {
      return NextResponse.json({
        status: "success",
        conversation: null,
        messages: [],
      });
    }

    const [
      messageResult,
      memoryResult,
      taskActionResult,
      citationResult,
    ] = await Promise.all([
      (supabase as any)
        .from("muse_messages")
        .select(
          "id, role, kind, muse_slug, content, question_text, comparison_with, structured_result, created_at",
        )
        .eq(
          "conversation_id",
          conversation.id,
        )
        .order("created_at", {
          ascending: true,
        }),

      (supabase as any)
        .from("muse_memories")
        .select(
          "id, memory_type, content, reason, importance, confidence, status, source_message_id",
        )
        .eq(
          "conversation_id",
          conversation.id,
        )
        .order("created_at", {
          ascending: true,
        }),

      (supabase as any)
        .from("muse_task_actions")
        .select(
          "source_message_id, status, task_id",
        )
        .eq(
          "conversation_id",
          conversation.id,
        ),

      (supabase as any)
        .from(
          "muse_message_knowledge_citations",
        )
        .select(`
          message_id,
          source_id,
          chunk_id,
          citation_key,
          claim_summary,
          relevance_score,
          muse_knowledge_sources (
            source_key,
            source_type,
            title,
            author_creator,
            editor_translator,
            tradition,
            historical_period,
            publication_year,
            canonical_url,
            bibliographic_citation,
            source_locator,
            evidence_classification,
            rights_status,
            verification_status,
            source_quality
          ),
          muse_knowledge_chunks (
            heading,
            source_locator,
            citation_text
          )
        `)
        .eq(
          "conversation_id",
          conversation.id,
        )
        .order("citation_key", {
          ascending: true,
        }),
    ]);

    if (messageResult.error) {
      throw new Error(
        messageResult.error.message,
      );
    }

    if (memoryResult.error) {
      throw new Error(
        memoryResult.error.message,
      );
    }

    if (taskActionResult.error) {
      throw new Error(
        taskActionResult.error.message,
      );
    }

    if (citationResult.error) {
      throw new Error(
        citationResult.error.message,
      );
    }

    return NextResponse.json({
      status: "success",
      conversation: {
        id: conversation.id,
        title: conversation.title,
        museSlug:
          conversation.primary_muse_slug,
        lastMessageAt:
          conversation.last_message_at,
      },
      messages: mapHistoryMessages(
        messageResult.data ?? [],
        memoryResult.data ?? [],
        taskActionResult.data ?? [],
        citationResult.data ?? [],
      ),
    });
  } catch (error) {
    console.error(
      "Muse chat history error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The Muse conversation could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
) {
  try {
    const url = new URL(request.url);
    const conversationId = cleanString(
      url.searchParams.get(
        "conversationId",
      ),
      100,
    );

    if (!conversationId) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "A conversation ID is required.",
        },
        { status: 400 },
      );
    }

    const supabase =
      await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Supabase is not available.",
        },
        { status: 500 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Please sign in to archive this Muse conversation.",
        },
        { status: 401 },
      );
    }

    const { error } = await (
      supabase as any
    )
      .from("muse_conversations")
      .update({
        status: "archived",
      })
      .eq("id", conversationId)
      .eq("owner_user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      status: "success",
    });
  } catch (error) {
    console.error(
      "Muse conversation archive error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The Muse conversation could not be archived.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body =
      (await request.json()) as MuseMemoryActionRequest;

    const memoryId = cleanString(
      body.memoryId,
      100,
    );
    const nextStatus = cleanString(
      body.status,
      30,
    );

    if (!memoryId) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "A Muse memory ID is required.",
        },
        { status: 400 },
      );
    }

    if (
      nextStatus !== "accepted" &&
      nextStatus !== "rejected"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Memory status must be accepted or rejected.",
        },
        { status: 400 },
      );
    }

    const supabase =
      await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Supabase is not available.",
        },
        { status: 500 },
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "Muse memory authentication error:",
        authError,
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Please sign in to manage Muse memory.",
        },
        { status: 401 },
      );
    }

    const {
      data: existingMemory,
      error: lookupError,
    } = await (supabase as any)
      .from("muse_memories")
      .select(
        "id, conversation_id, owner_user_id, song_id, muse_slug, memory_type, content, reason, importance, confidence, status, source_message_id",
      )
      .eq("id", memoryId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        `Could not load the proposed memory: ${lookupError.message}`,
      );
    }

    if (!existingMemory) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "This proposed memory could not be found. Refresh the page and try again.",
        },
        { status: 404 },
      );
    }

    const { data, error } = await (
      supabase as any
    )
      .from("muse_memories")
      .update({
        status: nextStatus,
        last_referenced_at:
          nextStatus === "accepted"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", memoryId)
      .eq("owner_user_id", user.id)
      .select(
        "id, memory_type, content, reason, importance, confidence, status",
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not update the proposed memory: ${error.message}`,
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "The proposed memory was not updated. Refresh the page and try again.",
        },
        { status: 409 },
      );
    }

    const promotedDecision =
      nextStatus === "accepted"
        ? await promoteAcceptedMemoryToDecision({
            supabase,
            memory: existingMemory,
            userId: user.id,
          })
        : null;

    return NextResponse.json({
      status: "success",
      memory: data,
      promotedDecisionId:
        promotedDecision?.id ?? null,
    });
  } catch (error) {
    console.error(
      "Muse memory update error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The Muse memory could not be updated.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "OPENAI_API_KEY is not configured.",
        },
        { status: 500 },
      );
    }

    const body =
      (await request.json()) as MuseChatRequest;

    const agentJobId =
      cleanString(
        body.agentJobId,
        100,
      );

    let candidateKnowledgeSupabase:
      any = null;

if (agentJobId) {
  if (
    !isAgentWorkerRequest(
      request,
    )
  ) {
    try {
      await requireAgentAdmin(
        request,
      );
    } catch {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Candidate Muse validation requires Agent admin access.",
        },
        { status: 403 },
      );
    }
  }

  candidateKnowledgeSupabase =
    getAgentAdminClient();
}

    const mode: MuseChatMode =
      body.mode === "collaborate"
        ? "collaborate"
        : "chat";

    const songId = cleanString(
      body.songId,
      100,
    );
    const conversationId = cleanString(
      body.conversationId,
      100,
    );
    const message = cleanString(
      body.message,
      16000,
    );
    const originalQuestion = cleanString(
      body.originalQuestion,
      8000,
    );
    const primaryResponse = cleanString(
      body.primaryResponse,
      24000,
    );
    const primaryMuseSlug = cleanString(
      body.primaryMuseSlug,
      50,
    );

    const requestedMuseSlug =
      mode === "collaborate"
        ? cleanString(
            body.collaboratorMuseSlug,
            50,
          )
        : cleanString(
            body.museSlug,
            50,
          );

    const muse = getMuseBySlug(
      requestedMuseSlug,
    );

    if (!muse) {
      return NextResponse.json(
        {
          status: "error",
          message: `Unsupported Muse. Available Muses: ${MUSE_OPTIONS.map(
            (option) => option.name,
          ).join(", ")}.`,
        },
        { status: 400 },
      );
    }

    const musePlatform =
      getMusePlatformConfig(muse.slug);

    let primaryMuse:
      | ReturnType<
          typeof getMuseBySlug
        >
      | null = null;

    if (mode === "collaborate") {
      primaryMuse = getMuseBySlug(
        primaryMuseSlug,
      );

      if (!primaryMuse) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "The primary Muse could not be identified.",
          },
          { status: 400 },
        );
      }

      if (primaryMuse.slug === muse.slug) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "Choose a different Muse for collaboration.",
          },
          { status: 400 },
        );
      }

      if (
        !originalQuestion ||
        !primaryResponse
      ) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "The original question and first Muse response are required for collaboration.",
          },
          { status: 400 },
        );
      }
    } else if (!message) {
      return NextResponse.json(
        {
          status: "error",
          message: `Please enter a message for ${muse.name}.`,
        },
        { status: 400 },
      );
    }

    const supabase =
      await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Supabase is not available.",
        },
        { status: 500 },
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "Muse chat authentication error:",
        authError,
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const model =
      process.env.OPENAI_MUSE_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-5-mini";

    const question =
      mode === "collaborate"
        ? originalQuestion
        : message;

    if (!songId) {
      const context = {
        selectedMuse: {
          slug: muse.slug,
          name: muse.name,
          domain: muse.domain,
          role:
            mode === "collaborate"
              ? "collaborator"
              : "primary",
        },
        song: null,
        acceptedMemories: [],
        recordedDecisions: [],
        unresolvedQuestions: [],
        changesSinceLastSession: [],
        previousDiagnostics: [],
        knowledge: [] as MuseKnowledgePromptItem[],
      };

      let knowledgeSearch: {
        searchId: string | null;
        results: MuseKnowledgePromptItem[];
      } = {
        searchId: null,
        results: [],
      };

      if (musePlatform.knowledgeEnabled) {
        knowledgeSearch =
          await retrieveMuseKnowledge({
            supabase:
              candidateKnowledgeSupabase ??
              supabase,

            openai,

            query: question,

            museSlug: muse.slug,

            agentJobId:
              agentJobId || null,

            ownerUserId:
              user?.id ?? null,

            queryContext:
              agentJobId
                ? `Agent candidate validation ${agentJobId}`
                : "General Muse conversation",

            matchCount:
              musePlatform.generalRetrievalCount,

            logSearch:
              agentJobId
                ? false
                : Boolean(user?.id),
          });

        context.knowledge =
          knowledgeSearch.results;
      }

      const prompt = makeStructuredPrompt({
        context,
        question,
        museName: muse.name,
        museDomain: muse.domain,
        mode,
        primaryMuseName:
          primaryMuse?.name,
        primaryMuseDomain:
          primaryMuse?.domain,
        primaryResponse,
      });

      const result =
        await createMuseResponse({
          openai,
          model,
          muse,
          prompt,
          telemetry: {
            supabase,
            userId: user?.id ?? null,
            songId: null,
            conversationId: null,
            mode,
            role:
              mode === "collaborate"
                ? "collaborator"
                : "primary",
          },
        });

      result.memoryCandidates =
        normalizeMemoryCandidates({
          result,
          currentUserMessage: question,
          context,
        });

      const citationRequests =
        reconcileKnowledgeCitationRequests({
          result,
          retrieved:
            knowledgeSearch.results,
        });

      result.knowledgeCitations =
        citationRequests;

      const knowledgeCitations =
        resolveKnowledgeCitations({
          requests:
            citationRequests,
          retrieved:
            knowledgeSearch.results,
        });

      const knowledgeMetrics =
        buildKnowledgeMetrics({
          searchId: knowledgeSearch.searchId,
          retrieved: knowledgeSearch.results,
          cited: knowledgeCitations,
          requestedCount: musePlatform.generalRetrievalCount,
        });

      return NextResponse.json({
        status: "success",
        mode,
        conversationId: null,
        messageId: null,
        muse: {
          slug: muse.slug,
          name: muse.name,
          domain: muse.domain,
          isPrimaryMuse: false,
        },
        primaryMuse: primaryMuse
          ? {
              slug: primaryMuse.slug,
              name: primaryMuse.name,
              domain: primaryMuse.domain,
            }
          : null,
        song: null,
        reply: result.reply,
        intelligence: result,
        memories: [],
        taskAction: null,
        knowledgeCitations,
        knowledgeMetrics,
      });
    }

    if (!user) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Please sign in before discussing a saved song.",
        },
        { status: 401 },
      );
    }

    const song = await getOwnedSong(
      supabase,
      songId,
      user.id,
    );

    if (!song) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "The song was not found or does not belong to you.",
        },
        { status: 404 },
      );
    }

    const conversationMuseSlug =
      mode === "collaborate" && primaryMuse
        ? primaryMuse.slug
        : muse.slug;

    const conversation =
      await ensureConversation({
        supabase,
        userId: user.id,
        song,
        museSlug: conversationMuseSlug,
        conversationId:
          conversationId || undefined,
      });

    const isPrimaryMuse =
      conversation.primary_muse_slug ===
      muse.slug;

    const role =
      mode === "collaborate"
        ? "collaborator"
        : isPrimaryMuse
          ? "primary"
          : "specialist";

    const context = await buildMuseContext({
      supabase,
      userId: user.id,
      songId,
      conversationId: conversation.id,
      muse,
      role,
    });

    if (!context) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "The song context could not be loaded.",
        },
        { status: 404 },
      );
    }

    let knowledgeSearch: {
      searchId: string | null;
      results: MuseKnowledgePromptItem[];
    } = {
      searchId: null,
      results: [],
    };

    if (musePlatform.knowledgeEnabled) {
      knowledgeSearch =
        await retrieveMuseKnowledge({
          supabase:
            candidateKnowledgeSupabase ??
            supabase,

          openai,

          query:
            buildSongKnowledgeQuery({
              question,
              context,
            }),

          museSlug:
            muse.slug,

          agentJobId:
            agentJobId || null,

          ownerUserId:
            user.id,

          songId,

          conversationId:
            conversation.id,

          queryContext:
            agentJobId
              ? `Agent candidate validation ${agentJobId}`
              : `Song-aware retrieval for ${
                  context.song?.title ??
                  "saved song"
                }`,

          matchCount:
            musePlatform.songRetrievalCount,

          logSearch:
            !agentJobId,
        });

      context.knowledge =
        knowledgeSearch.results;
    }

    if (mode === "chat") {
      await insertMessage({
        supabase,
        conversationId: conversation.id,
        ownerUserId: user.id,
        songId,
        museSlug: null,
        role: "user",
        kind: "primary",
        content: message,
        questionText: message,
      });
    }

    const prompt = makeStructuredPrompt({
      context,
      question,
      museName: muse.name,
      museDomain: muse.domain,
      mode,
      primaryMuseName:
        primaryMuse?.name,
      primaryMuseDomain:
        primaryMuse?.domain,
      primaryResponse,
    });

    const result =
      await createMuseResponse({
        openai,
        model,
        muse,
        prompt,
      });

    result.memoryCandidates =
      normalizeMemoryCandidates({
        result,
        currentUserMessage: question,
        context,
      });

    const citationRequests =
      reconcileKnowledgeCitationRequests({
        result,
        retrieved:
          knowledgeSearch.results,
      });

    result.knowledgeCitations =
      citationRequests;

    const assistantMessage =
      await insertMessage({
        supabase,
        conversationId: conversation.id,
        ownerUserId: user.id,
        songId,
        museSlug: muse.slug,
        role: "assistant",
        kind:
          mode === "collaborate"
            ? "collaborator"
            : "primary",
        content: result.reply,
        questionText: question,
        comparisonWith:
          mode === "collaborate"
            ? primaryMuse?.name ?? null
            : null,
        structuredResult:
          result as unknown as Record<
            string,
            unknown
          >,
        modelName: model,
      });

    const knowledgeCitations =
      resolveKnowledgeCitations({
        requests:
          citationRequests,
        retrieved:
          knowledgeSearch.results,
      });

    const knowledgeMetrics =
      buildKnowledgeMetrics({
        searchId: knowledgeSearch.searchId,
        retrieved: knowledgeSearch.results,
        cited: knowledgeCitations,
        requestedCount: musePlatform.songRetrievalCount,
      });

    await saveMuseKnowledgeCitations({
      supabase,
      citations:
        knowledgeCitations,
      ownerUserId: user.id,
      songId,
      conversationId:
        conversation.id,
      messageId:
        assistantMessage.id,
      searchId:
        knowledgeSearch.searchId,
    });

    const memories =
      await saveMemoryCandidates({
        supabase,
        result,
        conversationId: conversation.id,
        userId: user.id,
        songId,
        museSlug: muse.slug,
        sourceMessageId:
          assistantMessage.id,
      });

    await Promise.all([
      saveUnresolvedQuestions({
        supabase,
        result,
        conversationId: conversation.id,
        userId: user.id,
        songId,
        songVersionId:
          context.currentVersion?.id ?? null,
        museSlug: muse.slug,
        sourceMessageId:
          assistantMessage.id,
      }),

      saveDiagnosticFindings({
        supabase,
        result,
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        userId: user.id,
        songId,
        songVersionId:
          context.currentVersion?.id ?? null,
        museSlug: muse.slug,
      }),

      updateConversationState({
        supabase,
        conversationId: conversation.id,
        context,
      }),

      saveMuseContextSnapshot({
        supabase,
        userId: user.id,
        conversationId: conversation.id,
        museSlug: muse.slug,
        context,
      }),
    ]);

    return NextResponse.json({
      status: "success",
      mode,
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      muse: {
        slug: muse.slug,
        name: muse.name,
        domain: muse.domain,
        isPrimaryMuse,
      },
      primaryMuse: primaryMuse
        ? {
            slug: primaryMuse.slug,
            name: primaryMuse.name,
            domain: primaryMuse.domain,
          }
        : null,
      song: {
        id: song.id,
        slug: song.slug,
        title:
          song.title_final ||
          song.title_working ||
          "Untitled song",
      },
      reply: result.reply,
      intelligence: result,
      memories,
      taskAction: null,
      knowledgeCitations,
      knowledgeMetrics,
    });
  } catch (error) {
    console.error(
      "Muse chat route error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The Muse could not respond.",
      },
      { status: 500 },
    );
  }
}
