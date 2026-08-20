"use client";

import type {
  MuseIntelligenceResult,
  MuseLensAssessment,
} from "@/lib/muses/intelligence";
import type {
  MuseKnowledgeCitation,
  MuseKnowledgeRetrievalMetrics,
} from "@/lib/muses/knowledge-types";

export type MuseTaskActionState = {
  status: "created" | "dismissed";
  taskId?: string | null;
} | null;

type MuseOption = {
  slug: string;
  name: string;
  domain: string;
};

type Props = {
  intelligence: MuseIntelligenceResult;
  messageId: string;
  museName: string;
  museOptions: readonly MuseOption[];
  taskAction: MuseTaskActionState;
  knowledgeCitations: MuseKnowledgeCitation[];
  knowledgeMetrics?: MuseKnowledgeRetrievalMetrics;
  taskBusy: boolean;
  collaborationBusy: boolean;
  onTaskAction: (
    action: "create_task" | "dismiss_task",
  ) => void;
  onInviteMuse: (museSlug: string) => void;
};

function confidenceLabel(value: number) {
  const percent = Math.round(value * 100);
  return `${percent}% confidence`;
}

function confidenceBand(value: number) {
  if (value >= 0.8) return "High";
  if (value >= 0.6) return "Moderate";
  return "Exploratory";
}

function percentLabel(value: number | null | undefined) {
  return typeof value === "number"
    ? `${Math.round(value * 100)}%`
    : "Not measured";
}

function priorityLabel(
  priority: "now" | "later" | "optional",
) {
  if (priority === "now") return "Work now";
  if (priority === "later") return "Work later";
  return "Optional";
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    transcript: "Transcript",
    existing_lyric: "Existing lyric",
    writer_note: "Writer note",
    muse_suggestion: "Muse suggestion",
  };

  return labels[source] ?? source;
}

function hasMeaningfulText(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /[\p{L}\p{N}]/u.test(value.trim())
  );
}

function hasMeaningfulLens(
  assessment:
    | MuseLensAssessment
    | null
    | undefined,
) {
  if (!assessment) {
    return false;
  }

  return [
    assessment.summary,
    assessment.nextMove,
    ...assessment.strengths,
    ...assessment.risks,
  ].some(hasMeaningfulText);
}

