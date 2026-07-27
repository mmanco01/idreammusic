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

const CONCEPT_ALIASES: Record<
  string,
  string[]
> = {

  register: [
    "narrative voice",
    "original narrative voice",
    "plain contemporary telling",
    "local phrasing",
    "speaker's phrasing",
    "dialect",
    "archival language",
    "period phrase",
    "period phrasing",
  ],
  clarity: [
    "intelligibility",
    "intelligible",
    "clear",
    "likely clear",
    "understand",
    "understandable",
    "without stumbling",
    "simplify",
    "translate",
    "explains itself",
  ],
  "selective detail": [
    "anchor every phrase",
    "anchor every archival or period phrase",
    "tangible detail",
    "concrete detail",
    "one object",
    "one scene",
    "period words earn their place",
    "phrase earns its place",
    "keep translate or frame",
    "isolated period flavor",
    "decorative",
  ],

  vernacular: [
    "local vocabulary",
    "local phrase",
    "local phrases",
    "local word",
    "local words",
    "dialect word",
    "dialect words",
    "repeated saying",
    "speaker's phrasing",
    "oral phrasing",
    "inherited toast",
    "nickname",
  ],
  "material culture": [
    "object",
    "objects",
    "tool",
    "tools",
    "objects and tools",
    "rooms meals tools routes",
    "occupational detail",
    "occupational details",
    "harvest basket",
    "heirloom",
    "coffee tin",
    "ledger",
    "oven",
    "factory door",
  ],
  specificity: [
    "specific",
    "specific sensory",
    "specific sensory and occupational details",
    "concrete",
    "concrete detail",
    "particular",
    "particulars",
    "sensory anchor",
    "sensory anchors",
    "place-name",
    "one place-name",
    "one object",
    "single object",
    "single place-name",
  ],

  "changed meaning": [
    "mean something different",
    "means something different",
    "new meaning",
    "reframe",
    "reframes",
    "reframed",
    "reinterpret",
    "reinterpretation",
    "changes the meaning",
    "altered meaning",
    "change its emotional value",
  ],
  "temporal shift": [
    "later",
    "the next day",
    "the next morning",
    "afterward",
    "before",
    "after",
    "time jump",
    "move ahead in time",
    "move forward in time",
    "past and present",
    "present tense",
    "past tense",
    "then begins",
  ],
  "new evidence": [
    "new detail",
    "discovery",
    "found object",
    "overheard line",
    "private memory",
    "reveal",
    "new information",
    "new fact",
  ],
  consequence: [
    "what happens next",
    "result",
    "cost",
    "broken routine",
    "missed chance",
    "because of",
    "force consequence",
    "emotional price",
    "new stance",
  ],

  "verse function": [
    "verse job",
    "narrative job",
    "each verse do",
    "label each verse",
    "verse 1",
    "verse 2",
    "verse 3",
    "situation and want",
    "complication",
    "consequence or choice",
  ],
  progression: [
    "move the story",
    "story moves",
    "actually moves",
    "adds evidence",
    "adds discovery",
    "adds complication",
    "new fact",
    "raises stakes",
    "pushes toward",
  ],
  evidence: [
    "new evidence",
    "new fact",
    "what does the listener learn",
    "discovery",
    "concrete beat",
  ],
  escalation: [
    "raises stakes",
    "adds pressure",
    "pressure arc",
    "complication",
    "new cost",
    "new obstacle",
    "force a decision",
    "reversal",
  ],

  setup: [
    "set up",
    "never set up",
    "foreshadow",
    "earlier line",
    "implied premise",
    "premise test",
    "single dramatic claim",
  ],
  payoff: [
    "final claim",
    "final line",
    "ending lands",
    "land as",
    "earned ending",
    "emotional price",
    "new stance",
  ],
  causality: [
    "causal",
    "cause or consequence",
    "pressures",
    "pushes toward",
    "arrives as",
    "because",
    "consequence",
  ],
  "emotional resolution": [
    "emotional price",
    "new stance",
    "what the narrator can live with",
    "revelation or cost",
    "alter what the chorus asks",
    "emotional turn",
  ],

  "temporal stance": [
    "present tense anchor",
    "present tense claim",
    "present tense narrator",
    "anchor the song in",
    "present in one section",
    "past in another",
    "past and present",
  ],
  transitions: [
    "flag then",
    "mark shifts",
    "sensory cue",
    "repeatable sensory cue",
    "time shift",
    "when then begins",
    "move cleanly",
    "section",
  ],
  narrator: [
    "who is speaking",
    "present tense narrator",
    "narrator is the anchor",
  ],
  "causal relationship": [
    "what in the present forces",
    "why now",
    "reinterpret the past",
    "change how the present reads the past",
    "past imposes now",
    "present consequence",
  ],

  motif: [
    "motif",
    "echo",
    "emotional anchor",
    "repeat as",
  ],
  recurrence: [
    "recurring",
    "repeats meaning",
    "repeat",
    "echo",
    "emotional anchor",
    "first image and last image",
  ],
  transformation: [
    "what changed",
    "change test",
    "between them",
    "moves between",
    "reordering",
    "altered",
  ],
  "thematic coherence": [
    "causal or emotional throughline",
    "meaningful pattern",
    "dramatic job",
    "structural",
    "image system",
    "pattern from patchwork",
    "who sees it what it reveals its job",
  ],

  selection: [
    "cull every line",
    "keep facts only",
    "cut",
    "remove",
    "choose",
    "which single",
    "one specific image",
    "one specific action",
    "only when they affect",
  ],
  compression: [
    "compressed reveal",
    "compresses the backstory",
    "single revealing line",
    "spare line",
    "trade paragraphs",
    "move remaining backstory",
    "one line",
  ],
  "essential event": [
    "single emotional moment",
    "one specific image or action",
    "one concrete scene",
    "present consequence",
    "single lived scene",
    "one location",
    "one small event",
  ],
  implication: [
    "listener discovers",
    "let the listener",
    "sensory detail to carry the weight",
    "chorus carry the question",
    "cost the past imposes",
    "showing the present consequence",
    "rather than explanation",
  ],
};

