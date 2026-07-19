"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type PriorityTier = "now" | "next" | "later" | "someday" | "archive";
export type WorkflowStatus =
  | "unreviewed"
  | "active"
  | "waiting"
  | "completed"
  | "archived";

export type StudioPortfolioSong = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  audio_url: string | null;
  current_stage: string;
  muse_slug: string | null;
  version_count: number;
  spark_version_count: number;
  draft_version_count: number;
  final_version_count: number;
  all_versions_final: boolean;
  is_finished: boolean;
  priority_tier: PriorityTier;
  priority_rank: number | null;
  workflow_status: WorkflowStatus;
  next_action: string | null;
  target_date: string | null;
  personal_rating: number | null;
  ai_overall_score: number | null;
  ai_ready_for_release_score: number | null;
  ai_audience_score: number | null;
  ai_likely_listeners: string[];
  ai_playlist_fit: string[];
  ai_sync_opportunities: string[];
  ai_radio_potential: string | null;
  ai_hook_commercial_potential: string | null;
  ai_completed_at: string | null;
  open_task_count: number;
  in_progress_task_count: number;
  audio_play_count: number;
  video_click_count: number;
  listener_rating_average: number | null;
  listener_rating_count: number;
};

type Props = {
  initialSongs: StudioPortfolioSong[];
};

type SaveState = Record<
  string,
  {
    status: "idle" | "saving" | "success" | "error";
    message: string;
  }
>;

type OpportunityBreakdown = {
  aiStrength: number;
  releaseReadiness: number;
  audienceFit: number;
  personalConviction: number;
  listenerResponse: number;
  engagement: number;
  momentum: number;
};

type OpportunityAssessment = {
  score: number;
  label: string;
  recommendation: string;
  reasons: string[];
  watchItems: string[];
  breakdown: OpportunityBreakdown;
  measuredSignalCount: number;
};

const PRIORITY_ORDER: Record<PriorityTier, number> = {
  now: 0,
  next: 1,
  later: 2,
  someday: 3,
  archive: 4,
};

const PRIORITY_SIGNAL: Record<PriorityTier, number> = {
  now: 100,
  next: 85,
  later: 65,
  someday: 40,
  archive: 10,
};

const WORKFLOW_SIGNAL: Record<WorkflowStatus, number> = {
  unreviewed: 45,
  active: 82,
  waiting: 60,
  completed: 95,
  archived: 10,
};

const OPPORTUNITY_WEIGHTS = {
  aiStrength: 25,
  releaseReadiness: 20,
  audienceFit: 15,
  personalConviction: 15,
  listenerResponse: 10,
  engagement: 10,
  momentum: 5,
} as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatScore(value: number | null) {
  return value === null ? "—" : Math.round(value).toString();
}

function scoreDescription(value: number | null) {
  if (value === null) return "Not analyzed";
  if (value >= 90) return "Exceptional";
  if (value >= 80) return "Strong";
  if (value >= 70) return "Promising";
  if (value >= 60) return "Developing";
  return "Early stage";
}

function opportunityLabel(value: number) {
  if (value >= 85) return "Exceptional opportunity";
  if (value >= 75) return "Strong opportunity";
  if (value >= 65) return "Promising opportunity";
  if (value >= 55) return "Worth developing";
  return "Early-stage opportunity";
}

function opportunityTone(value: number) {
  if (value >= 85) {
    return {
      border: "rgba(113, 220, 145, 0.72)",
      background:
        "linear-gradient(145deg, rgba(50, 145, 80, 0.22), rgba(255,255,255,0.025))",
      text: "#d9f7d6",
    };
  }

  if (value >= 70) {
    return {
      border: "rgba(255, 221, 132, 0.78)",
      background:
        "linear-gradient(145deg, rgba(217, 161, 46, 0.18), rgba(255,255,255,0.025))",
      text: "#ffe7a7",
    };
  }

  return {
    border: "rgba(170, 190, 220, 0.5)",
    background:
      "linear-gradient(145deg, rgba(110, 130, 165, 0.14), rgba(255,255,255,0.025))",
    text: "#e3e9f4",
  };
}

function recalculateFinished(song: StudioPortfolioSong) {
  return (
    song.current_stage.toLowerCase() === "final" ||
    song.all_versions_final ||
    song.workflow_status === "completed" ||
    song.workflow_status === "archived"
  );
}

function normalizedListenerRating(song: StudioPortfolioSong) {
  if (
    song.listener_rating_average === null ||
    song.listener_rating_count <= 0
  ) {
    return 50;
  }

  const rawScore = clampScore((song.listener_rating_average / 5) * 100);
  const priorScore = 70;
  const priorWeight = 3;

  return clampScore(
    (rawScore * song.listener_rating_count + priorScore * priorWeight) /
      (song.listener_rating_count + priorWeight),
  );
}

function normalizedEngagement(song: StudioPortfolioSong, maxListens: number) {
  if (maxListens <= 0) return 50;
  if (song.audio_play_count <= 0) return 25;

  const relative = Math.log1p(song.audio_play_count) / Math.log1p(maxListens);
  return clampScore(25 + relative * 75);
}

function stageSignal(stage: string) {
  const normalized = stage.toLowerCase();

  if (normalized === "final") return 100;
  if (normalized === "draft") return 75;
  if (normalized === "spark") return 50;
  return 55;
}

