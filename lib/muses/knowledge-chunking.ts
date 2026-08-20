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

type KnowledgeUnit = {
  heading: string | null;
  text: string;
};

const MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
  ["ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â", "—"],
  ["Ã¢ÂÂ", "—"],
  ["Ã¢â‚¬â€", "—"],
  ["Ã¢ÂÂ", "–"],
  ["Ã¢â‚¬â€œ", "–"],
  ["Ã¢ÂÂ", "’"],
  ["Ã¢â‚¬â„¢", "’"],
  ["Ã¢ÂÂ", "“"],
  ["Ã¢â‚¬Å“", "“"],
  ["Ã¢ÂÂ", "”"],
  ["Ã¢â‚¬Â", "”"],
  ["Ã¢ÂÂ¦", "…"],
  ["Ã¢â‚¬Â¦", "…"],
  ["Â ", " "],
];

export function normalizeKnowledgeText(value: string) {
  let normalized = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC");

  for (const [broken, repaired] of MOJIBAKE_REPLACEMENTS) {
    normalized = normalized.split(broken).join(repaired);
  }

  return normalized
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
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

function cleanHeading(line: string): string | null {
  const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
  if (!match) return null;

  const heading = match[1].trim();
  return heading || null;
}

function splitWords(
  value: string,
  maxCharacters: number,
): string[] {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return [];

  const pieces: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current
      ? `${current} ${word}`
      : word;

    if (candidate.length <= maxCharacters || !current) {
      current = candidate;
      continue;
    }

    pieces.push(current);
    current = word;
  }

  if (current) pieces.push(current);
  return pieces;
}

function splitSentences(
  value: string,
): string[] {
  const text = value.trim();
  if (!text) return [];

  const matches =
    text.match(
      /[^.!?]+(?:[.!?]+(?=\s|$)|$)/g,
    ) ?? [text];

  return matches
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitLongBlock(
  value: string,
  maxCharacters: number,
): string[] {
  const text = value.trim();

  if (!text) return [];
  if (text.length <= maxCharacters) {
    return [text];
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const looksLikeList =
    lines.length > 1 &&
    lines.every((line) =>
      /^(?:[-*+]|\d+[.)])\s+/.test(line),
    );

  if (looksLikeList) {
    const pieces: string[] = [];
    let current = "";

    for (const line of lines) {
      if (line.length > maxCharacters) {
        if (current) {
          pieces.push(current);
          current = "";
        }
        pieces.push(
          ...splitWords(line, maxCharacters),
        );
        continue;
      }

      const candidate = current
        ? `${current}\n${line}`
        : line;

      if (candidate.length <= maxCharacters) {
        current = candidate;
      } else {
        pieces.push(current);
        current = line;
      }
    }

    if (current) pieces.push(current);
    return pieces;
  }

  const sentences = splitSentences(text);
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const sentencePieces =
      sentence.length <= maxCharacters
        ? [sentence]
        : splitWords(
            sentence,
            maxCharacters,
          );

    for (const piece of sentencePieces) {
      const candidate = current
        ? `${current} ${piece}`
        : piece;

      if (candidate.length <= maxCharacters) {
        current = candidate;
      } else {
        if (current) pieces.push(current);
        current = piece;
      }
    }
  }

  if (current) pieces.push(current);
  return pieces;
}

function markdownUnits(
  value: string,
  maxCharacters: number,
  documentTitle?: string | null,
): KnowledgeUnit[] {
  const text =
    normalizeKnowledgeText(value);

  if (!text) return [];

  let documentHeading =
    documentTitle?.trim() || null;
  let activeHeading =
    documentHeading;

  const units: KnowledgeUnit[] = [];
  let blockLines: string[] = [];

  function flushBlock() {
    if (!blockLines.length) return;

    const block =
      blockLines.join("\n").trim();
    blockLines = [];

    if (!block) return;

    /*
     * Candidate documents begin with administrative preamble
     * such as "Muse:" and "Candidate version:". Those values
     * already live in structured metadata and should not
     * consume vector-retrieval slots as standalone knowledge.
     */
    const blockLinesForMetadataCheck =
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const isAdministrativePreamble =
      blockLinesForMetadataCheck.length > 0 &&
      blockLinesForMetadataCheck.every((line) =>
        /^(?:Muse|Candidate version):\s*/i.test(line),
      );

    if (isAdministrativePreamble) {
      return;
    }

    const pieces =
      splitLongBlock(
        block,
        maxCharacters,
      );

    for (const piece of pieces) {
      units.push({
        heading:
          activeHeading ||
          documentHeading ||
          null,
        text: piece,
      });
    }
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    const heading =
      cleanHeading(line.trim());

    if (heading) {
      flushBlock();

      if (
        /^#\s+/.test(line.trim()) &&
        !documentHeading
      ) {
        documentHeading = heading;
      }

      activeHeading = heading;
      continue;
    }

    if (!line.trim()) {
      flushBlock();
      continue;
    }

    blockLines.push(line);
  }

  flushBlock();
  return units;
}

