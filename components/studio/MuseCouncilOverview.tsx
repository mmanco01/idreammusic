"use client";

import type {
  MuseIntelligenceResult,
  MuseRecommendation,
} from "@/lib/muses/intelligence";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";

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

function recommendationForEntry(entry?: MuseCouncilEntry) {
  if (!entry?.intelligence?.recommendations.length) {
    return null;
  }

  return (
    entry.intelligence.recommendations.find(
      (recommendation) => recommendation.priority === "now",
    ) ?? entry.intelligence.recommendations[0]
  );
}

function recommendationText(recommendation: MuseRecommendation) {
  const reasoning = recommendation.reasoning.trim();

  if (!reasoning) {
    return recommendation.title;
  }

  return `${recommendation.title} — ${reasoning}`;
}

function buildInsights(
  entries: MuseCouncilEntry[],
  leadEntry?: MuseCouncilEntry,
) {
  const candidates: string[] = [];

  if (leadEntry?.intelligence?.primaryObservation.statement) {
    candidates.push(leadEntry.intelligence.primaryObservation.statement);
  } else if (leadEntry) {
    candidates.push(entryInsight(leadEntry));
  }

  const leadRecommendation = recommendationForEntry(leadEntry);
  if (leadRecommendation) {
    candidates.push(recommendationText(leadRecommendation));
  }

  for (const entry of entries) {
    if (entry.id === leadEntry?.id) continue;

    candidates.push(entryInsight(entry));

    const recommendation = recommendationForEntry(entry);
    if (recommendation) {
      candidates.push(recommendationText(recommendation));
    }
  }

  const seen = new Set<string>();

  return candidates
    .map((candidate) => truncate(candidate, 230))
    .filter((candidate) => {
      const key = candidate.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
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

  const leadEntry = orderedEntries.find((entry) => entry.museSlug === leadMuse.slug);
  const leadRecommendation = recommendationForEntry(leadEntry);
  const fallbackRecommendation = orderedEntries
    .map((entry) => recommendationForEntry(entry))
    .find((recommendation): recommendation is MuseRecommendation => Boolean(recommendation));
  const nextRecommendation = leadRecommendation ?? fallbackRecommendation;
  const insights = buildInsights(orderedEntries, leadEntry);
  const alignment = findAlignment(orderedEntries);
  const difference = findDifference(orderedEntries);

  const headline =
    orderedEntries.length === 0
      ? `${leadMuse.name} is ready to help reveal what this song wants to become.`
      : orderedEntries.length === 1
        ? truncate(entryInsight(leadEntry ?? orderedEntries[0]), 220)
        : `${orderedEntries.length} Muses have contributed. The clearest current direction is ${truncate(
            entryInsight(leadEntry ?? orderedEntries[0]),
            185,
          )}`;

  const nextTitle =
    nextRecommendation?.title ||
    (orderedEntries.length === 0
      ? `Ask ${leadMuse.name} the first focused question`
      : `Continue with ${leadMuse.name}`);

  const nextDescription =
    nextRecommendation?.reasoning ||
    (orderedEntries.length === 0
      ? `Start with the lead Muse. The Council will summarize the strongest insight and next move after the first response.`
      : `Use the Council summary as your guide, then ask ${leadMuse.name} one focused follow-up question.`);

  return (
    <section className="council-overview" id="muse-council-summary">
      <div className="council-overview__header">
        <div className="council-overview__headline">
          <div className="eyebrow">Council direction</div>
          <h3 className="h3">
            {orderedEntries.length ? "What the Council hears" : "Begin with the lead Muse"}
          </h3>
          <p className="copy">{headline}</p>
        </div>

        <div className="council-lead-muse">
          <div className="eyebrow">Lead Muse</div>
          <strong>{leadMuse.name} — {leadMuse.domain}</strong>
          <span className="info-badge">Primary creative partner</span>
        </div>
      </div>

      {status === "loading" ? (
        <AnalysisLoadingState
          compact
          title="The Muse Council is refreshing"
          messages={["Gathering the latest perspectives and rebuilding the Council direction."]}
        />
      ) : null}

      {status === "error" ? (
        <div className="statusMessage statusError" style={{ marginTop: "0.8rem" }}>
          The Council summary could not be refreshed. Your saved Muse conversations remain available below.
        </div>
      ) : null}

      {status !== "loading" ? (
        <div className="recommended-action council-recommended-action">
          <div className="recommended-action__eyebrow">Recommended next move</div>
          <h4 className="recommended-action__title">{nextTitle}</h4>
          <div className="recommended-action__description">
            <p>{nextDescription}</p>
          </div>
          <div className="recommended-action__controls">
            <button
              type="button"
              className="button primary"
              onClick={() => onOpenMuse(leadMuse.slug)}
            >
              {orderedEntries.length ? `Continue with ${leadMuse.name}` : `Ask ${leadMuse.name}`}
            </button>
          </div>
        </div>
      ) : null}

      {insights.length ? (
        <div className="council-insights">
          <div className="eyebrow">Most useful insights</div>
          <ol>
            {insights.map((insight, index) => (
              <li key={`${index}-${insight}`}>{insight}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {orderedEntries.length > 1 ? (
        <details className="council-disclosure">
          <summary>Where the Muses agree—and where they differ</summary>
          <div className="council-alignment-grid">
            <div>
              <div className="eyebrow">Areas of agreement</div>
              <p className="copy">
                {alignment ||
                  "The Muses are not repeating one clear theme yet. The song may still be defining its central question."}
              </p>
            </div>
            <div>
              <div className="eyebrow">Productive difference</div>
              <p className="copy">
                {difference ||
                  "The perspectives currently reinforce one another more than they disagree. Invite another Muse only when the song needs a genuinely different lens."}
              </p>
            </div>
          </div>
        </details>
      ) : null}

      {orderedEntries.length ? (
        <details className="council-disclosure">
          <summary>Full Muse counsel ({orderedEntries.length})</summary>
          <div className="council-full-responses">
            {orderedEntries.map((entry) => (
              <details key={`full-${entry.id}`} className="council-response">
                <summary>
                  <span>{entry.museName}</span>
                  <span>{truncate(entryInsight(entry), 125)}</span>
                </summary>

                <div className="copy council-response__content">{entry.content}</div>

                {entry.intelligence?.recommendations.length ? (
                  <div className="council-response__moves">
                    <div className="eyebrow">Recommended moves</div>
                    <ul className="copy">
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
                  className="button secondary"
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