function momentumSignal(song: StudioPortfolioSong) {
  const taskCount = song.open_task_count + song.in_progress_task_count;
  const taskSignal = clampScore(
    62 +
      Math.min(song.in_progress_task_count * 10, 20) +
      Math.min(song.open_task_count * 3, 12) -
      Math.max(taskCount - 5, 0) * 4,
  );

  return clampScore(
    PRIORITY_SIGNAL[song.priority_tier] * 0.4 +
      stageSignal(song.current_stage) * 0.3 +
      WORKFLOW_SIGNAL[song.workflow_status] * 0.2 +
      taskSignal * 0.1,
  );
}

function recommendedNextMove(song: StudioPortfolioSong) {
  if (song.next_action?.trim()) return song.next_action.trim();

  if (song.in_progress_task_count > 0) {
    return `Complete the ${
      song.in_progress_task_count === 1
        ? "active development task"
        : `${song.in_progress_task_count} active development tasks`
    } and reassess the song.`;
  }

  if (song.open_task_count > 0) {
    return "Start the highest-priority open song task.";
  }

  if (song.ai_overall_score === null) {
    return "Run AI Song Intelligence to establish the song's creative and commercial baseline.";
  }

  if (
    (song.ai_ready_for_release_score ?? 0) >= 85 &&
    song.current_stage.toLowerCase() === "final"
  ) {
    return "Prepare the release package and publisher pitch materials.";
  }

  if ((song.ai_ready_for_release_score ?? 0) >= 80) {
    return "Resolve the final production items, then prepare the song for release or pitching.";
  }

  if (song.current_stage.toLowerCase() === "spark") {
    return "Develop the spark into a complete draft, then run Song Intelligence again.";
  }

  if (song.current_stage.toLowerCase() === "draft") {
    return "Complete the next draft and address the strongest development recommendation.";
  }

  return "Choose one concrete improvement, complete it, and rerun Song Intelligence.";
}

