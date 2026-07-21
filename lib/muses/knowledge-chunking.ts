import { createHash } from "node:crypto";

export type KnowledgeChunkDraft = {
  chunkIndex: number;
  heading: string | null;
  content: string;
  sourceLocator: string | null;
  citationText: string;
  tokenEstimate: number;
  contentHash: string;
};

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function contentHash(value: string) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

export function estimateTokens(value: string) {
  return Math.max(
    1,
    Math.ceil(value.length / 4),
  );
}

function paragraphUnits(value: string) {
  return normalizeWhitespace(value)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function chunkKnowledgeDocument({
  text,
  citationText,
  sourceLocator,
  maxCharacters = 2200,
  overlapCharacters = 250,
}: {
  text: string;
  citationText: string;
  sourceLocator?: string | null;
  maxCharacters?: number;
  overlapCharacters?: number;
}): KnowledgeChunkDraft[] {
  const paragraphs = paragraphUnits(text);

  if (!paragraphs.length) {
    return [];
  }

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current
      ? `${current}\n\n${paragraph}`
      : paragraph;

    if (
      candidate.length <= maxCharacters ||
      !current
    ) {
      current = candidate;
      continue;
    }

    chunks.push(current);

    const overlap =
      current.length > overlapCharacters
        ? current.slice(
            current.length - overlapCharacters,
          )
        : current;

    current = normalizeWhitespace(
      `${overlap}\n\n${paragraph}`,
    );

    while (current.length > maxCharacters) {
      chunks.push(
        current.slice(0, maxCharacters),
      );

      current = current.slice(
        Math.max(
          1,
          maxCharacters - overlapCharacters,
        ),
      );
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map((content, chunkIndex) => {
    const firstLine =
      content.split("\n")[0]?.trim() ?? "";

    const heading =
      firstLine.length > 0 &&
      firstLine.length <= 120
        ? firstLine
        : null;

    return {
      chunkIndex,
      heading,
      content,
      sourceLocator:
        sourceLocator ?? null,
      citationText,
      tokenEstimate:
        estimateTokens(content),
      contentHash:
        contentHash(content),
    };
  });
}
