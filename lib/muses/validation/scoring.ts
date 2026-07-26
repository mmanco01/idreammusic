import {
  isMuseIntelligenceResult,
} from "@/lib/muses/intelligence";
import type {
  MuseIqBenchmark,
  MuseIqChatResponse,
  MuseIqScoreResult,
} from "@/lib/muses/validation/types";

function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function normalizeText(
  value: unknown,
): string {
  return typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/[^a-z0-9'\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function includesConcept(
  haystack: string,
  concept: string,
): boolean {
  const normalizedConcept =
    normalizeText(concept);

  if (!normalizedConcept) {
    return false;
  }

  if (
    haystack.includes(normalizedConcept)
  ) {
    return true;
  }

  const words =
    normalizedConcept
      .split(" ")
      .filter((word) => word.length >= 4);

  if (!words.length) {
    return false;
  }

  const matched = words.filter(
    (word) => haystack.includes(word),
  ).length;

  return (
    matched / words.length >= 0.67
  );
}

function citationKeysFromReply(
  reply: string,
): string[] {
  return Array.from(
    new Set(
      reply.match(/\[K[1-9][0-9]?\]/g) ?? [],
    ),
  ).map((key) =>
    key.slice(1, -1),
  );
}

function responseText(
  response: MuseIqChatResponse,
): string {
  const intelligence =
    response.intelligence;

  return normalizeText([
    response.reply ?? "",
    intelligence?.primaryObservation
      ?.statement ?? "",
    ...(intelligence?.diagnostics ?? [])
      .flatMap((item) => [
        item.finding,
        ...(item.evidence ?? []),
      ]),
    ...(intelligence?.recommendations ?? [])
      .flatMap((item) => [
        item.title,
        item.reasoning,
      ]),
  ].join(" "));
}

function scoreRetrieval({
  benchmark,
  response,
}: {
  benchmark: MuseIqBenchmark;
  response: MuseIqChatResponse;
}): number {
  const metrics =
    response.knowledgeMetrics;

  if (!metrics) {
    return 0;
  }

  let score = 0;

  if (
    metrics.retrievedCount >=
    benchmark.minimum_retrieved_count
  ) {
    score += 35;
  } else if (
    metrics.retrievedCount > 0
  ) {
    score += 15;
  }

  if (
    metrics.highestRelevance !== null
  ) {
    score += clamp(
      metrics.highestRelevance * 60,
      0,
      30,
    );
  }

  if (
    metrics.averageRelevance !== null
  ) {
    if (
      benchmark.minimum_average_relevance !==
      null
    ) {
      score +=
        metrics.averageRelevance >=
        benchmark.minimum_average_relevance
          ? 25
          : clamp(
              25 *
                (metrics.averageRelevance /
                  benchmark.minimum_average_relevance),
            );
    } else {
      score += clamp(
        metrics.averageRelevance * 55,
        0,
        25,
      );
    }
  }

  if (
    metrics.retrievedCount ===
      metrics.requestedCount &&
    metrics.requestedCount > 0
  ) {
    score += 10;
  }

  return clamp(score);
}

function scoreCitations({
  benchmark,
  response,
}: {
  benchmark: MuseIqBenchmark;
  response: MuseIqChatResponse;
}): {
  score: number;
  keysValid: boolean;
  replyKeys: string[];
  resolvedKeys: string[];
} {
  const citations =
    response.knowledgeCitations ?? [];
  const reply =
    response.reply ?? "";
  const replyKeys =
    citationKeysFromReply(reply);
  const resolvedKeys =
    citations.map(
      (citation) =>
        citation.citationKey,
    );

  const resolvedSet =
    new Set(resolvedKeys);

  const keysValid =
    replyKeys.every((key) =>
      resolvedSet.has(key),
    ) &&
    resolvedKeys.every((key) =>
      reply.includes(`[${key}]`),
    );

  let score = 0;

  if (
    citations.length >=
    benchmark.minimum_cited_count
  ) {
    score += 30;
  } else if (citations.length > 0) {
    score += 15;
  }

  if (keysValid) {
    score += 40;
  }

  const supportedClaims =
    citations.filter(
      (citation) =>
        Boolean(
          citation.supportedClaim
            ?.trim(),
        ),
    ).length;

  if (citations.length > 0) {
    score +=
      20 *
      (supportedClaims /
        citations.length);
  }

  const linked =
    citations.filter(
      (citation) =>
        Boolean(
          citation.canonicalUrl,
        ),
    ).length;

  if (citations.length > 0) {
    score +=
      10 *
      (linked / citations.length);
  }

  return {
    score: clamp(score),
    keysValid,
    replyKeys,
    resolvedKeys,
  };
}

function scoreResponse({
  benchmark,
  response,
}: {
  benchmark: MuseIqBenchmark;
  response: MuseIqChatResponse;
}): {
  score: number;
  found: string[];
  missing: string[];
} {
  const text =
    responseText(response);
  const replyLength =
    (response.reply ?? "")
      .trim().length;

  const found =
    benchmark.expected_concepts.filter(
      (concept) =>
        includesConcept(
          text,
          concept,
        ),
    );

  const missing =
    benchmark.expected_concepts.filter(
      (concept) =>
        !found.includes(concept),
    );

  const conceptCoverage =
    benchmark.expected_concepts.length
      ? found.length /
        benchmark.expected_concepts.length
      : 1;

  let score =
    conceptCoverage * 55;

  if (replyLength >= 180) {
    score += 15;
  } else if (replyLength >= 80) {
    score += 8;
  }

  const recommendations =
    response.intelligence
      ?.recommendations ?? [];

  if (recommendations.length > 0) {
    score += 15;
  }

  const evidenceCount =
    response.intelligence
      ?.diagnostics
      ?.reduce(
        (sum, item) =>
          sum +
          (item.evidence?.length ?? 0),
        0,
      ) ?? 0;

  if (evidenceCount > 0) {
    score += 10;
  }

  const disallowedFound =
    benchmark.disallowed_concepts
      .filter((concept) =>
        includesConcept(
          text,
          concept,
        ),
      );

  if (disallowedFound.length) {
    score -=
      Math.min(
        30,
        disallowedFound.length * 15,
      );
  }

  if (
    text.includes(
      "i am hearing the recording",
    ) ||
    text.includes(
      "i can hear the recording",
    )
  ) {
    score -= 25;
  }

  return {
    score: clamp(score),
    found,
    missing,
  };
}

function scoreStructure(
  response: MuseIqChatResponse,
): {
  score: number;
  valid: boolean;
} {
  const intelligence =
    response.intelligence;

  if (
    !intelligence ||
    !isMuseIntelligenceResult(
      intelligence,
    )
  ) {
    return {
      score: 0,
      valid: false,
    };
  }

  let score = 55;

  if (
    intelligence.reply.trim()
  ) {
    score += 10;
  }

  if (
    intelligence.primaryObservation &&
    Array.isArray(
      intelligence.diagnostics,
    )
  ) {
    score += 10;
  }

  if (
    intelligence.lensAssessments &&
    Array.isArray(
      intelligence.recommendations,
    )
  ) {
    score += 10;
  }

  if (
    Array.isArray(
      intelligence.memoryCandidates,
    ) &&
    intelligence.memoryCandidates
      .length <= 2
  ) {
    score += 10;
  }

  const reply =
    intelligence.reply.toLowerCase();

  if (
    reply.includes(
      "i am hearing the recording",
    ) ||
    reply.includes(
      "i can hear the recording",
    )
  ) {
    score -= 25;
  }

  return {
    score: clamp(score),
    valid: true,
  };
}

export function scoreMuseIqResponse({
  benchmark,
  response,
}: {
  benchmark: MuseIqBenchmark;
  response: MuseIqChatResponse;
}): MuseIqScoreResult {
  const retrievalScore =
    scoreRetrieval({
      benchmark,
      response,
    });

  const citation =
    scoreCitations({
      benchmark,
      response,
    });

  const responseQuality =
    scoreResponse({
      benchmark,
      response,
    });

  const structure =
    scoreStructure(response);

  const totalWeight =
    benchmark.weight_retrieval +
    benchmark.weight_citation +
    benchmark.weight_response +
    benchmark.weight_structure;

  const overallScore =
    totalWeight > 0
      ? (
          retrievalScore *
            benchmark.weight_retrieval +
          citation.score *
            benchmark.weight_citation +
          responseQuality.score *
            benchmark.weight_response +
          structure.score *
            benchmark.weight_structure
        ) / totalWeight
      : 0;

  const failureCategories: string[] =
    [];

  if (
    retrievalScore < 60
  ) {
    failureCategories.push(
      "retrieval",
    );
  }

  if (
    citation.score < 70 ||
    !citation.keysValid
  ) {
    failureCategories.push(
      "citation",
    );
  }

  if (
    responseQuality.score < 70
  ) {
    failureCategories.push(
      "response",
    );
  }

  if (
    structure.score < 90 ||
    !structure.valid
  ) {
    failureCategories.push(
      "structure",
    );
  }

  const passed =
    overallScore >=
      benchmark.minimum_overall_score &&
    structure.valid &&
    citation.keysValid &&
    (
      response.knowledgeMetrics
        ?.retrievedCount ?? 0
    ) >=
      benchmark.minimum_retrieved_count &&
    (
      response.knowledgeMetrics
        ?.citedCount ?? 0
    ) >=
      benchmark.minimum_cited_count;

  const evaluatorNotes = passed
    ? "Passed the Muse IQ v1 deterministic evaluation."
    : `Failed: ${
        failureCategories.join(", ") ||
        "overall score below target"
      }.`;

  return {
    retrievalScore:
      Number(
        retrievalScore.toFixed(3),
      ),
    citationScore:
      Number(
        citation.score.toFixed(3),
      ),
    responseScore:
      Number(
        responseQuality.score.toFixed(
          3,
        ),
      ),
    structureScore:
      Number(
        structure.score.toFixed(3),
      ),
    overallScore:
      Number(
        overallScore.toFixed(3),
      ),
    passed,
    structureValid:
      structure.valid,
    citationKeysValid:
      citation.keysValid,
    expectedConceptsFound:
      responseQuality.found,
    expectedConceptsMissing:
      responseQuality.missing,
    failureCategories,
    evaluatorNotes,
    evaluatorDetails: {
      replyCitationKeys:
        citation.replyKeys,
      resolvedCitationKeys:
        citation.resolvedKeys,
      requestedKnowledgeCount:
        response.knowledgeMetrics
          ?.requestedCount ?? null,
      retrievedKnowledgeCount:
        response.knowledgeMetrics
          ?.retrievedCount ?? null,
      citedKnowledgeCount:
        response.knowledgeMetrics
          ?.citedCount ?? null,
    },
  };
}
