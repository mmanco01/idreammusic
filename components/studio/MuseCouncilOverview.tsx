"use client";

import type { MuseIntelligenceResult } from "@/lib/muses/intelligence";

export type MuseCouncilEntry = {
  id: string;
  museSlug: string;
  museName: string;
  domain: string;
  kind: "primary" | "collaborator" | "synthesis" | "system";
  content: string;
  question?: string;
  comparisonWith?: string;
  createdAt: string;
  intelligence?: MuseIntelligenceResult;
};

type MuseOption = {
  slug: string;
  name: string;
  domain: string;
};

type Props = {
  leadMuse: MuseOption;
  entries: MuseCouncilEntry[];
  status: "idle" | "loading" | "error";
  onOpenMuse: (museSlug: string) => void;
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "another",
  "because",
  "before",
  "being",
  "between",
  "both",
  "could",
  "creative",
  "does",
  "from",
  "have",
  "into",
  "more",
  "music",
  "muse",
  "needs",
  "only",
  "should",
  "song",
  "strong",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "toward",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "work",
  "would",
  "your",
]);

function truncate(value: string, maxLength = 190) {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength).replace(/\s+\S*$/, "")}…`;
}

function firstSentence(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  const match = clean.match(/^(.+?[.!?])(?:\s|$)/);
  return truncate(match?.[1] ?? clean);
}

function entryInsight(entry: MuseCouncilEntry) {
  return (
    entry.intelligence?.primaryObservation.statement ||
    entry.intelligence?.recommendations.find(
      (recommendation) => recommendation.priority === "now",
    )?.title ||
    entry.intelligence?.recommendations[0]?.title ||
    firstSentence(entry.content)
  );
}

function stemToken(value: string) {
  let token = value.toLowerCase();

  if (token.length > 7 && token.endsWith("ing")) {
    token = token.slice(0, -3);
  } else if (token.length > 6 && token.endsWith("ed")) {
    token = token.slice(0, -2);
  } else if (token.length > 5 && token.endsWith("es")) {
    token = token.slice(0, -2);
  } else if (token.length > 4 && token.endsWith("s")) {
    token = token.slice(0, -1);
  }

  return token;
}

function entryTerms(entry: MuseCouncilEntry) {
  const source = [
    entry.intelligence?.primaryObservation.statement,
    ...(entry.intelligence?.recommendations.flatMap((recommendation) => [
      recommendation.title,
      recommendation.reasoning,
    ]) ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  const terms = new Map<string, string>();

  for (const rawToken of source.match(/[A-Za-z][A-Za-z'-]{3,}/g) ?? []) {
    const display = rawToken.toLowerCase().replace(/^'+|'+$/g, "");
    const stem = stemToken(display);

    if (STOP_WORDS.has(display) || STOP_WORDS.has(stem)) {
      continue;
    }

    if (!terms.has(stem)) {
      terms.set(stem, display);
    }
  }

  return terms;
}

function naturalList(values: string[]) {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function findAlignment(entries: MuseCouncilEntry[]) {
  let best:
    | {
        left: MuseCouncilEntry;
        right: MuseCouncilEntry;
        terms: string[];
        score: number;
      }
    | undefined;

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < entries.length;
      rightIndex += 1
    ) {
      const left = entries[leftIndex];
      const right = entries[rightIndex];
      const leftTerms = entryTerms(left);
      const rightTerms = entryTerms(right);
      const shared = [...leftTerms.keys()].filter((term) => rightTerms.has(term));
      const score = shared.length / Math.max(1, Math.min(leftTerms.size, rightTerms.size));

      if (shared.length < 2 || score < 0.12) {
        continue;
      }

      const terms = shared
        .sort((a, b) => b.length - a.length)
        .slice(0, 3)
        .map((term) => leftTerms.get(term) || rightTerms.get(term) || term);

      if (!best || score > best.score) {
        best = { left, right, terms, score };
      }
    }
  }

  if (!best) {
    return null;
  }

  return `${best.left.museName} and ${best.right.museName} both return to ${naturalList(
    best.terms,
  )}.`;
}

function findDifference(entries: MuseCouncilEntry[]) {
  const explicitDifference = entries.find(
    (entry) => entry.kind === "collaborator" && entry.comparisonWith,
  );

  if (explicitDifference) {
    const marker = explicitDifference.content
      .toLowerCase()
      .lastIndexOf("how my perspective differs");
    const differenceText =
      marker >= 0
        ? explicitDifference.content.slice(marker).replace(/^.*?\n+/, "")
        : entryInsight(explicitDifference);

    return `${explicitDifference.museName} adds a different lens from ${
      explicitDifference.comparisonWith
    }: ${truncate(differenceText, 240)}`;
  }

  if (entries.length < 2) {
    return null;
  }

  let bestPair:
    | {
        left: MuseCouncilEntry;
        right: MuseCouncilEntry;
        score: number;
      }
    | undefined;

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < entries.length;
      rightIndex += 1
    ) {
      const left = entries[leftIndex];
      const right = entries[rightIndex];
      const leftTerms = entryTerms(left);
      const rightTerms = entryTerms(right);
      const shared = [...leftTerms.keys()].filter((term) => rightTerms.has(term));
      const union = new Set([...leftTerms.keys(), ...rightTerms.keys()]);
      const score = union.size ? shared.length / union.size : 1;

      if (!bestPair || score < bestPair.score) {
        bestPair = { left, right, score };
      }
    }
  }

  if (!bestPair) {
    return null;
  }

  return `${bestPair.left.museName} emphasizes “${truncate(
    entryInsight(bestPair.left),
    115,
  )}” while ${bestPair.right.museName} emphasizes “${truncate(
    entryInsight(bestPair.right),
    115,
  )}.”`;
}

export function MuseCouncilOverview({
  leadMuse,
  entries,
  status,
  onOpenMuse,
}: Props) {
  const orderedEntries = [...entries].sort((left, right) => {
    if (left.museSlug === leadMuse.slug) return -1;
    if (right.museSlug === leadMuse.slug) return 1;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const topInsights = orderedEntries.slice(0, 3);
  const alignment = findAlignment(orderedEntries);
  const difference = findDifference(orderedEntries);
  const leadEntry = orderedEntries.find((entry) => entry.museSlug === leadMuse.slug);

  const summary =
    status === "loading"
      ? "Gathering the latest Muse perspectives…"
      : orderedEntries.length === 0
        ? `${leadMuse.name} is your lead Muse. Ask the first question to begin the council.`
        : orderedEntries.length === 1
          ? `${leadMuse.name} has opened the council. Invite another Muse when the song needs a second creative lens.`
          : `${orderedEntries.length} Muses have contributed. The clearest current direction begins with ${truncate(
              entryInsight(leadEntry ?? orderedEntries[0]),
              175,
            )}`;

  return (
    <section
      style={{
        marginTop: "1rem",
        padding: "1rem",
        borderRadius: 18,
        border: "1px solid rgba(156, 137, 220, 0.48)",
        background:
          "linear-gradient(145deg, rgba(86, 67, 145, 0.16), rgba(0,0,0,0.12))",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "0.75rem",
          alignItems: "flex-start",
        }}
      >
        <div style={{ maxWidth: 820 }}>
          <div className="eyebrow">Council summary</div>
          <h3 className="h3" style={{ margin: "0.35rem 0 0" }}>
            Headline first. Full counsel when you need it.
          </h3>
          <p className="copy" style={{ margin: "0.55rem 0 0" }}>
            {summary}
          </p>
        </div>

        <div
          style={{
            minWidth: 210,
            padding: "0.75rem 0.85rem",
            borderRadius: 14,
            border: "1px solid rgba(220, 182, 92, 0.4)",
            background: "rgba(137, 96, 31, 0.12)",
          }}
        >
          <div className="eyebrow">Lead Muse</div>
          <strong className="copy" style={{ display: "block", marginTop: "0.25rem" }}>
            {leadMuse.name} — {leadMuse.domain}
          </strong>
          <span className="pill" style={{ display: "inline-flex", marginTop: "0.45rem" }}>
            Primary creative partner
          </span>
        </div>
      </div>

      {status === "error" ? (
        <div className="statusMessage statusError" style={{ marginTop: "0.8rem" }}>
          The council summary could not be refreshed. Individual Muse conversations are still available below.
        </div>
      ) : null}

      {topInsights.length ? (
        <div style={{ marginTop: "1rem" }}>
          <div className="eyebrow">Most relevant now</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))",
              gap: "0.7rem",
              marginTop: "0.55rem",
            }}
          >
            {topInsights.map((entry) => (
              <article
                key={entry.id}
                style={{
                  padding: "0.85rem",
                  borderRadius: 14,
                  border:
                    entry.museSlug === leadMuse.slug
                      ? "1px solid rgba(220, 182, 92, 0.5)"
                      : "1px solid var(--line)",
                  background:
                    entry.museSlug === leadMuse.slug
                      ? "rgba(137, 96, 31, 0.1)"
                      : "rgba(255,255,255,0.025)",
                }}
              >
                <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                  <span className="eyebrow">
                    {entry.museName} — {entry.domain}
                  </span>
                  {entry.museSlug === leadMuse.slug ? (
                    <span className="pill">Lead Muse</span>
                  ) : null}
                </div>
                <p className="copy" style={{ margin: "0.45rem 0 0" }}>
                  {truncate(entryInsight(entry), 210)}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {orderedEntries.length > 1 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "0.7rem",
            marginTop: "0.9rem",
          }}
        >
          <div
            style={{
              padding: "0.85rem",
              borderRadius: 14,
              border: "1px solid rgba(220, 182, 92, 0.34)",
              background: "rgba(137, 96, 31, 0.07)",
            }}
          >
            <div className="eyebrow">Areas of agreement</div>
            <p className="copy" style={{ margin: "0.4rem 0 0" }}>
              {alignment ||
                "The Muses are not repeating one clear theme yet. That can be useful: the song may still be defining its central question."}
            </p>
          </div>

          <div
            style={{
              padding: "0.85rem",
              borderRadius: 14,
              border: "1px solid rgba(156, 137, 220, 0.42)",
              background: "rgba(86, 67, 145, 0.08)",
            }}
          >
            <div className="eyebrow">Productive difference</div>
            <p className="copy" style={{ margin: "0.4rem 0 0" }}>
              {difference ||
                "Invite another Muse to expose a genuinely different priority or creative risk."}
            </p>
          </div>
        </div>
      ) : null}

      {orderedEntries.length ? (
        <details style={{ marginTop: "0.9rem" }}>
          <summary className="copy" style={{ cursor: "pointer", fontWeight: 700 }}>
            Latest full Muse responses · {orderedEntries.length}
          </summary>

          <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.7rem" }}>
            {orderedEntries.map((entry) => (
              <details
                key={`full-${entry.id}`}
                style={{
                  padding: "0.75rem 0.85rem",
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  background: "rgba(0,0,0,0.1)",
                }}
              >
                <summary className="copy" style={{ cursor: "pointer", fontWeight: 700 }}>
                  {entry.museName} — {truncate(entryInsight(entry), 115)}
                </summary>

                <div className="copy" style={{ marginTop: "0.65rem", whiteSpace: "pre-wrap" }}>
                  {entry.content}
                </div>

                {entry.intelligence?.recommendations.length ? (
                  <div style={{ marginTop: "0.75rem" }}>
                    <div className="eyebrow">Recommended moves</div>
                    <ul className="copy" style={{ margin: "0.35rem 0 0 1.1rem" }}>
                      {entry.intelligence.recommendations.map((recommendation) => (
                        <li key={`${entry.id}-${recommendation.title}`}>
                          <strong>{recommendation.title}</strong> — {recommendation.reasoning}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="button"
                  style={{ marginTop: "0.75rem" }}
                  onClick={() => onOpenMuse(entry.museSlug)}
                >
                  Continue with {entry.museName}
                </button>
              </details>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
