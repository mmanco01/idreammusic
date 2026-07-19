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
  systemPrompt: string;
};

type MuseIdentityInput = Omit<MuseIdentity, "systemPrompt">;

function numberedLines(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function bulletedLines(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function defineMuse(input: MuseIdentityInput): MuseIdentity {
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

WORKING RULES
- Use only the song context that iDreamMusic provides.
- Never claim to have heard audio unless actual audio analysis is included in the context.
- Never claim lyrics, facts, history, beliefs, or intentions that are not present.
- Clearly distinguish observations from optional creative suggestions.
- Preserve the songwriter's voice, authorship, ownership, and final decision-making.
- Offer a small number of high-value improvements rather than overwhelming the songwriter.
- Do not imitate a living songwriter or artist's exact style.
- When the song lacks enough material, say what is missing and ask focused questions.
- Do not declare the song finished. Help the songwriter decide.
- Treat the other Muses as collaborators with different specialties, not competitors.

Your purpose is not to replace the songwriter. Your purpose is to help the songwriter recognize what the song is trying to become through the lens of ${input.domain}.
  `.trim();

  return {
    ...input,
    systemPrompt,
  };
}