function conceptPhrases(
  concept: string,
): string[] {
  const normalized =
    normalizeText(concept);

  return Array.from(
    new Set([
      normalized,
      ...(CONCEPT_ALIASES[
        normalized
      ] ?? []).map(normalizeText),
    ]),
  ).filter(Boolean);
}

function includesConcept(
  haystack: string,
  concept: string,
): boolean {
  return conceptPhrases(
    concept,
  ).some((phrase) => {
    if (
      haystack.includes(phrase)
    ) {
      return true;
    }

    const words =
      phrase
        .split(" ")
        .filter(
          (word) =>
            word.length >= 4,
        );

    if (!words.length) {
      return false;
    }

    const matched =
      words.filter(
        (word) =>
          haystack.includes(word),
      ).length;

    return (
      matched / words.length >= 0.67
    );
  });
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

function responseText(
  response: MuseIqChatResponse,
): string {
  const intelligence =
    response.intelligence;

  return normalizeText([
    response.reply ?? "",
    intelligence
      ?.primaryObservation
      ?.statement ?? "",
    ...(intelligence
      ?.diagnostics ?? [])
      .flatMap((item) => [
        item.finding,
        ...(item.evidence ?? []),
      ]),
    ...(intelligence
      ?.recommendations ?? [])
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
                (
                  metrics.averageRelevance /
                  benchmark.minimum_average_relevance
                ),
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
  mode:
    | "inline"
    | "separate"
    | "none";
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

  const mode =
    replyKeys.length > 0
      ? "inline"
      : citations.length > 0
        ? "separate"
        : "none";

  // Inline mode: every citation key used in the prose must resolve.
  // Separate mode: citations may be rendered by the UI beneath the reply.
  const keysValid =
    mode === "inline"
      ? replyKeys.every(
          (key) =>
            resolvedSet.has(key),
        )
      : mode === "separate";

  let score = 0;

  if (
    citations.length >=
    benchmark.minimum_cited_count
  ) {
    score += 30;
  } else if (
    citations.length > 0
  ) {
    score += 15;
  }

  if (keysValid) {
    score +=
      mode === "inline"
        ? 40
        : 32;
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
      (
        supportedClaims /
        citations.length
      );
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
      (
        linked /
        citations.length
      );
  }

  return {
    score: clamp(score),
    keysValid,
    mode,
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
  conceptTarget: number;
} {
  const text =
    responseText(response);
  const replyLength =
    (response.reply ?? "")
      .trim().length;

  const found =
    benchmark.expected_concepts
      .filter(
        (concept) =>
          includesConcept(
            text,
            concept,
          ),
      );

  const missing =
    benchmark.expected_concepts
      .filter(
        (concept) =>
          !found.includes(concept),
      );

  const available =
    benchmark.expected_concepts
      .length;

  const configuredTarget =
    benchmark.minimum_expected_concepts ??
    Math.min(2, available);

  const conceptTarget =
    Math.max(
      0,
      Math.min(
        configuredTarget,
        available,
      ),
    );

  const conceptCoverage =
    conceptTarget === 0
      ? 1
      : Math.min(
          1,
          found.length /
            conceptTarget,
        );

  let score =
    conceptCoverage * 55;

  if (replyLength >= 180) {
    score += 15;
  } else if (
    replyLength >= 80
  ) {
    score += 8;
  }

  const recommendations =
    response.intelligence
      ?.recommendations ?? [];

  if (
    recommendations.length > 0
  ) {
    score += 15;
  }

  const evidenceCount =
    response.intelligence
      ?.diagnostics
      ?.reduce(
        (sum, item) =>
          sum +
          (
            item.evidence
              ?.length ?? 0
          ),
        0,
      ) ?? 0;

  if (evidenceCount > 0) {
    score += 10;
  }

  const disallowedFound =
    benchmark
      .disallowed_concepts
      .filter(
        (concept) =>
          includesConcept(
            text,
            concept,
          ),
      );

  if (
    disallowedFound.length
  ) {
    score -= Math.min(
      30,
      disallowedFound.length *
        15,
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
    conceptTarget,
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
      intelligence
        .memoryCandidates,
    ) &&
    intelligence
      .memoryCandidates
      .length <= 2
  ) {
    score += 10;
  }

  const reply =
    intelligence.reply
      .toLowerCase();

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

function qualityLabel(
  score: number,
): string {
  if (score >= 90) {
    return "excellent";
  }

  if (score >= 80) {
    return "strong";
  }

  if (score >= 70) {
    return "acceptable";
  }

  if (score >= 60) {
    return "developing";
  }

  return "weak";
}

function buildExplanation({
  benchmark,
  retrievalScore,
  citationScore,
  responseScore,
  structureScore,
  overallScore,
  passed,
  found,
  missing,
  citationMode,
  citationKeysValid,
}: {
  benchmark: MuseIqBenchmark;
  retrievalScore: number;
  citationScore: number;
  responseScore: number;
  structureScore: number;
  overallScore: number;
  passed: boolean;
  found: string[];
  missing: string[];
  citationMode:
    | "inline"
    | "separate"
    | "none";
  citationKeysValid: boolean;
}): string {
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (retrievalScore >= 85) {
    strengths.push(
      "knowledge retrieval was excellent",
    );
  } else if (
    retrievalScore >= 70
  ) {
    strengths.push(
      "knowledge retrieval was solid",
    );
  } else {
    improvements.push(
      "retrieval relevance or coverage needs attention",
    );
  }

  if (
    structureScore >= 90
  ) {
    strengths.push(
      "the structured response contract remained intact",
    );
  } else {
    improvements.push(
      "the structured response needs validation",
    );
  }

  if (
    found.length > 0
  ) {
    strengths.push(
      `the answer addressed ${found.join(", ")}`,
    );
  }

  if (
    responseScore < 70 &&
    missing.length > 0
  ) {
    improvements.push(
      `the response could more clearly develop alternatives such as ${missing.join(", ")}`,
    );
  }

  if (
    citationMode === "separate" &&
    citationKeysValid
  ) {
    strengths.push(
      "citations were supplied separately for interface rendering",
    );
  } else if (
    citationMode === "inline" &&
    citationKeysValid
  ) {
    strengths.push(
      "inline citation keys resolved correctly",
    );
  } else if (
    citationScore < 70
  ) {
    improvements.push(
      "citation linkage needs improvement",
    );
  }

  const opening =
    `${passed ? "Passed" : "Did not pass"} with an overall score of ${overallScore.toFixed(1)}.`;

  const strengthSentence =
    strengths.length
      ? ` Strengths: ${strengths.join("; ")}.`
      : "";

  const improvementSentence =
    improvements.length
      ? ` Improvement focus: ${improvements.join("; ")}.`
      : "";

  const calibrationSentence =
    !passed &&
    overallScore >=
      benchmark.minimum_overall_score
      ? " The blended score met the numerical target, but one or more quality gates prevented a pass."
      : "";

  return (
    opening +
    strengthSentence +
    improvementSentence +
    calibrationSentence +
    ` Retrieval was ${qualityLabel(retrievalScore)}, citations were ${qualityLabel(citationScore)}, response quality was ${qualityLabel(responseScore)}, and structure was ${qualityLabel(structureScore)}.`
  );
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
        ) /
        totalWeight
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
      response
        .knowledgeMetrics
        ?.retrievedCount ?? 0
    ) >=
      benchmark
        .minimum_retrieved_count &&
    (
      response
        .knowledgeMetrics
        ?.citedCount ?? 0
    ) >=
      benchmark
        .minimum_cited_count &&
    responseQuality.score >= 70;

  const evaluatorNotes =
    passed
      ? "Passed the Muse IQ v1.2 calibrated deterministic evaluation."
      : `Failed: ${
          failureCategories.join(
            ", ",
          ) ||
          "overall score below target"
        }.`;

  const benchmarkExplanation =
    buildExplanation({
      benchmark,
      retrievalScore,
      citationScore:
        citation.score,
      responseScore:
        responseQuality.score,
      structureScore:
        structure.score,
      overallScore,
      passed,
      found:
        responseQuality.found,
      missing:
        responseQuality.missing,
      citationMode:
        citation.mode,
      citationKeysValid:
        citation.keysValid,
    });

  return {
    retrievalScore:
      Number(
        retrievalScore.toFixed(
          3,
        ),
      ),
    citationScore:
      Number(
        citation.score.toFixed(
          3,
        ),
      ),
    responseScore:
      Number(
        responseQuality.score.toFixed(
          3,
        ),
      ),
    structureScore:
      Number(
        structure.score.toFixed(
          3,
        ),
      ),
    overallScore:
      Number(
        overallScore.toFixed(
          3,
        ),
      ),
    passed,
    structureValid:
      structure.valid,
    citationKeysValid:
      citation.keysValid,
    citationMode:
      citation.mode,
    expectedConceptsFound:
      responseQuality.found,
    expectedConceptsMissing:
      responseQuality.missing,
    failureCategories,
    evaluatorNotes,
    benchmarkExplanation,
    evaluatorDetails: {
      replyCitationKeys:
        citation.replyKeys,
      resolvedCitationKeys:
        citation.resolvedKeys,
      citationMode:
        citation.mode,
      conceptTarget:
        responseQuality
          .conceptTarget,
      requestedKnowledgeCount:
        response
          .knowledgeMetrics
          ?.requestedCount ??
        null,
      retrievedKnowledgeCount:
        response
          .knowledgeMetrics
          ?.retrievedCount ??
        null,
      citedKnowledgeCount:
        response
          .knowledgeMetrics
          ?.citedCount ??
        null,
    },
  };
}
