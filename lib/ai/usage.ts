type ModelPricing = {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
  longContextThreshold?: number;
  longInputMultiplier?: number;
  longOutputMultiplier?: number;
};

export type AIUsageActivity =
  | "talk_to_muse"
  | "song_intelligence"
  | "agent_research"
  | "agent_curation"
  | "agent_validation"
  | "muse_knowledge_embedding"
  | "other";

const PRICING_VERSION = "openai-2026-08-19";
const WEB_SEARCH_PER_CALL_USD = 10 / 1000;

/*
 * Standard synchronous API pricing, USD per 1M text tokens.
 * Keep this map dated. Historical rows retain the pricing_version used
 * when their estimate was calculated.
 */
const MODEL_PRICING: Array<{
  matches: (model: string) => boolean;
  pricing: ModelPricing;
}> = [
  {
    matches: (model) =>
      model === "gpt-5.6" ||
      model === "gpt-5.6-sol" ||
      model.startsWith("gpt-5.6-sol-") ||
      (model.startsWith("gpt-5.6-") &&
        !model.startsWith("gpt-5.6-terra") &&
        !model.startsWith("gpt-5.6-luna") &&
        !model.startsWith("gpt-5.6-cyber")),
    pricing: {
      inputPerMillion: 5,
      cachedInputPerMillion: 0.5,
      outputPerMillion: 30,
      longContextThreshold: 272_000,
      longInputMultiplier: 2,
      longOutputMultiplier: 1.5,
    },
  },
  {
    matches: (model) =>
      model === "gpt-5.6-terra" ||
      model.startsWith("gpt-5.6-terra-"),
    pricing: {
      inputPerMillion: 2,
      cachedInputPerMillion: 0.2,
      outputPerMillion: 12,
      longContextThreshold: 272_000,
      longInputMultiplier: 2,
      longOutputMultiplier: 1.5,
    },
  },
  {
    matches: (model) =>
      model === "gpt-5.6-luna" ||
      model.startsWith("gpt-5.6-luna-"),
    pricing: {
      inputPerMillion: 0.2,
      cachedInputPerMillion: 0.02,
      outputPerMillion: 1.2,
      longContextThreshold: 272_000,
      longInputMultiplier: 2,
      longOutputMultiplier: 1.5,
    },
  },
  {
    matches: (model) =>
      model === "gpt-5-mini" ||
      model.startsWith("gpt-5-mini-"),
    pricing: {
      inputPerMillion: 0.25,
      cachedInputPerMillion: 0.025,
      outputPerMillion: 2,
    },
  },
];

type NormalizedUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

function asNonNegativeInteger(value: unknown): number {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeUsage(usage: unknown): NormalizedUsage {
  const root = asRecord(usage);
  const inputDetails = asRecord(
    root.input_tokens_details ?? root.prompt_tokens_details,
  );
  const outputDetails = asRecord(
    root.output_tokens_details ?? root.completion_tokens_details,
  );

  const inputTokens = asNonNegativeInteger(
    root.input_tokens ?? root.prompt_tokens,
  );
  const outputTokens = asNonNegativeInteger(
    root.output_tokens ?? root.completion_tokens,
  );
  const cachedInputTokens = Math.min(
    inputTokens,
    asNonNegativeInteger(inputDetails.cached_tokens),
  );
  const reasoningTokens = Math.min(
    outputTokens,
    asNonNegativeInteger(outputDetails.reasoning_tokens),
  );
  const suppliedTotal = asNonNegativeInteger(root.total_tokens);

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens:
      suppliedTotal || inputTokens + outputTokens,
  };
}

function pricingForModel(model: string): ModelPricing | null {
  const normalized = model.trim().toLowerCase();

  return (
    MODEL_PRICING.find((entry) =>
      entry.matches(normalized),
    )?.pricing ?? null
  );
}

