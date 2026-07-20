import type { MuseSlug } from "@/lib/muses/types";

export type MuseMemoryType =
  | "observation"
  | "decision"
  | "accepted_suggestion"
  | "rejected_suggestion"
  | "songwriter_preference"
  | "unresolved_question"
  | "next_step"
  | "lyric_choice"
  | "form_choice"
  | "collaboration_note";

export type MuseMemoryCandidate = {
  type: MuseMemoryType;
  content: string;
  reason: string;
  importance: number;
  confidence: number;
};

export type MuseRecommendation = {
  title: string;
  reasoning: string;
  priority: "now" | "later" | "optional";
};

export type MuseDiagnosticAssessment = {
  key: string;
  label: string;
  score: number;
  finding: string;
  evidence: string[];
  confidence: number;
  changeFromPrevious:
    | "improved"
    | "declined"
    | "unchanged"
    | "unknown";
};

export type MuseLensAssessment = {
  summary: string;
  strengths: string[];
  risks: string[];
  nextMove: string;
  confidence: number;
};

export type MuseVersionComparison = {
  currentVersionLabel: string;
  previousVersionLabel: string;
  summary: string;
  meaningfulChanges: string[];
  protectedElements: string[];
  confidence: number;
};

export type MuseTaskProposal = {
  title: string;
  description: string;
  priority: number;
};

export type MuseIntelligenceResult = {
  reply: string;

  primaryObservation: {
    category: string;
    statement: string;
    evidence: string[];
    confidence: number;
  };

  diagnostics: MuseDiagnosticAssessment[];

  lensAssessments: {
    lyric: MuseLensAssessment | null;
    form: MuseLensAssessment | null;
    melody: MuseLensAssessment | null;
    performance: MuseLensAssessment | null;
    audience: MuseLensAssessment | null;
  };

  versionComparison: MuseVersionComparison | null;

  recommendations: MuseRecommendation[];
  unresolvedQuestions: string[];
  memoryCandidates: MuseMemoryCandidate[];

  proposedTask: MuseTaskProposal | null;

  suggestedCollaborator: {
    museSlug: MuseSlug;
    reason: string;
  } | null;

  lyricWork: {
    likelyLyric: string | null;
    suggestedLines: Array<{
      text: string;
      source:
        | "transcript"
        | "existing_lyric"
        | "writer_note"
        | "muse_suggestion";
      reason: string;
    }>;
  } | null;

  formWork: {
    recommendedForm: string;
    alternatives: string[];
    reasoning: string;
  } | null;
};

const LENS_ASSESSMENT_SCHEMA = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "summary",
        "strengths",
        "risks",
        "nextMove",
        "confidence",
      ],
      properties: {
        summary: { type: "string" },
        strengths: {
          type: "array",
          maxItems: 3,
          items: { type: "string" },
        },
        risks: {
          type: "array",
          maxItems: 3,
          items: { type: "string" },
        },
        nextMove: { type: "string" },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
      },
    },
    { type: "null" },
  ],
} as const;

