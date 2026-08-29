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

export type MuseFormLens = {
  evaluates: string[];
  comparisonQuestions: string[];
  sectionRules: string[];
  risks: string[];
  changeSignals: string[];
};

export type MuseCreativeLens = {
  focus: string[];
  strengths: string[];
  risks: string[];
  questions: string[];
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
  formLens: MuseFormLens;
  melodyLens: MuseCreativeLens;
  performanceLens: MuseCreativeLens;
  audienceLens: MuseCreativeLens;

  preferredForms: MuseFormPreference[];
  memoryPriorities: string[];
  collaborationMap: MuseCollaborationRule[];
  knowledgeTopics: string[];

  evidenceHierarchy: string[];
  citationRules: string[];
  knowledgeBoundaries: string[];

  systemPrompt: string;
};

type IntelligenceFields =
  | "noticesFirst"
  | "coreCreativeTensions"
  | "diagnosticFramework"
  | "lyricLens"
  | "formLens"
  | "melodyLens"
  | "performanceLens"
  | "audienceLens"
  | "preferredForms"
  | "memoryPriorities"
  | "collaborationMap"
  | "knowledgeTopics"
  | "evidenceHierarchy"
  | "citationRules"
  | "knowledgeBoundaries";

type MuseIdentityInput = Omit<
  MuseIdentity,
  "systemPrompt" | IntelligenceFields
> &
  Partial<Pick<MuseIdentity, IntelligenceFields>>;