function buildOpportunityAssessment(
  song: StudioPortfolioSong,
  maxListens: number,
): OpportunityAssessment {
  const breakdown: OpportunityBreakdown = {
    aiStrength: song.ai_overall_score ?? 45,
    releaseReadiness: song.ai_ready_for_release_score ?? 40,
    audienceFit: song.ai_audience_score ?? 45,
    personalConviction: song.personal_rating ?? 50,
    listenerResponse: normalizedListenerRating(song),
    engagement: normalizedEngagement(song, maxListens),
    momentum: momentumSignal(song),
  };

  const score = Math.round(
    (breakdown.aiStrength * OPPORTUNITY_WEIGHTS.aiStrength +
      breakdown.releaseReadiness * OPPORTUNITY_WEIGHTS.releaseReadiness +
      breakdown.audienceFit * OPPORTUNITY_WEIGHTS.audienceFit +
      breakdown.personalConviction * OPPORTUNITY_WEIGHTS.personalConviction +
      breakdown.listenerResponse * OPPORTUNITY_WEIGHTS.listenerResponse +
      breakdown.engagement * OPPORTUNITY_WEIGHTS.engagement +
      breakdown.momentum * OPPORTUNITY_WEIGHTS.momentum) /
      100,
  );

  const reasons: string[] = [];
  const watchItems: string[] = [];

  if ((song.ai_overall_score ?? 0) >= 80) {
    reasons.push(`AI song strength is ${Math.round(song.ai_overall_score!)}.`);
  }

  if ((song.ai_ready_for_release_score ?? 0) >= 80) {
    reasons.push(
      `Release readiness is ${Math.round(song.ai_ready_for_release_score!)}.`,
    );
  }

  if ((song.ai_audience_score ?? 0) >= 80) {
    reasons.push(`Audience fit is ${Math.round(song.ai_audience_score!)}.`);
  }

  if ((song.personal_rating ?? 0) >= 80) {
    reasons.push(`Your personal rating is ${Math.round(song.personal_rating!)}.`);
  }

  if (
    song.listener_rating_average !== null &&
    song.listener_rating_count > 0 &&
    song.listener_rating_average >= 4
  ) {
    reasons.push(
      `Listeners rate it ${song.listener_rating_average.toFixed(1)} out of 5.`,
    );
  }

  if (song.audio_play_count > 0) {
    reasons.push(
      `${song.audio_play_count.toLocaleString()} recorded ${
        song.audio_play_count === 1 ? "listen" : "listens"
      } demonstrate audience activity.`,
    );
  }

  if (song.priority_tier === "now" || song.priority_tier === "next") {
    reasons.push(
      `It is already positioned in your ${formatLabel(
        song.priority_tier,
      )} priority group.`,
    );
  }

  if (song.current_stage.toLowerCase() === "final") {
    reasons.push("The current song stage is Final.");
  }

  if (song.ai_overall_score === null) {
    watchItems.push("No saved AI Song Intelligence report yet.");
  }

  if (song.ai_audience_score === null) {
    watchItems.push("Audience-fit analysis is not available yet.");
  }

  if (song.listener_rating_count === 0) {
    watchItems.push("No listener ratings have been recorded yet.");
  }

  if (song.audio_play_count === 0) {
    watchItems.push("No listening activity has been recorded yet.");
  }

  if ((song.ai_ready_for_release_score ?? 100) < 60) {
    watchItems.push("Release readiness still needs meaningful development.");
  }

  if (song.open_task_count + song.in_progress_task_count > 4) {
    watchItems.push("The song has a relatively large remaining task load.");
  }

  const measuredSignalCount = [
    song.ai_overall_score,
    song.ai_ready_for_release_score,
    song.ai_audience_score,
    song.personal_rating,
    song.listener_rating_count > 0 ? song.listener_rating_average : null,
    song.audio_play_count > 0 ? song.audio_play_count : null,
  ].filter((value) => value !== null).length;

  return {
    score: clampScore(score),
    label: opportunityLabel(score),
    recommendation: recommendedNextMove(song),
    reasons: reasons.slice(0, 5),
    watchItems: watchItems.slice(0, 4),
    breakdown,
    measuredSignalCount,
  };
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div
      style={{
        padding: "0.9rem",
        border: "1px solid var(--line)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div className="eyebrow">{label}</div>
      <div
        style={{
          fontSize: "1.85rem",
          fontWeight: 800,
          marginTop: "0.2rem",
        }}
      >
        {value}
      </div>
      {detail ? (
        <div className="copy" style={{ fontSize: "0.84rem", marginTop: "0.2rem" }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function ScoreBreakdown({ assessment }: { assessment: OpportunityAssessment }) {
  const metrics = [
    ["AI strength", assessment.breakdown.aiStrength, 25],
    ["Release readiness", assessment.breakdown.releaseReadiness, 20],
    ["Audience fit", assessment.breakdown.audienceFit, 15],
    ["Your rating", assessment.breakdown.personalConviction, 15],
    ["Listener response", assessment.breakdown.listenerResponse, 10],
    ["Engagement", assessment.breakdown.engagement, 10],
    ["Momentum", assessment.breakdown.momentum, 5],
  ] as const;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
        gap: "0.55rem",
        marginTop: "0.75rem",
      }}
    >
      {metrics.map(([label, value, weight]) => (
        <div
          key={label}
          style={{
            padding: "0.7rem",
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "rgba(0,0,0,0.12)",
          }}
        >
          <div className="eyebrow">{label}</div>
          <div className="copy" style={{ marginTop: "0.15rem" }}>
            <strong>{Math.round(value)}</strong> / 100 · {weight}%
          </div>
        </div>
      ))}
    </div>
  );
}

function TopOpportunityCard({
  song,
  assessment,
}: {
  song: StudioPortfolioSong;
  assessment: OpportunityAssessment;
}) {
  const tone = opportunityTone(assessment.score);

  return (
    <section
      style={{
        marginBottom: "1rem",
        padding: "1.25rem",
        border: `1px solid ${tone.border}`,
        borderRadius: 20,
        background: tone.background,
        boxShadow: "0 18px 46px rgba(0,0,0,0.16)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.55fr) minmax(220px, 0.65fr)",
          gap: "1rem",
          alignItems: "stretch",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Today&apos;s top opportunity</div>
          <h3 className="h2" style={{ marginTop: "0.3rem", marginBottom: "0.4rem" }}>
            {song.title}
          </h3>
          <p className="copy" style={{ maxWidth: 760 }}>
            Songcatcher Studio currently ranks this as the strongest song to
            advance next based on creative strength, release readiness, audience
            fit, human judgment, listener response, engagement, and momentum.
          </p>

          <div
            style={{
              marginTop: "0.85rem",
              padding: "0.9rem",
              border: "1px solid var(--line)",
              borderRadius: 16,
              background: "rgba(0,0,0,0.12)",
            }}
          >
            <div className="eyebrow">Recommended next move</div>
            <div className="copy" style={{ marginTop: "0.3rem", fontWeight: 750 }}>
              {assessment.recommendation}
            </div>
          </div>

          <div className="button-row" style={{ marginTop: "0.9rem" }}>
            <Link className="button primary" href={`/studio/songs/${song.slug}/edit`}>
              Work this song
            </Link>
            <Link className="button" href={`/songs/${song.slug}`}>
              View song
            </Link>
          </div>
        </div>

        <div
          style={{
            padding: "1rem",
            border: `1px solid ${tone.border}`,
            borderRadius: 18,
            background: "rgba(0,0,0,0.16)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div className="eyebrow">Opportunity score</div>
          <div
            style={{
              fontSize: "4.25rem",
              lineHeight: 1,
              fontWeight: 850,
              marginTop: "0.35rem",
              color: tone.text,
            }}
          >
            {assessment.score}
          </div>
          <div className="copy" style={{ marginTop: "0.35rem", fontWeight: 750 }}>
            {assessment.label}
          </div>
          <div className="copy" style={{ marginTop: "0.55rem", fontSize: "0.84rem" }}>
            {assessment.measuredSignalCount} measured data signals
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
          gap: "0.6rem",
          marginTop: "1rem",
        }}
      >
        <MetricCard label="AI overall" value={formatScore(song.ai_overall_score)} />
        <MetricCard
          label="Release ready"
          value={formatScore(song.ai_ready_for_release_score)}
        />
        <MetricCard
          label="Audience fit"
          value={formatScore(song.ai_audience_score)}
        />
        <MetricCard label="Your rating" value={formatScore(song.personal_rating)} />
        <MetricCard label="Listens" value={song.audio_play_count.toLocaleString()} />
        <MetricCard
          label="Active tasks"
          value={song.open_task_count + song.in_progress_task_count}
        />
      </div>

      <details style={{ marginTop: "0.9rem" }}>
        <summary
          className="copy"
          style={{ cursor: "pointer", fontWeight: 800, width: "fit-content" }}
        >
          Why is this the top opportunity?
        </summary>

        <ScoreBreakdown assessment={assessment} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "0.75rem",
            marginTop: "0.75rem",
          }}
        >
          <div>
            <div className="eyebrow">What is helping</div>
            {assessment.reasons.length ? (
              <ul className="copy" style={{ marginTop: "0.5rem", paddingLeft: "1.2rem" }}>
                {assessment.reasons.map((reason) => (
                  <li key={reason} style={{ marginBottom: "0.3rem" }}>
                    {reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="copy">No dominant positive signal has emerged yet.</p>
            )}
          </div>

          <div>
            <div className="eyebrow">What to strengthen</div>
            {assessment.watchItems.length ? (
              <ul className="copy" style={{ marginTop: "0.5rem", paddingLeft: "1.2rem" }}>
                {assessment.watchItems.map((item) => (
                  <li key={item} style={{ marginBottom: "0.3rem" }}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="copy">No major opportunity gaps are visible.</p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}

function PortfolioFilters({
  search,
  setSearch,
  museFilter,
  setMuseFilter,
  stageFilter,
  setStageFilter,
  priorityFilter,
  setPriorityFilter,
  analysisFilter,
  setAnalysisFilter,
  sortMode,
  setSortMode,
  showFinished,
  setShowFinished,
  museOptions,
  stageOptions,
}: {
  search: string;
  setSearch: (value: string) => void;
  museFilter: string;
  setMuseFilter: (value: string) => void;
  stageFilter: string;
  setStageFilter: (value: string) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;
  analysisFilter: string;
  setAnalysisFilter: (value: string) => void;
  sortMode: string;
  setSortMode: (value: string) => void;
  showFinished: boolean;
  setShowFinished: (value: boolean) => void;
  museOptions: string[];
  stageOptions: string[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: "0.65rem",
        marginTop: "1rem",
        padding: "0.9rem",
        border: "1px solid var(--line)",
        borderRadius: 16,
      }}
    >
      <label className="copy">
        Search
        <input
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Song title or summary"
          style={{ marginTop: "0.35rem" }}
        />
      </label>

      <label className="copy">
        Muse
        <select
          className="input"
          value={museFilter}
          onChange={(event) => setMuseFilter(event.target.value)}
          style={{ marginTop: "0.35rem" }}
        >
          <option value="all">All Muses</option>
          {museOptions.map((muse) => (
            <option key={muse} value={muse}>
              {formatLabel(muse)}
            </option>
          ))}
        </select>
      </label>

      <label className="copy">
        Stage
        <select
          className="input"
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value)}
          style={{ marginTop: "0.35rem" }}
        >
          <option value="all">All stages</option>
          {stageOptions.map((stage) => (
            <option key={stage} value={stage}>
              {formatLabel(stage)}
            </option>
          ))}
        </select>
      </label>

      <label className="copy">
        Priority
        <select
          className="input"
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          style={{ marginTop: "0.35rem" }}
        >
          <option value="all">All priorities</option>
          <option value="now">Now</option>
          <option value="next">Next</option>
          <option value="later">Later</option>
          <option value="someday">Someday</option>
          <option value="archive">Archive</option>
        </select>
      </label>

      <label className="copy">
        AI status
        <select
          className="input"
          value={analysisFilter}
          onChange={(event) => setAnalysisFilter(event.target.value)}
          style={{ marginTop: "0.35rem" }}
        >
          <option value="all">All songs</option>
          <option value="analyzed">Analyzed</option>
          <option value="not_analyzed">Not analyzed</option>
          <option value="release_candidates">Release candidates</option>
        </select>
      </label>

      <label className="copy">
        Sort
        <select
          className="input"
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value)}
          style={{ marginTop: "0.35rem" }}
        >
          <option value="opportunity">Opportunity score</option>
          <option value="priority">Priority</option>
          <option value="ai_score">AI score: highest</option>
          <option value="audience_score">Audience score: highest</option>
          <option value="release_score">Release score: highest</option>
          <option value="my_rating">My rating: highest</option>
          <option value="listener_rating">Listener rating: highest</option>
          <option value="most_listened">Most listened</option>
          <option value="video_clicks">Most video clicks</option>
          <option value="versions">Most versions</option>
          <option value="title">Title</option>
        </select>
      </label>

      <label
        className="copy"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          alignSelf: "end",
          minHeight: 46,
        }}
      >
        <input
          type="checkbox"
          checked={showFinished}
          onChange={(event) => setShowFinished(event.target.checked)}
        />
        Show finished songs and version history
      </label>
    </div>
  );
}

function PortfolioControls({
  song,
  state,
  updateLocalSong,
  saveWorkflow,
}: {
  song: StudioPortfolioSong;
  state: SaveState[string] | undefined;
  updateLocalSong: (
    songId: string,
    patch: Partial<StudioPortfolioSong>,
  ) => void;
  saveWorkflow: (
    song: StudioPortfolioSong,
    patch: Partial<
      Pick<
        StudioPortfolioSong,
        | "priority_tier"
        | "priority_rank"
        | "workflow_status"
        | "personal_rating"
      >
    >,
  ) => Promise<void>;
}) {
  return (
    <div
      style={{
        padding: "0.9rem",
        border: "1px solid var(--line)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div className="eyebrow">Portfolio controls</div>

      <label className="copy" style={{ display: "block", marginTop: "0.7rem" }}>
        Priority
        <select
          className="input"
          value={song.priority_tier}
          onChange={(event) =>
            void saveWorkflow(song, {
              priority_tier: event.target.value as PriorityTier,
            })
          }
          style={{ marginTop: "0.3rem" }}
        >
          <option value="now">Now</option>
          <option value="next">Next</option>
          <option value="later">Later</option>
          <option value="someday">Someday</option>
          <option value="archive">Archive</option>
        </select>
      </label>

      <label className="copy" style={{ display: "block", marginTop: "0.65rem" }}>
        Rank within priority
        <input
          className="input"
          type="number"
          min={1}
          value={song.priority_rank ?? ""}
          placeholder="Optional"
          onChange={(event) =>
            updateLocalSong(song.id, {
              priority_rank: event.target.value ? Number(event.target.value) : null,
            })
          }
          onBlur={(event) =>
            void saveWorkflow(song, {
              priority_rank: event.target.value ? Number(event.target.value) : null,
            })
          }
          style={{ marginTop: "0.3rem" }}
        />
      </label>

      <label className="copy" style={{ display: "block", marginTop: "0.65rem" }}>
        My rating
        <input
          className="input"
          type="number"
          min={0}
          max={100}
          step={1}
          value={song.personal_rating ?? ""}
          placeholder="0–100"
          onChange={(event) =>
            updateLocalSong(song.id, {
              personal_rating: event.target.value ? Number(event.target.value) : null,
            })
          }
          onBlur={(event) =>
            void saveWorkflow(song, {
              personal_rating: event.target.value ? Number(event.target.value) : null,
            })
          }
          style={{ marginTop: "0.3rem" }}
        />
      </label>

      <label className="copy" style={{ display: "block", marginTop: "0.65rem" }}>
        Workflow status
        <select
          className="input"
          value={song.workflow_status}
          onChange={(event) =>
            void saveWorkflow(song, {
              workflow_status: event.target.value as WorkflowStatus,
            })
          }
          style={{ marginTop: "0.3rem" }}
        >
          <option value="unreviewed">Unreviewed</option>
          <option value="active">Active</option>
          <option value="waiting">Waiting</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </label>

      {song.all_versions_final ? (
        <div
          className="copy"
          style={{
            marginTop: "0.7rem",
            padding: "0.65rem",
            borderRadius: 12,
            border: "1px solid var(--line)",
          }}
        >
          All current versions are marked Final.
        </div>
      ) : null}

      {state?.message ? (
        <div
          role="status"
          className="copy"
          style={{
            marginTop: "0.65rem",
            fontWeight: 700,
            color:
              state.status === "error"
                ? "#ffb4b4"
                : state.status === "saving"
                  ? "#f7dda0"
                  : "#d9f7d6",
          }}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}

function SongOpportunityCard({
  song,
  assessment,
  rank,
  state,
  updateLocalSong,
  saveWorkflow,
}: {
  song: StudioPortfolioSong;
  assessment: OpportunityAssessment;
  rank: number | null;
  state: SaveState[string] | undefined;
  updateLocalSong: (
    songId: string,
    patch: Partial<StudioPortfolioSong>,
  ) => void;
  saveWorkflow: (
    song: StudioPortfolioSong,
    patch: Partial<
      Pick<
        StudioPortfolioSong,
        | "priority_tier"
        | "priority_rank"
        | "workflow_status"
        | "personal_rating"
      >
    >,
  ) => Promise<void>;
}) {
  const tone = opportunityTone(assessment.score);

  return (
    <article
      className="subsection"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.8fr) minmax(250px, 1fr)",
        gap: "1rem",
        alignItems: "start",
        borderColor: rank === 1 ? tone.border : undefined,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="pillRow" style={{ marginBottom: "0.75rem" }}>
          <span
            className="pill"
            style={{
              borderColor: tone.border,
              background: tone.background,
              color: tone.text,
              fontWeight: 850,
            }}
          >
            Opportunity {assessment.score}
          </span>
          {rank ? <span className="pill">#{rank} active opportunity</span> : null}
          <span className="pill">{formatLabel(song.current_stage)}</span>
          {song.muse_slug ? (
            <span className="pill">{formatLabel(song.muse_slug)}</span>
          ) : null}
          <span className="pill">
            {song.version_count === 1
              ? "1-version history"
              : `${song.version_count}-version history`}
          </span>
          <span className="pill">
            Priority {formatLabel(song.priority_tier)}
            {song.priority_rank ? ` #${song.priority_rank}` : ""}
          </span>
          <span className="pill">AI {formatScore(song.ai_overall_score)}</span>
          <span className="pill">Audience {formatScore(song.ai_audience_score)}</span>
          <span className="pill">My rating {formatScore(song.personal_rating)}</span>
          <span className="pill">{song.audio_play_count} listens</span>
          {song.listener_rating_count > 0 ? (
            <span className="pill">
              ★ {song.listener_rating_average?.toFixed(1)} ({song.listener_rating_count})
            </span>
          ) : null}
          {song.open_task_count + song.in_progress_task_count > 0 ? (
            <span className="pill">
              {song.open_task_count + song.in_progress_task_count} active task(s)
            </span>
          ) : null}
          {song.is_finished ? <span className="pill">Finished</span> : null}
        </div>

        <h3 className="h3" style={{ marginBottom: "0.4rem" }}>
          <Link href={`/songs/${song.slug}`}>{song.title}</Link>
        </h3>

        {song.summary ? <p className="copy">{song.summary}</p> : null}

        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.85rem",
            border: `1px solid ${tone.border}`,
            borderRadius: 14,
            background: tone.background,
          }}
        >
          <div className="eyebrow">Recommended next move</div>
          <div className="copy" style={{ marginTop: "0.25rem", fontWeight: 750 }}>
            {assessment.recommendation}
          </div>
        </div>

        {song.ai_likely_listeners.length ? (
          <div style={{ marginTop: "0.75rem" }}>
            <div className="eyebrow">Best-fit audiences</div>
            <div className="pillRow" style={{ marginTop: "0.4rem" }}>
              {song.ai_likely_listeners.slice(0, 4).map((listener) => (
                <span className="pill" key={listener}>
                  {listener}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
            gap: "0.55rem",
            marginTop: "0.8rem",
          }}
        >
          <div>
            <div className="eyebrow">Opportunity</div>
            <div className="copy">
              <strong>{assessment.score}</strong> · {assessment.label}
            </div>
          </div>
          <div>
            <div className="eyebrow">Version history</div>
            <div className="copy">
              {song.version_count === 0
                ? "No saved versions"
                : [
                    song.spark_version_count
                      ? `${song.spark_version_count} Spark`
                      : null,
                    song.draft_version_count
                      ? `${song.draft_version_count} Draft`
                      : null,
                    song.final_version_count
                      ? `${song.final_version_count} Final`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </div>
          </div>
          <div>
            <div className="eyebrow">AI overall</div>
            <div className="copy">
              <strong>{formatScore(song.ai_overall_score)}</strong>{" "}
              {scoreDescription(song.ai_overall_score)}
            </div>
          </div>
          <div>
            <div className="eyebrow">Release readiness</div>
            <div className="copy">
              <strong>{formatScore(song.ai_ready_for_release_score)}</strong>
            </div>
          </div>
          <div>
            <div className="eyebrow">Audience fit</div>
            <div className="copy">
              <strong>{formatScore(song.ai_audience_score)}</strong>
            </div>
          </div>
          <div>
            <div className="eyebrow">My rating</div>
            <div className="copy">
              <strong>{formatScore(song.personal_rating)}</strong> / 100
            </div>
          </div>
          <div>
            <div className="eyebrow">Listener rating</div>
            <div className="copy">
              {song.listener_rating_average === null
                ? "No ratings"
                : `${song.listener_rating_average.toFixed(1)} / 5 · ${
                    song.listener_rating_count
                  } ${song.listener_rating_count === 1 ? "rating" : "ratings"}`}
            </div>
          </div>
          <div>
            <div className="eyebrow">Engagement</div>
            <div className="copy">
              {song.audio_play_count} listens · {song.video_click_count} video clicks
            </div>
          </div>
          <div>
            <div className="eyebrow">Tasks</div>
            <div className="copy">
              {song.open_task_count} open · {song.in_progress_task_count} in progress
            </div>
          </div>
        </div>

        {song.ai_radio_potential || song.ai_hook_commercial_potential ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "0.65rem",
              marginTop: "0.75rem",
            }}
          >
            {song.ai_radio_potential ? (
              <div
                style={{
                  padding: "0.75rem",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                }}
              >
                <div className="eyebrow">Radio potential</div>
                <div className="copy" style={{ marginTop: "0.25rem" }}>
                  {song.ai_radio_potential}
                </div>
              </div>
            ) : null}

            {song.ai_hook_commercial_potential ? (
              <div
                style={{
                  padding: "0.75rem",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                }}
              >
                <div className="eyebrow">Commercial hook potential</div>
                <div className="copy" style={{ marginTop: "0.25rem" }}>
                  {song.ai_hook_commercial_potential}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <details style={{ marginTop: "0.8rem" }}>
          <summary
            className="copy"
            style={{ cursor: "pointer", fontWeight: 800, width: "fit-content" }}
          >
            Why this score?
          </summary>

          <ScoreBreakdown assessment={assessment} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "0.75rem",
              marginTop: "0.75rem",
            }}
          >
            <div>
              <div className="eyebrow">Positive signals</div>
              {assessment.reasons.length ? (
                <ul className="copy" style={{ paddingLeft: "1.2rem" }}>
                  {assessment.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="copy">No dominant positive signal yet.</p>
              )}
            </div>

            <div>
              <div className="eyebrow">Opportunity gaps</div>
              {assessment.watchItems.length ? (
                <ul className="copy" style={{ paddingLeft: "1.2rem" }}>
                  {assessment.watchItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="copy">No major gaps identified.</p>
              )}
            </div>
          </div>
        </details>

        {song.audio_url ? (
          <audio
            controls
            preload="none"
            className="audioPlayer"
            style={{ marginTop: "0.85rem" }}
          >
            <source src={song.audio_url} />
          </audio>
        ) : null}

        <div className="button-row" style={{ marginTop: "0.9rem" }}>
          <Link className="button primary" href={`/studio/songs/${song.slug}/edit`}>
            Work this song
          </Link>
          <Link className="button" href={`/songs/${song.slug}`}>
            View song
          </Link>
        </div>
      </div>

      <PortfolioControls
        song={song}
        state={state}
        updateLocalSong={updateLocalSong}
        saveWorkflow={saveWorkflow}
      />
    </article>
  );
}

export default function StudioPortfolio({ initialSongs }: Props) {
  const router = useRouter();
  const [songs, setSongs] = useState(initialSongs);
  const [search, setSearch] = useState("");
  const [museFilter, setMuseFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [analysisFilter, setAnalysisFilter] = useState("all");
  const [sortMode, setSortMode] = useState("opportunity");
  const [showFinished, setShowFinished] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({});

  const museOptions = useMemo(
    () =>
      Array.from(
        new Set(
          songs
            .map((song) => song.muse_slug)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [songs],
  );

  const stageOptions = useMemo(
    () => Array.from(new Set(songs.map((song) => song.current_stage))).sort(),
    [songs],
  );

  const opportunityModel = useMemo(() => {
    const maxListens = Math.max(0, ...songs.map((song) => song.audio_play_count));
    const assessments = new Map<string, OpportunityAssessment>();

    for (const song of songs) {
      assessments.set(song.id, buildOpportunityAssessment(song, maxListens));
    }

    const rankedActive = songs
      .filter(
        (song) =>
          !recalculateFinished(song) &&
          song.priority_tier !== "archive" &&
          song.workflow_status !== "archived",
      )
      .sort((a, b) => {
        const scoreDifference =
          (assessments.get(b.id)?.score ?? 0) -
          (assessments.get(a.id)?.score ?? 0);

        if (scoreDifference !== 0) return scoreDifference;

        const releaseDifference =
          (b.ai_ready_for_release_score ?? -1) -
          (a.ai_ready_for_release_score ?? -1);

        if (releaseDifference !== 0) return releaseDifference;

        return b.audio_play_count - a.audio_play_count;
      });

    const rankBySong = new Map(
      rankedActive.map((song, index) => [song.id, index + 1]),
    );

    const topSong = rankedActive[0] ?? null;

    return {
      assessments,
      rankBySong,
      topSong,
      topAssessment: topSong ? assessments.get(topSong.id) ?? null : null,
    };
  }, [songs]);

  const summary = useMemo(() => {
    const active = songs.filter((song) => !recalculateFinished(song)).length;
    const now = songs.filter(
      (song) => song.priority_tier === "now" && !recalculateFinished(song),
    ).length;
    const openTasks = songs.reduce(
      (total, song) => total + song.open_task_count + song.in_progress_task_count,
      0,
    );
    const releaseCandidates = songs.filter(
      (song) =>
        (song.ai_ready_for_release_score || 0) >= 80 &&
        !recalculateFinished(song),
    ).length;
    const finished = songs.filter((song) => recalculateFinished(song)).length;
    const totalListens = songs.reduce(
      (total, song) => total + song.audio_play_count,
      0,
    );
    const totalRatings = songs.reduce(
      (total, song) => total + song.listener_rating_count,
      0,
    );
const DISPLAY_LIMIT = 12;
    return {
      active,
      now,
      openTasks,
      releaseCandidates,
      finished,
      totalListens,
      totalRatings,
    };
  }, [songs]);

  const visibleSongs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = songs.filter((song) => {
      const finished = recalculateFinished(song);

      if (!showFinished && finished) return false;
      if (
        normalizedSearch &&
        !song.title.toLowerCase().includes(normalizedSearch) &&
        !(song.summary || "").toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      if (museFilter !== "all" && song.muse_slug !== museFilter) return false;
      if (stageFilter !== "all" && song.current_stage !== stageFilter) return false;
      if (priorityFilter !== "all" && song.priority_tier !== priorityFilter) {
        return false;
      }
      if (analysisFilter === "analyzed" && song.ai_overall_score === null) {
        return false;
      }
      if (analysisFilter === "not_analyzed" && song.ai_overall_score !== null) {
        return false;
      }
      if (
        analysisFilter === "release_candidates" &&
        (song.ai_ready_for_release_score || 0) < 80
      ) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "opportunity") {
        return (
          (opportunityModel.assessments.get(b.id)?.score ?? 0) -
          (opportunityModel.assessments.get(a.id)?.score ?? 0)
        );
      }

      if (sortMode === "ai_score") {
        return (b.ai_overall_score ?? -1) - (a.ai_overall_score ?? -1);
      }

      if (sortMode === "audience_score") {
        return (b.ai_audience_score ?? -1) - (a.ai_audience_score ?? -1);
      }

      if (sortMode === "release_score") {
        return (
          (b.ai_ready_for_release_score ?? -1) -
          (a.ai_ready_for_release_score ?? -1)
        );
      }

      if (sortMode === "my_rating") {
        return (b.personal_rating ?? -1) - (a.personal_rating ?? -1);
      }

      if (sortMode === "listener_rating") {
        const ratingDifference =
          (b.listener_rating_average ?? -1) - (a.listener_rating_average ?? -1);

        if (ratingDifference !== 0) return ratingDifference;

        return b.listener_rating_count - a.listener_rating_count;
      }

      if (sortMode === "most_listened") {
        return b.audio_play_count - a.audio_play_count;
      }

      if (sortMode === "video_clicks") {
        return b.video_click_count - a.video_click_count;
      }

      if (sortMode === "versions") {
        return b.version_count - a.version_count;
      }

      if (sortMode === "title") {
        return a.title.localeCompare(b.title);
      }

      const priorityDifference =
        PRIORITY_ORDER[a.priority_tier] - PRIORITY_ORDER[b.priority_tier];

      if (priorityDifference !== 0) return priorityDifference;

      const aRank = a.priority_rank ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.priority_rank ?? Number.MAX_SAFE_INTEGER;

      if (aRank !== bRank) return aRank - bRank;

      return a.title.localeCompare(b.title);
    });
  }, [
    analysisFilter,
    museFilter,
    opportunityModel.assessments,
    priorityFilter,
    search,
    showFinished,
    sortMode,
    songs,
    stageFilter,
  ]);

  const displayedSongs = visibleSongs.slice(0, DISPLAY_LIMIT);
  
  function updateLocalSong(
    songId: string,
    patch: Partial<StudioPortfolioSong>,
  ) {
    setSongs((current) =>
      current.map((song) => {
        if (song.id !== songId) return song;

        const updated = {
          ...song,
          ...patch,
        };

        return {
          ...updated,
          is_finished: recalculateFinished(updated),
        };
      }),
    );
  }

  async function saveWorkflow(
    song: StudioPortfolioSong,
    patch: Partial<
      Pick<
        StudioPortfolioSong,
        | "priority_tier"
        | "priority_rank"
        | "workflow_status"
        | "personal_rating"
      >
    >,
  ) {
    const nextSong = {
      ...song,
      ...patch,
    };

    updateLocalSong(song.id, patch);
    setSaveState((current) => ({
      ...current,
      [song.id]: {
        status: "saving",
        message: "Saving…",
      },
    }));

    try {
      const requestBody = new FormData();
      requestBody.append("song_id", song.id);
      requestBody.append("priority_tier", nextSong.priority_tier);
      requestBody.append(
        "priority_rank",
        nextSong.priority_rank ? String(nextSong.priority_rank) : "",
      );
      requestBody.append("workflow_status", nextSong.workflow_status);
      requestBody.append(
        "personal_rating",
        nextSong.personal_rating === null ? "" : String(nextSong.personal_rating),
      );

      const response = await fetch("/api/studio/song-workflow", {
        method: "PATCH",
        body: requestBody,
      });

      const result = (await response.json().catch(() => null)) as {
        status?: string;
        message?: string;
        workflow?: {
          priority_tier: PriorityTier;
          priority_rank: number | null;
          workflow_status: WorkflowStatus;
          personal_rating: number | null;
        };
      } | null;

      if (!response.ok || result?.status !== "success" || !result.workflow) {
        throw new Error(
          result?.message ||
            `Workflow update failed with status ${response.status}.`,
        );
      }

      updateLocalSong(song.id, result.workflow);
      setSaveState((current) => ({
        ...current,
        [song.id]: {
          status: "success",
          message: "Saved",
        },
      }));

      // Refresh the server-rendered Advance card so its recommendation
      // reflects the newly saved priority or rating.
      router.refresh();
    } catch (error) {
      updateLocalSong(song.id, {
        priority_tier: song.priority_tier,
        priority_rank: song.priority_rank,
        workflow_status: song.workflow_status,
        personal_rating: song.personal_rating,
      });

      setSaveState((current) => ({
        ...current,
        [song.id]: {
          status: "error",
          message:
            error instanceof Error ? error.message : "Workflow save failed.",
        },
      }));
    }
  }

  const summaryCards = [
    {
      label: "Top Opportunity",
      value: opportunityModel.topAssessment?.score ?? "—",
      detail: opportunityModel.topSong?.title ?? "No active song",
    },
    { label: "Active Songs", value: summary.active },
    { label: "Work Now", value: summary.now },
    { label: "Active Tasks", value: summary.openTasks },
    { label: "Release Candidates", value: summary.releaseCandidates },
    { label: "Finished", value: summary.finished },
    { label: "Total Listens", value: summary.totalListens.toLocaleString() },
    { label: "Listener Ratings", value: summary.totalRatings },
  ];

  return (
    <div style={{ marginTop: "1.25rem" }}>
      {opportunityModel.topSong && opportunityModel.topAssessment ? (
        <TopOpportunityCard
          song={opportunityModel.topSong}
          assessment={opportunityModel.topAssessment}
        />
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {summaryCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            detail={card.detail}
          />
        ))}
      </div>

      <PortfolioFilters
        search={search}
        setSearch={setSearch}
        museFilter={museFilter}
        setMuseFilter={setMuseFilter}
        stageFilter={stageFilter}
        setStageFilter={setStageFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        analysisFilter={analysisFilter}
        setAnalysisFilter={setAnalysisFilter}
        sortMode={sortMode}
        setSortMode={setSortMode}
        showFinished={showFinished}
        setShowFinished={setShowFinished}
        museOptions={museOptions}
        stageOptions={stageOptions}
      />

      <div
        className="copy"
        style={{
          marginTop: "0.75rem",
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <span>
          Showing <strong>{displayedSongs.length}</strong> of{" "}
          <strong>{songs.length}</strong> songs
        </span>
        {!showFinished && summary.finished > 0 ? (
          <span>{summary.finished} finished song(s) hidden</span>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: "0.85rem", marginTop: "1rem" }}>
        {displayedSongs.map((song) => {
          const assessment = opportunityModel.assessments.get(song.id);

          if (!assessment) return null;

          return (
            <SongOpportunityCard
              key={song.id}
              song={song}
              assessment={assessment}
              rank={opportunityModel.rankBySong.get(song.id) ?? null}
              state={saveState[song.id]}
              updateLocalSong={updateLocalSong}
              saveWorkflow={saveWorkflow}
            />
          );
        })}
      </div>

      {displayedSongs.length === 0 ? (
        <div
          className="copy"
          style={{
            marginTop: "1rem",
            padding: "1rem",
            border: "1px dashed var(--line)",
            borderRadius: 16,
          }}
        >
          No songs match the current filters.
        </div>
      ) : null}
    </div>
  );
}
