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

export type MuseIntelligenceResult = {
  reply: string;
  primaryObservation: {
    category: string;
    statement: string;
    evidence: string[];
    confidence: number;
  };
  recommendations: MuseRecommendation[];
  unresolvedQuestions: string[];
  memoryCandidates: MuseMemoryCandidate[];
  proposedTask: {
    title: string;
    description: string;
    priority: number;
  } | null;
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

export const MUSE_INTELLIGENCE_TEXT_FORMAT = {
  type: "json_schema",
  name: "muse_intelligence_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "reply",
      "primaryObservation",
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
        required: ["category", "statement", "evidence", "confidence"],
        properties: {
          category: { type: "string" },
          statement: { type: "string" },
          evidence: {
            type: "array",
            items: { type: "string" },
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
        },
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
                anyOf: [{ type: "string" }, { type: "null" }],
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
            required: ["recommendedForm", "alternatives", "reasoning"],
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parseMuseIntelligenceOutput(
  outputText: string,
): MuseIntelligenceResult {
  const parsed = JSON.parse(outputText) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("The Muse returned an invalid intelligence result.");
  }

  if (typeof parsed.reply !== "string" || !parsed.reply.trim()) {
    throw new Error("The Muse response did not contain a reply.");
  }

  return parsed as unknown as MuseIntelligenceResult;
}