function numberedLines(items: string[]) {
  return items
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

function bulletedLines(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function diagnosticLines(items: MuseDiagnosticArea[]) {
  return items
    .map((item) => {
      const questions = item.questions
        .map((question) => `  - ${question}`)
        .join("\n");

      return `- ${item.key}: ${item.label}\n${questions}`;
    })
    .join("\n");
}

function formPreferenceLines(items: MuseFormPreference[]) {
  return items
    .map(
      (item) =>
        `- ${item.form}\n  Strengths: ${item.strengths.join(
          "; ",
        )}\n  Risks: ${item.risks.join("; ")}`,
    )
    .join("\n");
}

function collaborationLines(items: MuseCollaborationRule[]) {
  return items
    .map(
      (item) =>
        `- Invite ${item.museSlug} when: ${item.inviteWhen}\n  Expected contribution: ${item.expectedContribution}`,
    )
    .join("\n");
}

function creativeLensLines(
  heading: string,
  lens: MuseCreativeLens,
) {
  const sections = [
    lens.focus.length
      ? `Focus:\n${bulletedLines(lens.focus)}`
      : "",
    lens.strengths.length
      ? `Strengths to recognize:\n${bulletedLines(
          lens.strengths,
        )}`
      : "",
    lens.risks.length
      ? `Risks:\n${bulletedLines(lens.risks)}`
      : "",
    lens.questions.length
      ? `Questions:\n${bulletedLines(lens.questions)}`
      : "",
    lens.suggestionRules.length
      ? `Suggestion rules:\n${bulletedLines(
          lens.suggestionRules,
        )}`
      : "",
  ].filter(Boolean);

  return sections.length
    ? `${heading}\n${sections.join("\n\n")}`
    : "";
}

function formLensLines(lens: MuseFormLens) {
  const sections = [
    lens.evaluates.length
      ? `Evaluate:\n${bulletedLines(lens.evaluates)}`
      : "",
    lens.comparisonQuestions.length
      ? `Comparison questions:\n${bulletedLines(
          lens.comparisonQuestions,
        )}`
      : "",
    lens.sectionRules.length
      ? `Section rules:\n${bulletedLines(lens.sectionRules)}`
      : "",
    lens.risks.length
      ? `Risks:\n${bulletedLines(lens.risks)}`
      : "",
    lens.changeSignals.length
      ? `Signals of meaningful structural change:\n${bulletedLines(
          lens.changeSignals,
        )}`
      : "",
  ].filter(Boolean);

  return sections.length
    ? `FORM INTELLIGENCE\n${sections.join("\n\n")}`
    : "";
}

const EMPTY_LYRIC_LENS: MuseLyricLens = {
  strongestSignals: [],
  risks: [],
  reconstructionPriorities: [],
  suggestionRules: [],
};

const EMPTY_FORM_LENS: MuseFormLens = {
  evaluates: [],
  comparisonQuestions: [],
  sectionRules: [],
  risks: [],
  changeSignals: [],
};

const EMPTY_CREATIVE_LENS: MuseCreativeLens = {
  focus: [],
  strengths: [],
  risks: [],
  questions: [],
  suggestionRules: [],
};

export function defineMuse(
  input: MuseIdentityInput,
): MuseIdentity {
  const noticesFirst = input.noticesFirst ?? [];
  const coreCreativeTensions =
    input.coreCreativeTensions ?? [];
  const diagnosticFramework =
    input.diagnosticFramework ?? [];
  const lyricLens = input.lyricLens ?? EMPTY_LYRIC_LENS;
  const formLens = input.formLens ?? EMPTY_FORM_LENS;
  const melodyLens =
    input.melodyLens ?? EMPTY_CREATIVE_LENS;
  const performanceLens =
    input.performanceLens ?? EMPTY_CREATIVE_LENS;
  const audienceLens =
    input.audienceLens ?? EMPTY_CREATIVE_LENS;
  const preferredForms = input.preferredForms ?? [];
  const memoryPriorities = input.memoryPriorities ?? [];
  const collaborationMap = input.collaborationMap ?? [];
  const knowledgeTopics = input.knowledgeTopics ?? [];
  const evidenceHierarchy = input.evidenceHierarchy ?? [];
  const citationRules = input.citationRules ?? [];
  const knowledgeBoundaries = input.knowledgeBoundaries ?? [];

  const intelligenceSections = [
    noticesFirst.length
      ? `WHAT YOU NOTICE FIRST\n${bulletedLines(
          noticesFirst,
        )}`
      : "",

    coreCreativeTensions.length
      ? `CORE CREATIVE TENSIONS\n${bulletedLines(
          coreCreativeTensions,
        )}`
      : "",

    diagnosticFramework.length
      ? `DIAGNOSTIC FRAMEWORK\n${diagnosticLines(
          diagnosticFramework,
        )}`
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
        )}\n\nSuggestion rules:\n${bulletedLines(
          lyricLens.suggestionRules,
        )}`
      : "",

    formLensLines(formLens),

    creativeLensLines("MELODY INTELLIGENCE", melodyLens),

    creativeLensLines(
      "PERFORMANCE INTELLIGENCE",
      performanceLens,
    ),

    creativeLensLines(
      "AUDIENCE INTELLIGENCE",
      audienceLens,
    ),

    preferredForms.length
      ? `PREFERRED SONG FORMS\n${formPreferenceLines(
          preferredForms,
        )}`
      : "",

    memoryPriorities.length
      ? `WHAT YOU SHOULD REMEMBER\n${bulletedLines(
          memoryPriorities,
        )}`
      : "",

    collaborationMap.length
      ? `WHEN TO INVITE ANOTHER MUSE\n${collaborationLines(
          collaborationMap,
        )}`
      : "",

    knowledgeTopics.length
      ? `KNOWLEDGE TOPICS\n${bulletedLines(
          knowledgeTopics,
        )}`
      : "",

    evidenceHierarchy.length
      ? `EVIDENCE HIERARCHY\n${numberedLines(
          evidenceHierarchy,
        )}`
      : "",

    citationRules.length
      ? `CITATION RULES\n${bulletedLines(
          citationRules,
        )}`
      : "",

    knowledgeBoundaries.length
      ? `KNOWLEDGE BOUNDARIES\n${bulletedLines(
          knowledgeBoundaries,
        )}`
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

${intelligenceSections}

HUMAN AUTHORSHIP BOUNDARY
- The songwriter is the author. You are a coach, critic, teacher, and creative lens - not a ghostwriter.
- Do not write, complete, or rewrite lyric lines, verses, choruses, bridges, lyric hooks, or full songs for the songwriter.
- If the songwriter directly asks you to write lyrics or a song section, briefly state that the songwriter supplies the lyric language while you coach the creative choices, then immediately continue through your own Muse specialty.
- You may analyze and critique songwriter-provided lyrics, compare alternatives the songwriter has written, identify strengths and weaknesses, ask focused questions, suggest structural approaches, emotional targets, imagery directions, rhyme families, word banks, prosody or melodic strategies, and exercises that help the songwriter discover their own language.
- When discussing lyric examples already supplied in the context, quote only as much as needed for analysis and identify them as songwriter-provided material.
- Do not smuggle newly written lyric language into examples, recommendations, tasks, memory candidates, lyricWork, or any other structured field.
- This boundary is absolute and is not changed by the songwriter giving permission, approval, or a "go-ahead." Never frame lyric generation as something you could do later or with permission. Do not say things such as "I can write with you," "I can draft lines," "if you want, I can write," or "I will not write lines without your go-ahead." You help the songwriter discover, develop, and evaluate possibilities; the songwriter supplies the lyric language.
- Keep the redirect useful and creative: preserve momentum rather than ending with a refusal.

WORKING RULES
- Use only the song context that iDreamMusic provides.
- Treat accepted memories as prior songwriter decisions or preferences, not as universal facts.
- Treat proposed memories as unconfirmed and never state them as settled decisions.
- Notice meaningful changes between the current context and the previous context snapshot.
- Compare the current version with earlier versions only when the context provides them.
- Never claim to have heard audio unless actual audio analysis is included in the context.
- Never claim lyrics, facts, history, beliefs, intentions, or performance details that are not present.
- Clearly distinguish observations from optional creative suggestions.
- Clearly distinguish transcript text, existing lyrics, and writer notes; do not introduce newly proposed lyric lines.
- Preserve the songwriter's voice, authorship, ownership, and final decision-making.
- Offer a small number of high-value improvements rather than overwhelming the songwriter.
- Do not imitate a living songwriter or artist's exact style.
- When the song lacks enough material, say what is missing and ask focused questions.
- Do not declare the song finished. Help the songwriter decide.
- Treat the other Muses as collaborators with different specialties, not competitors.
- When suggesting a collaborator, tie the invitation to a specific detected need.
- When suggesting a memory, save only information that would genuinely improve a future session.
- Never silently change lyrics, tasks, metadata, versions, memories, or creative decisions.
- Diagnostic scores are working estimates, not objective truth. Explain the evidence behind them.

Your purpose is not to replace the songwriter. Your purpose is to help the songwriter recognize what the song is trying to become through the lens of ${input.domain}.
  `.trim();

  return {
    ...input,
    noticesFirst,
    coreCreativeTensions,
    diagnosticFramework,
    lyricLens,
    formLens,
    melodyLens,
    performanceLens,
    audienceLens,
    preferredForms,
    memoryPriorities,
    collaborationMap,
    knowledgeTopics,
    evidenceHierarchy,
    citationRules,
    knowledgeBoundaries,
    systemPrompt,
  };
}
