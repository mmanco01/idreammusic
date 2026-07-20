export type MuseSlug =
  | "calliope"
  | "clio"
  | "erato"
  | "euterpe"
  | "melpomene"
  | "polyhymnia"
  | "terpsichore"
  | "thalia"
  | "urania";

export type MuseDiagnosticArea = {
  key: string;
  label: string;
  questions: string[];
};

export type MuseLyricLens = {
  strongestSignals: string[];
  risks: string[];
  reconstructionPriorities: string[];
  suggestionRules: string[];
};

export type MuseFormPreference = {
  form: string;
  strengths: string[];
  risks: string[];
};

export type MuseCollaborationRule = {
  museSlug: MuseSlug;
  inviteWhen: string;
  expectedContribution: string;
};

export type MuseIdentity = {
  slug: MuseSlug;
  name: string;
  domain: string;
  label: string;
  purpose: string;
  personality: string;
  speakingStyle: string;
  greeting: string;
  creativeLens: string;
  songwritingStrengths: string[];
  evaluationCriteria: string[];
  questionsSheAsks: string[];
  boundaries: string[];
  starterQuestions: string[];
  responseApproach: string[];

  noticesFirst: string[];
  coreCreativeTensions: string[];
  diagnosticFramework: MuseDiagnosticArea[];
  lyricLens: MuseLyricLens;
  preferredForms: MuseFormPreference[];
  memoryPriorities: string[];
  collaborationMap: MuseCollaborationRule[];
  knowledgeTopics: string[];

  systemPrompt: string;
};

type IntelligenceField =
  | "noticesFirst"
  | "coreCreativeTensions"
  | "diagnosticFramework"
  | "lyricLens"
  | "preferredForms"
  | "memoryPriorities"
  | "collaborationMap"
  | "knowledgeTopics";

type MuseIdentityInput = Omit<
  MuseIdentity,
  "systemPrompt" | IntelligenceField
> &
  Partial<Pick<MuseIdentity, IntelligenceField>>;

function numberedLines(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function bulletedLines(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function diagnosticLines(items: MuseDiagnosticArea[]) {
  return items
    .map((item) => {
      const questions = item.questions.map((question) => `  - ${question}`).join("\n");
      return `- ${item.label}\n${questions}`;
    })
    .join("\n");
}

function formLines(items: MuseFormPreference[]) {
  return items
    .map(
      (item) => `- ${item.form}\n  Strengths: ${item.strengths.join("; ")}\n  Risks: ${item.risks.join("; ")}`,
    )
    .join("\n");
}

function collaborationLines(items: MuseCollaborationRule[]) {
  return items
    .map(
      (item) => `- Invite ${item.museSlug} when: ${item.inviteWhen}\n  Expected contribution: ${item.expectedContribution}`,
    )
    .join("\n");
}

const EMPTY_LYRIC_LENS: MuseLyricLens = {
  strongestSignals: [],
  risks: [],
  reconstructionPriorities: [],
  suggestionRules: [],
};

export function defineMuse(input: MuseIdentityInput): MuseIdentity {
  const noticesFirst = input.noticesFirst ?? [];
  const coreCreativeTensions = input.coreCreativeTensions ?? [];
  const diagnosticFramework = input.diagnosticFramework ?? [];
  const lyricLens = input.lyricLens ?? EMPTY_LYRIC_LENS;
  const preferredForms = input.preferredForms ?? [];
  const memoryPriorities = input.memoryPriorities ?? [];
  const collaborationMap = input.collaborationMap ?? [];
  const knowledgeTopics = input.knowledgeTopics ?? [];

  const optionalSections = [
    noticesFirst.length
      ? `WHAT YOU NOTICE FIRST\n${bulletedLines(noticesFirst)}`
      : "",
    coreCreativeTensions.length
      ? `CORE CREATIVE TENSIONS\n${bulletedLines(coreCreativeTensions)}`
      : "",
    diagnosticFramework.length
      ? `DIAGNOSTIC FRAMEWORK\n${diagnosticLines(diagnosticFramework)}`
      : "",
    lyricLens.strongestSignals.length ||
    lyricLens.risks.length ||
    lyricLens.reconstructionPriorities.length ||
    lyricLens.suggestionRules.length
      ? `LYRIC INTELLIGENCE\nStrong signals:\n${bulletedLines(
          lyricLens.strongestSignals,
        )}\n\nRisks:\n${bulletedLines(
          lyricLens.risks,
        )}\n\nReconstruction priorities:\n${bulletedLines(
          lyricLens.reconstructionPriorities,
        )}\n\nSuggestion rules:\n${bulletedLines(lyricLens.suggestionRules)}`
      : "",
    preferredForms.length
      ? `SONG FORM PREFERENCES\n${formLines(preferredForms)}`
      : "",
    memoryPriorities.length
      ? `WHAT YOU SHOULD REMEMBER\n${bulletedLines(memoryPriorities)}`
      : "",
    collaborationMap.length
      ? `WHEN TO INVITE ANOTHER MUSE\n${collaborationLines(collaborationMap)}`
      : "",
    knowledgeTopics.length
      ? `KNOWLEDGE TOPICS\n${bulletedLines(knowledgeTopics)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt = `
You are ${input.name}, the Muse of ${input.domain} within iDreamMusic.

IDENTITY
${input.purpose}

PERSONALITY
${input.personality}

SPEAKING STYLE
${input.speakingStyle}

CREATIVE LENS
${input.creativeLens}

SONGWRITING STRENGTHS
${bulletedLines(input.songwritingStrengths)}

EVALUATION CRITERIA
${numberedLines(input.evaluationCriteria)}

QUESTIONS YOU NATURALLY ASK
${bulletedLines(input.questionsSheAsks)}

RESPONSE APPROACH
${numberedLines(input.responseApproach)}

BOUNDARIES
${bulletedLines(input.boundaries)}

${optionalSections}

WORKING RULES
- Use only the song context that iDreamMusic provides.
- Treat accepted memories as prior songwriter decisions or preferences, not universal facts.
- Treat proposed memories as unconfirmed and never state them as settled decisions.
- Notice meaningful changes between the current context and the prior context snapshot.
- Never claim to have heard audio unless actual audio analysis is included in the context.
- Never claim lyrics, facts, history, beliefs, or intentions that are not present.
- Clearly distinguish observations from optional creative suggestions.
- Preserve the songwriter's voice, authorship, ownership, and final decision-making.
- Offer a small number of high-value improvements rather than overwhelming the songwriter.
- Do not imitate a living songwriter or artist's exact style.
- When the song lacks enough material, say what is missing and ask focused questions.
- Do not declare the song finished. Help the songwriter decide.
- Treat the other Muses as collaborators with different specialties, not competitors.
- Suggest only memories that would genuinely improve a future session.
- Never silently change lyrics, tasks, metadata, versions, or creative decisions.

Your purpose is not to replace the songwriter. Your purpose is to help the songwriter recognize what the song is trying to become through the lens of ${input.domain}.
  `.trim();

  return {
    ...input,
    noticesFirst,
    coreCreativeTensions,
    diagnosticFramework,
    lyricLens,
    preferredForms,
    memoryPriorities,
    collaborationMap,
    knowledgeTopics,
    systemPrompt,
  };
}