function calculateTokenCosts({
  model,
  usage,
}: {
  model: string;
  usage: NormalizedUsage;
}) {
  const pricing = pricingForModel(model);

  if (!pricing) {
    return {
      inputCostUsd: null,
      outputCostUsd: null,
      tokenCostUsd: null,
      pricingMatched: false,
      longContext: false,
    };
  }

  const longContext = Boolean(
    pricing.longContextThreshold &&
      usage.inputTokens > pricing.longContextThreshold,
  );
  const inputMultiplier = longContext
    ? pricing.longInputMultiplier ?? 1
    : 1;
  const outputMultiplier = longContext
    ? pricing.longOutputMultiplier ?? 1
    : 1;

  const uncachedInputTokens = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens,
  );
  const inputCostUsd =
    ((uncachedInputTokens * pricing.inputPerMillion +
      usage.cachedInputTokens * pricing.cachedInputPerMillion) /
      1_000_000) *
    inputMultiplier;
  const outputCostUsd =
    ((usage.outputTokens * pricing.outputPerMillion) /
      1_000_000) *
    outputMultiplier;

  return {
    inputCostUsd,
    outputCostUsd,
    tokenCostUsd: inputCostUsd + outputCostUsd,
    pricingMatched: true,
    longContext,
  };
}

export function countOpenAIWebSearchCalls(value: unknown): number {
  let count = 0;
  const seen = new Set<object>();

  function visit(node: unknown) {
    if (!node || typeof node !== "object") {
      return;
    }

    if (seen.has(node as object)) {
      return;
    }
    seen.add(node as object);

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }

    const record = node as Record<string, unknown>;
    if (record.type === "web_search_call") {
      count += 1;
    }

    for (const child of Object.values(record)) {
      visit(child);
    }
  }

  visit(value);
  return count;
}

export async function recordAIUsage({
  supabase,
  activityType,
  operation,
  model,
  responseId,
  usage,
  userId,
  songId,
  conversationId,
  analysisRunId,
  agentJobId,
  webSearchCalls = 0,
  durationMs,
  status = "success",
  metadata = {},
}: {
  supabase: any;
  activityType: AIUsageActivity;
  operation?: string | null;
  model: string;
  responseId?: string | null;
  usage?: unknown;
  userId?: string | null;
  songId?: string | null;
  conversationId?: string | null;
  analysisRunId?: string | null;
  agentJobId?: string | null;
  webSearchCalls?: number;
  durationMs?: number | null;
  status?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    if (!supabase) {
      return null;
    }

    const normalizedUsage = normalizeUsage(usage);
    const tokenCosts = calculateTokenCosts({
      model,
      usage: normalizedUsage,
    });
    const normalizedWebSearchCalls = asNonNegativeInteger(
      webSearchCalls,
    );
    const toolCostUsd =
      normalizedWebSearchCalls * WEB_SEARCH_PER_CALL_USD;
    const estimatedCostUsd = tokenCosts.pricingMatched
      ? (tokenCosts.tokenCostUsd ?? 0) + toolCostUsd
      : null;

    const { error } = await supabase
      .from("ai_usage_events")
      .insert({
        provider: "openai",
        activity_type: activityType,
        operation: operation ?? null,
        model,
        response_id: responseId ?? null,
        user_id: userId ?? null,
        song_id: songId ?? null,
        conversation_id: conversationId ?? null,
        analysis_run_id: analysisRunId ?? null,
        agent_job_id: agentJobId ?? null,
        input_tokens: normalizedUsage.inputTokens,
        cached_input_tokens:
          normalizedUsage.cachedInputTokens,
        output_tokens: normalizedUsage.outputTokens,
        reasoning_tokens: normalizedUsage.reasoningTokens,
        total_tokens: normalizedUsage.totalTokens,
        web_search_calls: normalizedWebSearchCalls,
        input_cost_usd: tokenCosts.inputCostUsd,
        output_cost_usd: tokenCosts.outputCostUsd,
        tool_cost_usd: toolCostUsd,
        estimated_cost_usd: estimatedCostUsd,
        duration_ms:
          durationMs === null || durationMs === undefined
            ? null
            : Math.max(0, Math.floor(durationMs)),
        status: status || "unknown",
        pricing_version: PRICING_VERSION,
        metadata: {
          ...metadata,
          pricing_matched: tokenCosts.pricingMatched,
          long_context_pricing: tokenCosts.longContext,
        },
      });

    if (error) {
      console.warn(
        "AI usage telemetry insert failed:",
        error.message,
      );
      return null;
    }

    return true;
  } catch (error) {
    // Telemetry is deliberately fail-open: AI features must keep working
    // even if the metrics table or database is temporarily unavailable.
    console.warn("AI usage telemetry failed:", error);
    return null;
  }
}