export const MUSE_INTELLIGENCE_TEXT_FORMAT = {
  type: "json_schema",
  name: "muse_intelligence_response_v1_1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "reply",
      "primaryObservation",
      "diagnostics",
      "lensAssessments",
      "versionComparison",
      "recommendations",
      "unresolvedQuestions",
      "memoryCandidates",
      "proposedTask",
      "suggestedCollaborator",
      "lyricWork",
      "formWork",
    ],
    properties: {
      reply: { type: "string" },

      primaryObservation: {
        type: "object",
        additionalProperties: false,
        required: [
          "category",
          "statement",
          "evidence",
          "confidence",
        ],
        properties: {
          category: { type: "string" },
          statement: { type: "string" },
          evidence: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
        },
      },

      diagnostics: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "key",
            "label",
            "score",
            "finding",
            "evidence",
            "confidence",
            "changeFromPrevious",
          ],
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            score: {
              type: "integer",
              minimum: 0,
              maximum: 100,
            },
            finding: { type: "string" },
            evidence: {
              type: "array",
              maxItems: 3,
              items: { type: "string" },
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
            changeFromPrevious: {
              type: "string",
              enum: [
                "improved",
                "declined",
                "unchanged",
                "unknown",
              ],
            },
          },
        },
      },

      lensAssessments: {
        type: "object",
        additionalProperties: false,
        required: [
          "lyric",
          "form",
          "melody",
          "performance",
          "audience",
        ],
        properties: {
          lyric: LENS_ASSESSMENT_SCHEMA,
          form: LENS_ASSESSMENT_SCHEMA,
          melody: LENS_ASSESSMENT_SCHEMA,
          performance: LENS_ASSESSMENT_SCHEMA,
          audience: LENS_ASSESSMENT_SCHEMA,
        },
      },

      versionComparison: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: [
              "currentVersionLabel",
              "previousVersionLabel",
              "summary",
              "meaningfulChanges",
              "protectedElements",
              "confidence",
            ],
            properties: {
              currentVersionLabel: { type: "string" },
              previousVersionLabel: { type: "string" },
              summary: { type: "string" },
              meaningfulChanges: {
                type: "array",
                maxItems: 5,
                items: { type: "string" },
              },
              protectedElements: {
                type: "array",
                maxItems: 4,
                items: { type: "string" },
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
            },
          },
          { type: "null" },
        ],
      },

      recommendations: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "reasoning", "priority"],
          properties: {
            title: { type: "string" },
            reasoning: { type: "string" },
            priority: {
              type: "string",
              enum: ["now", "later", "optional"],
            },
          },
        },
      },

      unresolvedQuestions: {
        type: "array",
        maxItems: 4,
        items: { type: "string" },
      },

      memoryCandidates: {
        type: "array",
        maxItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "type",
            "content",
            "reason",
            "importance",
            "confidence",
          ],
          properties: {
            type: {
              type: "string",
              enum: [
                "observation",
                "decision",
                "accepted_suggestion",
                "rejected_suggestion",
                "songwriter_preference",
                "unresolved_question",
                "next_step",
                "lyric_choice",
                "form_choice",
                "collaboration_note",
              ],
            },
            content: { type: "string" },
            reason: { type: "string" },
            importance: {
              type: "integer",
              minimum: 1,
              maximum: 5,
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
          },
        },
      },

      proposedTask: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["title", "description", "priority"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              priority: {
                type: "integer",
                minimum: 1,
                maximum: 5,
              },
            },
          },
          { type: "null" },
        ],
      },

      suggestedCollaborator: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["museSlug", "reason"],
            properties: {
              museSlug: {
                type: "string",
                enum: [
                  "calliope",
                  "clio",
                  "erato",
                  "euterpe",
                  "melpomene",
                  "polyhymnia",
                  "terpsichore",
                  "thalia",
                  "urania",
                ],
              },
              reason: { type: "string" },
            },
          },
          { type: "null" },
        ],
      },

      lyricWork: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["likelyLyric", "suggestedLines"],
            properties: {
              likelyLyric: {
                anyOf: [
                  { type: "string" },
                  { type: "null" },
                ],
              },
              suggestedLines: {
                type: "array",
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["text", "source", "reason"],
                  properties: {
                    text: { type: "string" },
                    source: {
                      type: "string",
                      enum: [
                        "transcript",
                        "existing_lyric",
                        "writer_note",
                        "muse_suggestion",
                      ],
                    },
                    reason: { type: "string" },
                  },
                },
              },
            },
          },
          { type: "null" },
        ],
      },

      formWork: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: [
              "recommendedForm",
              "alternatives",
              "reasoning",
            ],
            properties: {
              recommendedForm: { type: "string" },
              alternatives: {
                type: "array",
                maxItems: 3,
                items: { type: "string" },
              },
              reasoning: { type: "string" },
            },
          },
          { type: "null" },
        ],
      },
    },
  },
} as const;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

export function isMuseIntelligenceResult(
  value: unknown,
): value is MuseIntelligenceResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.reply === "string" &&
    isRecord(value.primaryObservation) &&
    Array.isArray(value.diagnostics) &&
    isRecord(value.lensAssessments) &&
    Array.isArray(value.recommendations) &&
    Array.isArray(value.unresolvedQuestions) &&
    Array.isArray(value.memoryCandidates)
  );
}

function structuredJsonCandidates(
  outputText: string,
): string[] {
  const trimmed = outputText.trim();
  const candidates = new Set<string>();

  if (trimmed) {
    candidates.add(trimmed);
  }

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (withoutFence) {
    candidates.add(withoutFence);
  }

  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {
    candidates.add(
      withoutFence.slice(
        firstBrace,
        lastBrace + 1,
      ),
    );
  }

  return [...candidates];
}

export function parseMuseIntelligenceOutput(
  outputText: string,
): MuseIntelligenceResult {
  let lastParseError: unknown = null;

  for (const candidate of structuredJsonCandidates(
    outputText,
  )) {
    try {
      const parsed =
        JSON.parse(candidate) as unknown;

      if (!isMuseIntelligenceResult(parsed)) {
        throw new Error(
          "The structured response did not match the Muse intelligence contract.",
        );
      }

      if (!parsed.reply.trim()) {
        throw new Error(
          "The Muse response did not contain a reply.",
        );
      }

      return parsed;
    } catch (error) {
      lastParseError = error;
    }
  }

  const detail =
    lastParseError instanceof Error
      ? lastParseError.message
      : "Unknown structured JSON error.";

  throw new Error(
    `The Muse returned incomplete or malformed structured JSON: ${detail}`,
  );
}