function LensCard({
  title,
  assessment,
}: {
  title: string;
  assessment: MuseLensAssessment;
}) {
  return (
    <div
      style={{
        padding: "0.8rem",
        border: "1px solid var(--line)",
        borderRadius: 14,
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div className="eyebrow">{title}</div>
      <p className="copy" style={{ margin: "0.35rem 0 0" }}>
        {assessment.summary}
      </p>

      {assessment.strengths.length ? (
        <div style={{ marginTop: "0.55rem" }}>
          <strong className="copy">Strengths</strong>
          <ul className="copy" style={{ margin: "0.25rem 0 0 1.1rem" }}>
            {assessment.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {assessment.risks.length ? (
        <div style={{ marginTop: "0.55rem" }}>
          <strong className="copy">Risks</strong>
          <ul className="copy" style={{ margin: "0.25rem 0 0 1.1rem" }}>
            {assessment.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="copy" style={{ margin: "0.55rem 0 0" }}>
        <strong>Next move:</strong> {assessment.nextMove}
      </p>
      <p
        className="copy"
        style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", opacity: 0.72 }}
      >
        {confidenceLabel(assessment.confidence)}
      </p>
    </div>
  );
}

export function MuseIntelligenceDetails({
  intelligence,
  messageId,
  museName,
  museOptions,
  taskAction,
  knowledgeCitations,
  knowledgeMetrics,
  taskBusy,
  collaborationBusy,
  onTaskAction,
  onInviteMuse,
}: Props) {
  const collaborator = intelligence.suggestedCollaborator
    ? museOptions.find(
        (option) =>
          option.slug === intelligence.suggestedCollaborator?.museSlug,
      )
    : null;

  const meaningfulSuggestedLines =
    intelligence.lyricWork?.suggestedLines.filter(
      (line) => hasMeaningfulText(line.text),
    ) ?? [];
  const hasLyricWork = Boolean(
    intelligence.lyricWork &&
      (hasMeaningfulText(
        intelligence.lyricWork.likelyLyric,
      ) ||
        meaningfulSuggestedLines.length),
  );

  const meaningfulFormAlternatives =
    intelligence.formWork?.alternatives.filter(
      hasMeaningfulText,
    ) ?? [];
  const hasFormWork = Boolean(
    intelligence.formWork &&
      (hasMeaningfulText(
        intelligence.formWork.recommendedForm,
      ) ||
        hasMeaningfulText(
          intelligence.formWork.reasoning,
        ) ||
        meaningfulFormAlternatives.length),
  );

  const meaningfulUnresolvedQuestions =
    intelligence.unresolvedQuestions.filter(
      hasMeaningfulText,
    );

  const availableLenses = [
    ["Lyric lens", intelligence.lensAssessments.lyric],
    ["Form lens", intelligence.lensAssessments.form],
    ["Melody lens", intelligence.lensAssessments.melody],
    ["Performance lens", intelligence.lensAssessments.performance],
    ["Audience lens", intelligence.lensAssessments.audience],
  ].filter(
    (
      entry,
    ): entry is [string, MuseLensAssessment] =>
      hasMeaningfulLens(
        entry[1] as
          | MuseLensAssessment
          | null
          | undefined,
      ),
  );

  const lensConfidence = availableLenses.length
    ? availableLenses.reduce(
        (sum, [, assessment]) => sum + assessment.confidence,
        0,
      ) / availableLenses.length
    : intelligence.primaryObservation.confidence;

  const evidenceConfidence =
    knowledgeMetrics?.averageRelevance ??
    (knowledgeCitations.length
      ? knowledgeCitations.reduce(
          (sum, citation) => sum + citation.relevanceScore,
          0,
        ) / knowledgeCitations.length
      : 0);

  const evidencePerspectives = Array.from(
    new Set(
      knowledgeCitations.flatMap((citation) => [
        citation.tradition,
        citation.evidenceClassification.replace(/_/g, " "),
      ]),
    ),
  ).filter((value): value is string => Boolean(value));

  return (
    <div
      style={{
        marginTop: "0.65rem",
        padding: "0.9rem",
        border: "1px solid rgba(220, 182, 92, 0.34)",
        borderRadius: 16,
        background: "rgba(0,0,0,0.12)",
      }}
    >
      <div className="eyebrow">Deep Muse Intelligence</div>

      <div
        style={{
          marginTop: "0.65rem",
          padding: "0.85rem",
          border: "1px solid rgba(220, 182, 92, 0.35)",
          borderRadius: 14,
          background: "rgba(137, 96, 31, 0.09)",
        }}
      >
        <div className="eyebrow">
          Primary observation · {intelligence.primaryObservation.category}
        </div>
        <p className="copy" style={{ margin: "0.35rem 0 0" }}>
          {intelligence.primaryObservation.statement}
        </p>
        {intelligence.primaryObservation.evidence.length ? (
          <ul className="copy" style={{ margin: "0.45rem 0 0 1.1rem" }}>
            {intelligence.primaryObservation.evidence.map((evidence) => (
              <li key={evidence}>{evidence}</li>
            ))}
          </ul>
        ) : null}
        <p
          className="copy"
          style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", opacity: 0.72 }}
        >
          {confidenceLabel(intelligence.primaryObservation.confidence)}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.55rem",
          marginTop: "0.85rem",
        }}
      >
        {[
          {
            label: "Song evidence",
            value: intelligence.primaryObservation.confidence,
          },
          {
            label: "Creative interpretation",
            value: lensConfidence,
          },
          {
            label: "Knowledge support",
            value: evidenceConfidence,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: "0.7rem",
              border: "1px solid var(--line)",
              borderRadius: 13,
              background: "rgba(255,255,255,0.025)",
            }}
          >
            <div className="eyebrow">{item.label}</div>
            <strong className="copy" style={{ display: "block", marginTop: "0.25rem" }}>
              {confidenceBand(item.value)} · {percentLabel(item.value)}
            </strong>
          </div>
        ))}
      </div>

      {knowledgeCitations.length ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.75rem",
            border: "1px solid var(--line)",
            borderRadius: 14,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div className="eyebrow">Knowledge utilization</div>
          <div
            className="copy"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.45rem",
              marginTop: "0.45rem",
            }}
          >
            <span className="pill">
              Requested {knowledgeMetrics?.requestedCount ?? "—"}
            </span>
            <span className="pill">
              Retrieved {knowledgeMetrics?.retrievedCount ?? knowledgeCitations.length}
            </span>
            <span className="pill">
              Used {knowledgeMetrics?.citedCount ?? knowledgeCitations.length}
            </span>
            <span className="pill">
              Best match {percentLabel(knowledgeMetrics?.highestRelevance)}
            </span>
          </div>

          {evidencePerspectives.length ? (
            <>
              <div className="eyebrow" style={{ marginTop: "0.75rem" }}>
                Evidence perspectives
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                  marginTop: "0.4rem",
                }}
              >
                {evidencePerspectives.slice(0, 8).map((perspective) => (
                  <span className="pill" key={perspective}>
                    {perspective}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
              marginTop: "0.65rem",
            }}
          >
            {knowledgeCitations.map((citation) => (
              <a
                key={`jump-${citation.citationKey}-${citation.chunkId}`}
                className="pill"
                href={`#source-${messageId}-${citation.citationKey}`}
                style={{ textDecoration: "none" }}
              >
                Jump to {citation.citationKey}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {knowledgeCitations.length ? (
        <details
          open
          style={{ marginTop: "0.85rem" }}
        >
          <summary
            className="copy"
            style={{
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Sources used ·{" "}
            {knowledgeCitations.length}
          </summary>

          <p
            className="copy"
            style={{
              margin: "0.45rem 0 0",
              fontSize: "0.84rem",
              opacity: 0.78,
            }}
          >
            Citation keys in the Muse response
            map to these exact retrieved source
            records. Evidence class, rights
            status, locator, and provenance remain
            visible.
          </p>

          <div
            style={{
              display: "grid",
              gap: "0.6rem",
              marginTop: "0.65rem",
            }}
          >
            {knowledgeCitations.map(
              (citation) => (
                <article
                  id={`source-${messageId}-${citation.citationKey}`}
                  key={`${citation.citationKey}-${citation.chunkId}`}
                  style={{
                    padding: "0.8rem",
                    border:
                      "1px solid var(--line)",
                    borderRadius: 14,
                    background:
                      "rgba(255,255,255,0.025)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.4rem",
                      alignItems: "center",
                    }}
                  >
                    <span className="pill">
                      {
                        citation.citationKey
                      }
                    </span>
                    <span className="pill">
                      {citation.evidenceClassification.replace(
                        /_/g,
                        " ",
                      )}
                    </span>
                    <span className="pill">
                      {citation.rightsStatus.replace(
                        /_/g,
                        " ",
                      )}
                    </span>
                    <span className="pill">
                      Quality{" "}
                      {
                        citation.sourceQuality
                      }
                      /5
                    </span>
                  </div>

                  <h4
                    className="h3"
                    style={{
                      margin:
                        "0.5rem 0 0",
                    }}
                  >
                    {citation.title}
                  </h4>

                  <p
                    className="copy"
                    style={{
                      margin:
                        "0.2rem 0 0",
                      opacity: 0.78,
                    }}
                  >
                    {[
                      citation.authorCreator,
                      citation.tradition,
                      citation.historicalPeriod,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  <p
                    className="copy"
                    style={{
                      margin:
                        "0.45rem 0 0",
                    }}
                  >
                    <strong>
                      Supported claim:
                    </strong>{" "}
                    {
                      citation.supportedClaim
                    }
                  </p>

                  <p
                    className="copy"
                    style={{
                      margin:
                        "0.35rem 0 0",
                      fontSize: "0.84rem",
                      opacity: 0.78,
                    }}
                  >
                    {
                      citation.citationText
                    }
                  </p>

                  {citation.canonicalUrl ? (
                    <a
                      className="button"
                      href={
                        citation.canonicalUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display:
                          "inline-flex",
                        marginTop:
                          "0.55rem",
                      }}
                    >
                      Open source
                    </a>
                  ) : null}
                </article>
              ),
            )}
          </div>
        </details>
      ) : null}

      {intelligence.recommendations.length ? (
        <div style={{ marginTop: "0.85rem" }}>
          <div className="eyebrow">Recommended work</div>
          <div
            style={{
              display: "grid",
              gap: "0.55rem",
              marginTop: "0.5rem",
            }}
          >
            {intelligence.recommendations.map((recommendation) => (
              <div
                key={`${recommendation.title}-${recommendation.priority}`}
                style={{
                  padding: "0.75rem 0.8rem",
                  border: "1px solid var(--line)",
                  borderRadius: 13,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.45rem",
                    alignItems: "center",
                  }}
                >
                  <strong className="copy">{recommendation.title}</strong>
                  <span className="pill">
                    {priorityLabel(recommendation.priority)}
                  </span>
                </div>
                <p className="copy" style={{ margin: "0.3rem 0 0" }}>
                  {recommendation.reasoning}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {intelligence.diagnostics.length ? (
        <details open style={{ marginTop: "0.85rem" }}>
          <summary className="copy" style={{ cursor: "pointer", fontWeight: 700 }}>
            Diagnostic framework
          </summary>
          <div
            style={{
              display: "grid",
              gap: "0.65rem",
              marginTop: "0.65rem",
            }}
          >
            {intelligence.diagnostics.map((diagnostic) => (
              <div
                key={diagnostic.key}
                style={{
                  padding: "0.8rem",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                  }}
                >
                  <strong className="copy">{diagnostic.label}</strong>
                  <span className="pill">
                    {diagnostic.score}/100 · {diagnostic.changeFromPrevious}
                  </span>
                </div>

                <div
                  aria-label={`${diagnostic.label} score ${diagnostic.score} out of 100`}
                  style={{
                    height: 7,
                    marginTop: "0.5rem",
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, diagnostic.score))}%`,
                      height: "100%",
                      background: "rgba(220, 182, 92, 0.72)",
                    }}
                  />
                </div>

                <p className="copy" style={{ margin: "0.45rem 0 0" }}>
                  {diagnostic.finding}
                </p>

                {diagnostic.evidence.length ? (
                  <ul className="copy" style={{ margin: "0.35rem 0 0 1.1rem" }}>
                    {diagnostic.evidence.map((evidence) => (
                      <li key={evidence}>{evidence}</li>
                    ))}
                  </ul>
                ) : null}

                <p
                  className="copy"
                  style={{
                    margin: "0.3rem 0 0",
                    fontSize: "0.8rem",
                    opacity: 0.72,
                  }}
                >
                  {confidenceLabel(diagnostic.confidence)} · Directional creative
                  estimate, not an objective grade.
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {intelligence.versionComparison ? (
        <details style={{ marginTop: "0.85rem" }}>
          <summary className="copy" style={{ cursor: "pointer", fontWeight: 700 }}>
            Version comparison
          </summary>
          <div
            style={{
              marginTop: "0.6rem",
              padding: "0.8rem",
              border: "1px solid var(--line)",
              borderRadius: 14,
            }}
          >
            <div className="eyebrow">
              {intelligence.versionComparison.previousVersionLabel} →{" "}
              {intelligence.versionComparison.currentVersionLabel}
            </div>
            <p className="copy" style={{ margin: "0.35rem 0 0" }}>
              {intelligence.versionComparison.summary}
            </p>

            {intelligence.versionComparison.meaningfulChanges.length ? (
              <div style={{ marginTop: "0.55rem" }}>
                <strong className="copy">Meaningful changes</strong>
                <ul className="copy" style={{ margin: "0.25rem 0 0 1.1rem" }}>
                  {intelligence.versionComparison.meaningfulChanges.map(
                    (change) => (
                      <li key={change}>{change}</li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            {intelligence.versionComparison.protectedElements.length ? (
              <div style={{ marginTop: "0.55rem" }}>
                <strong className="copy">Elements worth protecting</strong>
                <ul className="copy" style={{ margin: "0.25rem 0 0 1.1rem" }}>
                  {intelligence.versionComparison.protectedElements.map(
                    (element) => (
                      <li key={element}>{element}</li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {availableLenses.length ? (
        <details style={{ marginTop: "0.85rem" }}>
          <summary className="copy" style={{ cursor: "pointer", fontWeight: 700 }}>
            Complete creative lenses
          </summary>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "0.65rem",
              marginTop: "0.65rem",
            }}
          >
            {availableLenses.map(([title, assessment]) => (
              <LensCard key={title} title={title} assessment={assessment} />
            ))}
          </div>
        </details>
      ) : null}

      {hasLyricWork && intelligence.lyricWork ? (
        <details style={{ marginTop: "0.85rem" }}>
          <summary className="copy" style={{ cursor: "pointer", fontWeight: 700 }}>
            Lyric work
          </summary>
          <div
            style={{
              marginTop: "0.6rem",
              padding: "0.8rem",
              border: "1px solid var(--line)",
              borderRadius: 14,
            }}
          >
            {intelligence.lyricWork.likelyLyric ? (
              <div>
                <div className="eyebrow">Likely lyric</div>
                <p className="copy" style={{ margin: "0.35rem 0 0", whiteSpace: "pre-wrap" }}>
                  {intelligence.lyricWork.likelyLyric}
                </p>
              </div>
            ) : null}

            {meaningfulSuggestedLines.length ? (
              <div style={{ marginTop: "0.65rem" }}>
                <div className="eyebrow">Candidate lines</div>
                <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.45rem" }}>
                  {meaningfulSuggestedLines.map((line, index) => (
                    <div
                      key={`${line.text}-${index}`}
                      style={{
                        padding: "0.7rem",
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                      }}
                    >
                      <span className="pill">{sourceLabel(line.source)}</span>
                      <p className="copy" style={{ margin: "0.4rem 0 0", whiteSpace: "pre-wrap" }}>
                        {line.text}
                      </p>
                      <p
                        className="copy"
                        style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", opacity: 0.75 }}
                      >
                        {line.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {hasFormWork && intelligence.formWork ? (
        <details style={{ marginTop: "0.85rem" }}>
          <summary className="copy" style={{ cursor: "pointer", fontWeight: 700 }}>
            Song-form work
          </summary>
          <div
            style={{
              marginTop: "0.6rem",
              padding: "0.8rem",
              border: "1px solid var(--line)",
              borderRadius: 14,
            }}
          >
            <div className="eyebrow">Recommended form</div>
            <p className="copy" style={{ margin: "0.35rem 0 0", fontWeight: 700 }}>
              {intelligence.formWork.recommendedForm}
            </p>
            <p className="copy" style={{ margin: "0.35rem 0 0" }}>
              {intelligence.formWork.reasoning}
            </p>
            {meaningfulFormAlternatives.length ? (
              <p className="copy" style={{ margin: "0.45rem 0 0" }}>
                <strong>Alternatives:</strong>{" "}
                {meaningfulFormAlternatives.join(", ")}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      {meaningfulUnresolvedQuestions.length ? (
        <details style={{ marginTop: "0.85rem" }}>
          <summary className="copy" style={{ cursor: "pointer", fontWeight: 700 }}>
            Questions still open
          </summary>
          <ul className="copy" style={{ margin: "0.55rem 0 0 1.1rem" }}>
            {meaningfulUnresolvedQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {intelligence.proposedTask ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.8rem",
            border: "1px solid rgba(220, 182, 92, 0.35)",
            borderRadius: 14,
          }}
        >
          <div className="eyebrow">Proposed song task</div>
          <p className="copy" style={{ margin: "0.35rem 0 0", fontWeight: 700 }}>
            {intelligence.proposedTask.title}
          </p>
          <p className="copy" style={{ margin: "0.3rem 0 0" }}>
            {intelligence.proposedTask.description}
          </p>
          <p
            className="copy"
            style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", opacity: 0.75 }}
          >
            Priority {intelligence.proposedTask.priority} of 5
          </p>

          {!taskAction ? (
            <div className="button-row" style={{ marginTop: "0.6rem" }}>
              <button
                type="button"
                className="button primary"
                disabled={taskBusy || !messageId}
                onClick={() => onTaskAction("create_task")}
              >
                {taskBusy ? "Saving task…" : "Create song task"}
              </button>
              <button
                type="button"
                className="button"
                disabled={taskBusy || !messageId}
                onClick={() => onTaskAction("dismiss_task")}
              >
                Dismiss
              </button>
            </div>
          ) : (
            <span className="pill" style={{ display: "inline-flex", marginTop: "0.6rem" }}>
              {taskAction.status === "created"
                ? "Song task created"
                : "Task suggestion dismissed"}
            </span>
          )}
        </div>
      ) : null}

      {intelligence.suggestedCollaborator && collaborator ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.8rem",
            border: "1px solid rgba(154, 134, 220, 0.42)",
            borderRadius: 14,
            background: "rgba(105, 85, 170, 0.08)",
          }}
        >
          <div className="eyebrow">Suggested Muse collaborator</div>
          <p className="copy" style={{ margin: "0.35rem 0 0" }}>
            <strong>{collaborator.name}</strong> — {collaborator.domain}
          </p>
          <p className="copy" style={{ margin: "0.3rem 0 0" }}>
            {intelligence.suggestedCollaborator.reason}
          </p>
          <button
            type="button"
            className="button"
            disabled={collaborationBusy}
            onClick={() => onInviteMuse(collaborator.slug)}
            style={{ marginTop: "0.6rem" }}
          >
            {collaborationBusy
              ? `Inviting ${collaborator.name}…`
              : `Invite ${collaborator.name}`}
          </button>
        </div>
      ) : null}

      <p
        className="copy"
        style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", opacity: 0.7 }}
      >
        Structured findings are saved with this response. Scores and suggestions
        are working creative judgments; the songwriter remains the final authority.
      </p>
    </div>
  );
}