function trailingOverlapUnits(
  units: KnowledgeUnit[],
  overlapCharacters: number,
): KnowledgeUnit[] {
  if (
    overlapCharacters <= 0 ||
    !units.length
  ) {
    return [];
  }

  const selected: KnowledgeUnit[] = [];
  let size = 0;
  const heading =
    units[units.length - 1]?.heading ??
    null;

  for (
    let index = units.length - 1;
    index >= 0;
    index -= 1
  ) {
    const unit = units[index];

    if (unit.heading !== heading) {
      break;
    }

    const nextSize =
      size +
      unit.text.length +
      (selected.length ? 2 : 0);

    if (
      nextSize > overlapCharacters
    ) {
      break;
    }

    selected.unshift(unit);
    size = nextSize;
  }

  return selected;
}

export function chunkKnowledgeDocument({
  text,
  citationText,
  sourceLocator,
  documentTitle,
  maxCharacters = 2200,
  overlapCharacters = 250,
}: {
  text: string;
  citationText: string;
  sourceLocator?: string | null;
  documentTitle?: string | null;
  maxCharacters?: number;
  overlapCharacters?: number;
}): KnowledgeChunkDraft[] {
  const units =
    markdownUnits(
      text,
      maxCharacters,
      documentTitle,
    );

  if (!units.length) {
    return [];
  }

  const chunkUnits:
    KnowledgeUnit[][] = [];

  let current:
    KnowledgeUnit[] = [];

  function currentText(
    candidateUnits: KnowledgeUnit[],
  ) {
    return candidateUnits
      .map((unit) => unit.text)
      .join("\n\n");
  }

  for (const unit of units) {
    const headingChanged =
      current.length > 0 &&
      current[0].heading !==
        unit.heading;

    const candidate =
      current.length
        ? [...current, unit]
        : [unit];

    if (
      !headingChanged &&
      currentText(candidate).length <=
        maxCharacters
    ) {
      current = candidate;
      continue;
    }

    if (current.length) {
      chunkUnits.push(current);

      const overlap =
        trailingOverlapUnits(
          current,
          overlapCharacters,
        ).filter(
          (item) =>
            item.heading ===
            unit.heading,
        );

      current = overlap.length
        ? [...overlap, unit]
        : [unit];
    } else {
      current = [unit];
    }

    /*
     * splitLongBlock guarantees an individual unit is
     * already <= maxCharacters. This guard protects
     * future callers if that invariant changes.
     */
    if (
      currentText(current).length >
      maxCharacters
    ) {
      const pieces =
        splitLongBlock(
          currentText(current),
          maxCharacters,
        );

      current = [];
      for (const piece of pieces) {
        chunkUnits.push([
          {
            heading:
              unit.heading,
            text: piece,
          },
        ]);
      }
    }
  }

  if (current.length) {
    chunkUnits.push(current);
  }

  return chunkUnits
    .map(
      (
        groupedUnits,
        chunkIndex,
      ): KnowledgeChunkDraft | null => {
        const content =
          groupedUnits
            .map(
              (unit) =>
                unit.text,
            )
            .join("\n\n")
            .trim();

        if (!content) return null;

        const heading =
          groupedUnits[0]
            ?.heading ||
          documentTitle?.trim() ||
          null;

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
      },
    )
    .filter(
      (
        value,
      ): value is KnowledgeChunkDraft =>
        value !== null,
    );
}
