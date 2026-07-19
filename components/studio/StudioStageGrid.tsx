import Link from "next/link";
import type { StudioPortfolioSong } from "@/components/studio/StudioPortfolio";

type Props = {
  songs: StudioPortfolioSong[];
  isSignedIn: boolean;
};

type RankedSong = {
  song: StudioPortfolioSong;
  score: number;
  recommendation: string;
};

const PRIORITY_SIGNAL = {
  now: 100,
  next: 85,
  later: 65,
  someday: 40,
  archive: 10,
} as const;

const WORKFLOW_SIGNAL = {
  unreviewed: 45,
  active: 82,
  waiting: 60,
  completed: 95,
  archived: 10,
} as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function isFinished(song: StudioPortfolioSong) {
  return (
    song.current_stage.toLowerCase() === "final" ||
    song.all_versions_final ||
    song.workflow_status === "completed" ||
    song.workflow_status === "archived"
  );
}

function listenerSignal(song: StudioPortfolioSong) {
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

function engagementSignal(
  song: StudioPortfolioSong,
  maxListens: number,
) {
  if (maxListens <= 0) return 50;
  if (song.audio_play_count <= 0) return 25;

  const relative =
    Math.log1p(song.audio_play_count) / Math.log1p(maxListens);

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
  const taskCount =
    song.open_task_count + song.in_progress_task_count;

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

function opportunityScore(
  song: StudioPortfolioSong,
  maxListens: number,
) {
  const aiStrength = song.ai_overall_score ?? 45;
  const releaseReadiness =
    song.ai_ready_for_release_score ?? 40;
  const audienceFit = song.ai_audience_score ?? 45;
  const personalConviction = song.personal_rating ?? 50;
  const listenerResponse = listenerSignal(song);
  const engagement = engagementSignal(song, maxListens);
  const momentum = momentumSignal(song);

  return Math.round(
    aiStrength * 0.25 +
      releaseReadiness * 0.2 +
      audienceFit * 0.15 +
      personalConviction * 0.15 +
      listenerResponse * 0.1 +
      engagement * 0.1 +
      momentum * 0.05,
  );
}

function recommendedNextMove(song: StudioPortfolioSong) {
  if (song.next_action?.trim()) {
    return song.next_action.trim();
  }

  if (song.in_progress_task_count > 0) {
    return song.in_progress_task_count === 1
      ? "Complete the active development task and reassess the song."
      : `Complete the ${song.in_progress_task_count} active development tasks and reassess the song.`;
  }

  if (song.open_task_count > 0) {
    return "Start the highest-priority open song task.";
  }

  if (song.ai_overall_score === null) {
    return "Run AI Song Intelligence to establish the song’s creative and commercial baseline.";
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

function rankTopOpportunity(
  songs: StudioPortfolioSong[],
): RankedSong | null {
  const activeSongs = songs.filter(
    (song) =>
      !isFinished(song) &&
      song.priority_tier !== "archive" &&
      song.workflow_status !== "archived",
  );

  if (!activeSongs.length) {
    return null;
  }

  const maxListens = Math.max(
    0,
    ...songs.map((song) => song.audio_play_count),
  );

  return activeSongs
    .map((song) => ({
      song,
      score: opportunityScore(song, maxListens),
      recommendation: recommendedNextMove(song),
    }))
    .sort((a, b) => {
      const scoreDifference = b.score - a.score;

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const releaseDifference =
        (b.song.ai_ready_for_release_score ?? -1) -
        (a.song.ai_ready_for_release_score ?? -1);

      if (releaseDifference !== 0) {
        return releaseDifference;
      }

      return b.song.audio_play_count - a.song.audio_play_count;
    })[0];
}

export default function StudioStageGrid({
  songs,
  isSignedIn,
}: Props) {
  const topOpportunity = rankTopOpportunity(songs);

  return (
    <div className="stage-grid">
      <div className="stage-card">
        <h3 className="h3">Capture</h3>

        <p className="copy">
          Upload a spark, draft, final cut, lyric sheet, or voice memo and
          connect it to the right Muse.
        </p>

        <Link
          className="button"
          href={
            isSignedIn
              ? "/studio/capture"
              : "/auth/sign-in?next=/studio/capture"
          }
        >
          New upload
        </Link>
      </div>

      <div className="stage-card">
        <h3 className="h3">Develop</h3>

        <p className="copy">
          Generate transcripts and Song Intelligence, create development
          tasks, and move songs through Now, Next, and Later.
        </p>

        <Link className="button" href="#song-portfolio">
          Open workspace
        </Link>
      </div>

      <div
        className="stage-card"
        style={{
          borderColor: topOpportunity
            ? "rgba(231, 190, 101, 0.7)"
            : undefined,
          background: topOpportunity
            ? "linear-gradient(145deg, rgba(196, 145, 47, 0.13), rgba(255,255,255,0.025))"
            : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}
        >
          <h3 className="h3">Advance</h3>

          {topOpportunity ? (
            <span className="pill">
              Opportunity {topOpportunity.score}
            </span>
          ) : null}
        </div>

        {topOpportunity ? (
          <>
            <div
              className="eyebrow"
              style={{ marginTop: "0.4rem" }}
            >
              Today&apos;s recommendation
            </div>

            <div
              style={{
                fontWeight: 800,
                fontSize: "1.08rem",
                marginTop: "0.25rem",
              }}
            >
              {topOpportunity.song.title}
            </div>

            <p className="copy" style={{ marginTop: "0.5rem" }}>
              {topOpportunity.recommendation}
            </p>

            <div
              className="button-row"
              style={{ marginTop: "auto", paddingTop: "0.75rem" }}
            >
              <Link
                className="button primary"
                href={`/studio/songs/${topOpportunity.song.slug}/edit`}
              >
                Advance this song
              </Link>

              <Link className="button" href="#song-portfolio">
                Compare opportunities
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="copy">
              No unfinished song is currently waiting for advancement.
              Capture a new idea or show finished history in the portfolio.
            </p>

            <Link
              className="button"
              href={
                isSignedIn
                  ? "/studio/capture"
                  : "/auth/sign-in?next=/studio/capture"
              }
            >
              Capture the next song
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
