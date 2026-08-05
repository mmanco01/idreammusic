import Link from "next/link";
import { getServerAuthContext } from "@/lib/auth";
import { getMySongs } from "@/lib/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import StudioPortfolio, {
  type StudioPortfolioSong,
} from "@/components/studio/StudioPortfolio";

type VersionRow = {
  song_id: string;
  stage: string | null;
};

type WorkflowRow = {
  song_id: string;
  priority_tier: "now" | "next" | "later" | "someday" | "archive";
  priority_rank: number | null;
  workflow_status:
    | "unreviewed"
    | "active"
    | "waiting"
    | "completed"
    | "archived";
  next_action: string | null;
  target_date: string | null;
  personal_rating: number | null;
};

type EngagementSummaryRow = {
  song_id: string;
  audio_play_count: number | string | null;
  video_click_count: number | string | null;
};

type ListenerRatingSummaryRow = {
  song_id: string;
  average_rating: number | string | null;
  rating_count: number | string | null;
};

type AnalysisRow = {
  song_id: string;
  raw_result: unknown;
  completed_at: string | null;
  created_at: string;
};

type TaskRow = {
  song_id: string;
  status: "open" | "in_progress" | "completed" | "dismissed";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readNumber(value: unknown, key: string): number | null {
  const record = asRecord(value);
  if (!record) return null;

  const candidate = record[key];

  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function readNestedValue(value: unknown, path: string[]): unknown {
  let current: unknown = value;

  for (const key of path) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }

  return current;
}

function readNestedNumber(value: unknown, path: string[]): number | null {
  const candidate = readNestedValue(value, path);

  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function readNestedString(value: unknown, path: string[]): string | null {
  const candidate = readNestedValue(value, path);

  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
}

function readNestedStringArray(value: unknown, path: string[]): string[] {
  const candidate = readNestedValue(value, path);

  if (!Array.isArray(candidate)) return [];

  return candidate.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function normalizeStudioSong(
  song: Awaited<ReturnType<typeof getMySongs>>[number],
) {
  return {
    id: song.id,
    slug: song.slug,
    title: song.title || "Untitled song",
    summary: song.summary ?? null,
    audio_url: song.audio_url ?? null,
    current_stage: song.current_stage || "spark",
    muse_slug: song.muse_slug ?? null,
  };
}

async function buildStudioPortfolio(
  userId: string,
  mySongs: Awaited<ReturnType<typeof getMySongs>>,
): Promise<StudioPortfolioSong[]> {
  if (!mySongs.length) {
    return [];
  }

  const songIds = mySongs.map((song) => song.id);
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return mySongs.map((song) => ({
      ...normalizeStudioSong(song),
      version_count: 0,
      spark_version_count: 0,
      draft_version_count: 0,
      final_version_count: 0,
      all_versions_final: false,
      is_finished:
        String(song.current_stage || "").toLowerCase() === "final",
      priority_tier: "later",
      priority_rank: null,
      workflow_status: "active",
      next_action: null,
      target_date: null,
      personal_rating: null,
      ai_overall_score: null,
      ai_ready_for_release_score: null,
      ai_audience_score: null,
      ai_likely_listeners: [],
      ai_playlist_fit: [],
      ai_sync_opportunities: [],
      ai_radio_potential: null,
      ai_hook_commercial_potential: null,
      ai_completed_at: null,
      open_task_count: 0,
      in_progress_task_count: 0,
      audio_play_count: 0,
      video_click_count: 0,
      listener_rating_average: null,
      listener_rating_count: 0,
    }));
  }

  const [
    versionsResult,
    workflowResult,
    analysisResult,
    tasksResult,
    engagementResult,
    listenerRatingsResult,
  ] = await Promise.all([
    supabase
      .from("song_versions")
      .select("song_id, stage")
      .in("song_id", songIds),

    supabase
      .from("song_workflow")
      .select(
        "song_id, priority_tier, priority_rank, workflow_status, next_action, target_date, personal_rating",
      )
      .eq("user_id", userId)
      .in("song_id", songIds),

    supabase
      .from("ai_analysis_runs")
      .select("song_id, raw_result, completed_at, created_at")
      .eq("status", "ready")
      .in("song_id", songIds)
      .order("created_at", { ascending: false }),

    supabase
      .from("song_tasks")
      .select("song_id, status")
      .in("song_id", songIds),

    supabase
      .from("song_engagement_summaries")
      .select("song_id, audio_play_count, video_click_count")
      .in("song_id", songIds),

    supabase
      .from("song_rating_summaries")
      .select("song_id, average_rating, rating_count")
      .in("song_id", songIds),
  ]);

  if (versionsResult.error) {
    console.error("Studio version summary failed:", versionsResult.error.message);
  }

  if (workflowResult.error) {
    console.error("Studio workflow summary failed:", workflowResult.error.message);
  }

  if (analysisResult.error) {
    console.error("Studio AI summary failed:", analysisResult.error.message);
  }

  if (tasksResult.error) {
    console.error("Studio task summary failed:", tasksResult.error.message);
  }

  if (engagementResult.error) {
    console.error(
      "Studio engagement summary failed:",
      engagementResult.error.message,
    );
  }

  if (listenerRatingsResult.error) {
    console.error(
      "Studio listener rating summary failed:",
      listenerRatingsResult.error.message,
    );
  }

  const versions = (versionsResult.data || []) as VersionRow[];
  const workflows = (workflowResult.data || []) as WorkflowRow[];
  const analyses = (analysisResult.data || []) as AnalysisRow[];
  const tasks = (tasksResult.data || []) as TaskRow[];
  const engagementSummaries = (engagementResult.data ||
    []) as EngagementSummaryRow[];
  const listenerRatingSummaries = (listenerRatingsResult.data ||
    []) as ListenerRatingSummaryRow[];

  const versionSummary = new Map<
    string,
    {
      total: number;
      spark: number;
      draft: number;
      final: number;
    }
  >();

  for (const version of versions) {
    const current = versionSummary.get(version.song_id) || {
      total: 0,
      spark: 0,
      draft: 0,
      final: 0,
    };

    current.total += 1;

    const stage = String(version.stage || "").toLowerCase();

    if (stage === "spark") {
      current.spark += 1;
    } else if (stage === "draft") {
      current.draft += 1;
    } else if (stage === "final") {
      current.final += 1;
    }

    versionSummary.set(version.song_id, current);
  }

  const workflowBySong = new Map(
    workflows.map((workflow) => [workflow.song_id, workflow]),
  );

  const latestAnalysisBySong = new Map<string, AnalysisRow>();

  for (const analysis of analyses) {
    if (!latestAnalysisBySong.has(analysis.song_id)) {
      latestAnalysisBySong.set(analysis.song_id, analysis);
    }
  }

  const engagementBySong = new Map(
    engagementSummaries.map((row) => [
      row.song_id,
      {
        audioPlayCount: Number(row.audio_play_count || 0),
        videoClickCount: Number(row.video_click_count || 0),
      },
    ]),
  );

  const listenerRatingBySong = new Map(
    listenerRatingSummaries.map((row) => [
      row.song_id,
      {
        averageRating:
          row.average_rating === null || row.average_rating === undefined
            ? null
            : Number(row.average_rating),
        ratingCount: Number(row.rating_count || 0),
      },
    ]),
  );

  const taskSummary = new Map<
    string,
    {
      open: number;
      inProgress: number;
    }
  >();

  for (const task of tasks) {
    const current = taskSummary.get(task.song_id) || {
      open: 0,
      inProgress: 0,
    };

    if (task.status === "open") {
      current.open += 1;
    } else if (task.status === "in_progress") {
      current.inProgress += 1;
    }

    taskSummary.set(task.song_id, current);
  }

  return mySongs.map((song) => {
    const version = versionSummary.get(song.id) || {
      total: 0,
      spark: 0,
      draft: 0,
      final: 0,
    };

    const workflow = workflowBySong.get(song.id);
    const latestAnalysis = latestAnalysisBySong.get(song.id);
    const rawResult = latestAnalysis?.raw_result;

    const task = taskSummary.get(song.id) || {
      open: 0,
      inProgress: 0,
    };

    const engagement = engagementBySong.get(song.id) || {
      audioPlayCount: 0,
      videoClickCount: 0,
    };

    const listenerRating = listenerRatingBySong.get(song.id) || {
      averageRating: null,
      ratingCount: 0,
    };

    const allVersionsFinal =
      version.total > 0 && version.final === version.total;
    const workflowStatus = workflow?.workflow_status || "active";

    const isFinished =
      String(song.current_stage || "").toLowerCase() === "final" ||
      allVersionsFinal ||
      workflowStatus === "completed" ||
      workflowStatus === "archived";

    return {
      ...normalizeStudioSong(song),
      version_count: version.total,
      spark_version_count: version.spark,
      draft_version_count: version.draft,
      final_version_count: version.final,
      all_versions_final: allVersionsFinal,
      is_finished: isFinished,
      priority_tier: workflow?.priority_tier || "later",
      priority_rank: workflow?.priority_rank ?? null,
      workflow_status: workflowStatus,
      next_action: workflow?.next_action || null,
      target_date: workflow?.target_date || null,

      personal_rating:
        workflow?.personal_rating === null ||
        workflow?.personal_rating === undefined
          ? null
          : Number(workflow.personal_rating),

      ai_overall_score: latestAnalysis
        ? readNumber(rawResult, "overall_score")
        : null,

      ai_ready_for_release_score: latestAnalysis
        ? readNumber(rawResult, "ready_for_release_score")
        : null,

      ai_audience_score: latestAnalysis
        ? readNestedNumber(rawResult, ["audience", "audience_rank_score"])
        : null,

      ai_likely_listeners: latestAnalysis
        ? readNestedStringArray(rawResult, ["audience", "likely_listeners"])
        : [],

      ai_playlist_fit: latestAnalysis
        ? readNestedStringArray(rawResult, [
            "audience",
            "streaming_playlist_fit",
          ])
        : [],

      ai_sync_opportunities: latestAnalysis
        ? readNestedStringArray(rawResult, [
            "audience",
            "sync_opportunities",
          ])
        : [],

      ai_radio_potential: latestAnalysis
        ? readNestedString(rawResult, ["audience", "radio_potential"])
        : null,

      ai_hook_commercial_potential: latestAnalysis
        ? readNestedString(rawResult, ["hook", "commercial_potential"])
        : null,

      ai_completed_at: latestAnalysis?.completed_at || null,
      open_task_count: task.open,
      in_progress_task_count: task.inProgress,
      audio_play_count: engagement.audioPlayCount,
      video_click_count: engagement.videoClickCount,
      listener_rating_average: listenerRating.averageRating,
      listener_rating_count: listenerRating.ratingCount,
    };
  });
}

function countStage(
  songs: StudioPortfolioSong[],
  stage: "spark" | "draft" | "final",
) {
  return songs.filter(
    (song) => String(song.current_stage || "").toLowerCase() === stage,
  ).length;
}


function normalizeSongTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function displayScore(value: number | null) {
  return value === null ? "—" : Math.round(value).toString();
}

function displayListenerRating(
  average: number | null,
  count: number,
) {
  if (average === null || count <= 0) {
    return "—";
  }

  return `${average.toFixed(1)} / 5`;
}

function FeaturedPortfolioSong({
  song,
}: {
  song: StudioPortfolioSong;
}) {
  const activeTasks =
    song.open_task_count + song.in_progress_task_count;

  const metrics = [
    {
      label: "AI overall",
      value: displayScore(song.ai_overall_score),
      detail:
        song.ai_overall_score === null
          ? "Not analyzed"
          : "Creative strength",
    },
    {
      label: "Release ready",
      value: displayScore(song.ai_ready_for_release_score),
      detail:
        song.ai_ready_for_release_score === null
          ? "Not analyzed"
          : "Release readiness",
    },
    {
      label: "Audience fit",
      value: displayScore(song.ai_audience_score),
      detail:
        song.ai_audience_score === null
          ? "Not analyzed"
          : "Audience score",
    },
    {
      label: "Your rating",
      value: displayScore(song.personal_rating),
      detail:
        song.personal_rating === null
          ? "Set in portfolio controls below"
          : "Human judgment",
    },
    {
      label: "Listener rating",
      value: displayListenerRating(
        song.listener_rating_average,
        song.listener_rating_count,
      ),
      detail:
        song.listener_rating_count > 0
          ? `${song.listener_rating_count} ${
              song.listener_rating_count === 1
                ? "rating"
                : "ratings"
            }`
          : "No ratings yet",
    },
    {
      label: "Listens",
      value: song.audio_play_count.toLocaleString(),
      detail: "Recorded audio plays",
    },
    {
      label: "Versions",
      value: song.version_count,
      detail: `${song.final_version_count} final`,
    },
    {
      label: "Active tasks",
      value: activeTasks,
      detail: `${song.open_task_count} open · ${song.in_progress_task_count} in progress`,
    },
  ];

  return (
    <section
      style={{
        marginTop: "1rem",
        marginBottom: "1.25rem",
        padding: "1.15rem",
        borderRadius: 20,
        border: "1px solid rgba(220, 182, 92, 0.62)",
        background:
          "radial-gradient(circle at top right, rgba(151, 106, 40, 0.18), transparent 34%), linear-gradient(145deg, rgba(151, 106, 40, 0.13), rgba(255,255,255,0.025))",
        boxShadow: "0 18px 46px rgba(0,0,0,0.16)",
      }}
    >
      <div className="eyebrow">
        Featured demonstration song
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "1rem",
          alignItems: "end",
          marginTop: "0.35rem",
        }}
      >
        <div>
          <h3
            className="h2"
            style={{
              marginTop: 0,
              marginBottom: "0.45rem",
            }}
          >
            {song.title}
          </h3>

          <p className="copy" style={{ maxWidth: 780 }}>
            Born from a dream of an outdoor performance, “Do You Believe?”
            grew from a repeated question and the memory of three voices
            joining in communal harmony.
          </p>

          <div className="pillRow" style={{ marginTop: "0.75rem" }}>
            <span className="pill">
              {song.current_stage}
            </span>

            <span className="pill">
              Polyhymnia — Faith
            </span>

            <span className="pill">
              Priority {song.priority_tier}
            </span>

            <span className="pill">
              {song.workflow_status}
            </span>

            {song.ai_completed_at ? (
              <span className="pill">
                Intelligence saved
              </span>
            ) : (
              <span className="pill">
                Needs intelligence
              </span>
            )}
          </div>
        </div>

        <div className="button-row">
          <Link
            className="button primary"
            href={`/studio/songs/${song.slug}/edit`}
          >
            Work this song
          </Link>

          <Link
            className="button"
            href={`/songs/${song.slug}`}
          >
            View song
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(135px, 1fr))",
          gap: "0.7rem",
          marginTop: "1rem",
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              padding: "0.85rem",
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "rgba(0,0,0,0.14)",
            }}
          >
            <div className="eyebrow">
              {metric.label}
            </div>

            <div
              className="h3"
              style={{
                marginTop: "0.3rem",
                marginBottom: 0,
                fontSize: "1.55rem",
              }}
            >
              {metric.value}
            </div>

            <p
              className="copy"
              style={{
                margin: "0.2rem 0 0",
                fontSize: "0.82rem",
                opacity: 0.82,
              }}
            >
              {metric.detail}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "0.9rem",
          padding: "0.85rem",
          borderRadius: 14,
          border: "1px solid rgba(220, 182, 92, 0.32)",
          background: "rgba(0,0,0,0.1)",
        }}
      >
        <div className="eyebrow">Song summary</div>
        <p className="copy" style={{ marginBottom: 0 }}>
          Born from a dream of an outdoor performance, “Do You Believe?”
          grew from a repeated question and the memory of three voices
          joining in communal harmony.
        </p>
      </div>
    </section>
  );
}

type StudioFocusAction = {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  href: string;
};

function isActiveStudioSong(song: StudioPortfolioSong) {
  return (
    !song.is_finished &&
    song.priority_tier !== "archive" &&
    song.workflow_status !== "archived"
  );
}

function chooseFocusSong(songs: StudioPortfolioSong[]) {
  const activeSongs = songs.filter(isActiveStudioSong);

  return (
    activeSongs.find((song) => song.in_progress_task_count > 0) ??
    activeSongs.find((song) => song.priority_tier === "now") ??
    activeSongs.find((song) => song.open_task_count > 0) ??
    activeSongs.find((song) => song.ai_overall_score === null) ??
    activeSongs[0] ??
    songs[0] ??
    null
  );
}

function focusActionForSong(
  song: StudioPortfolioSong | null,
): StudioFocusAction {
  if (!song) {
    return {
      eyebrow: "Your next meaningful move",
      title: "Catch your first Spark",
      description:
        "Begin with a title, lyric, memory, melody, voice memo, or document. Anything is enough to begin.",
      label: "Catch a Spark",
      href: "/studio/capture",
    };
  }

  const activeTaskCount =
    song.open_task_count + song.in_progress_task_count;
  const href = `/studio/songs/${song.slug}/edit`;

  if (song.in_progress_task_count > 0) {
    return {
      eyebrow: "Continue where you left off",
      title: song.title,
      description:
        song.next_action?.trim() ||
        `You already have ${song.in_progress_task_count} development ${
          song.in_progress_task_count === 1 ? "task" : "tasks"
        } in progress. Pick up the work without reopening the whole catalog.`,
      label: "Continue this song",
      href,
    };
  }

  if (song.priority_tier === "now") {
    return {
      eyebrow: "Your current priority",
      title: song.title,
      description:
        song.next_action?.trim() ||
        "This song is marked Now. Open it and take the single recommended step shown in the workbench.",
      label: "Work this song",
      href,
    };
  }

  if (activeTaskCount > 0) {
    return {
      eyebrow: "A task is ready",
      title: song.title,
      description:
        song.next_action?.trim() ||
        `This song has ${activeTaskCount} active ${
          activeTaskCount === 1 ? "task" : "tasks"
        }. Start with the highest-priority one.`,
      label: "Open this song",
      href,
    };
  }

  if (song.ai_overall_score === null) {
    return {
      eyebrow: "Ready to understand",
      title: song.title,
      description:
        String(song.current_stage || "").toLowerCase() === "spark"
          ? "This Spark is waiting for its next guided step. Open it to transcribe audio when needed or run Song Intelligence from saved text."
          : "This song has not been analyzed yet. Open it and follow the guided Song Intelligence step.",
      label: "Understand this Spark",
      href,
    };
  }

  return {
    eyebrow: "Continue shaping",
    title: song.title,
    description:
      song.next_action?.trim() ||
      "Open the song, review its saved Intelligence, and take the next recommended creative step.",
    label: "Continue this song",
    href,
  };
}

function CompactPipeline({
  pipeline,
}: {
  pipeline: {
    total: number;
    active: number;
    sparks: number;
    drafts: number;
    finals: number;
    activeTasks: number;
    totalListens: number;
  };
}) {
  return (
    <section className="card" aria-label="Studio at a glance">
      <div className="eyebrow">Studio at a glance</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(125px, 1fr))",
          gap: "0.65rem",
          marginTop: "0.75rem",
        }}
      >
        {[
          ["Active songs", pipeline.active],
          ["Sparks", pipeline.sparks],
          ["Active tasks", pipeline.activeTasks],
          ["Finished", pipeline.finals],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: "0.8rem",
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.025)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: "0.25rem" }}>
              {label}
            </div>
            <div className="h3" style={{ margin: 0 }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ trashed?: string; view?: string }>;
}) {
  const { trashed, view } = await searchParams;
  const { user, profile } = await getServerAuthContext();
  const rawMySongs = user ? await getMySongs(user.id) : [];
  const mySongs = Array.from(
    new Map(rawMySongs.map((song) => [song.id, song])).values(),
  );

  const portfolioSongs = user
    ? await buildStudioPortfolio(user.id, mySongs)
    : [];

  const featuredPortfolioSong =
    portfolioSongs.find(
      (song) =>
        normalizeSongTitle(song.title) === "do you believe",
    ) ??
    portfolioSongs.find((song) =>
      normalizeSongTitle(song.title).includes("do you believe"),
    ) ??
    null;

  const pipeline = {
    total: portfolioSongs.length,
    active: portfolioSongs.filter(isActiveStudioSong).length,
    sparks: countStage(portfolioSongs, "spark"),
    drafts: countStage(portfolioSongs, "draft"),
    finals: countStage(portfolioSongs, "final"),
    activeTasks: portfolioSongs.reduce(
      (sum, song) =>
        sum + song.open_task_count + song.in_progress_task_count,
      0,
    ),
    totalListens: portfolioSongs.reduce(
      (sum, song) => sum + song.audio_play_count,
      0,
    ),
  };

  const showPortfolio = Boolean(user && view === "portfolio");
  const focusSong = chooseFocusSong(portfolioSongs);
  const focusAction = focusActionForSong(focusSong);

  if (showPortfolio && user) {
    return (
      <section className="section">
        <div className="container pageStack">
          <section
            className="card"
            style={{
              border: "1px solid rgba(220, 182, 92, 0.48)",
              background:
                "radial-gradient(circle at top right, rgba(151, 106, 40, 0.16), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
            }}
          >
            <div className="eyebrow">My creative catalog</div>
            <h1 className="h2" style={{ marginBottom: "0.55rem" }}>
              My Song Portfolio
            </h1>
            <p className="copy" style={{ maxWidth: 850, marginTop: 0 }}>
              Search, compare, prioritize, and manage the complete catalog.
              This detailed workspace stays available without crowding the
              Studio landing page.
            </p>

            <div className="pillRow" style={{ marginTop: "0.75rem" }}>
              <span className="pill">{pipeline.total} songs</span>
              <span className="pill">{pipeline.activeTasks} active tasks</span>
              <span className="pill">{pipeline.totalListens.toLocaleString()} listens</span>
            </div>

            <div className="button-row">
              <Link className="button primary" href="/studio/capture">
                Catch a New Spark
              </Link>
              <Link className="button secondary" href="/studio">
                Back to Studio Home
              </Link>
            </div>
          </section>

          {portfolioSongs.length ? (
            <section className="card" id="song-portfolio">
              <p
                className="copy"
                style={{ marginTop: 0, marginBottom: "0.65rem", opacity: 0.82 }}
              >
                Signed in as {profile?.display_name || user.email}
              </p>

              {featuredPortfolioSong ? (
                <FeaturedPortfolioSong song={featuredPortfolioSong} />
              ) : null}

              <StudioPortfolio initialSongs={portfolioSongs} />
            </section>
          ) : (
            <section className="card">
              <div className="eyebrow">Your catalog is ready</div>
              <h2 className="h2">Catch the first Spark</h2>
              <p className="copy">
                Begin with a title, thought, lyric, melody, recording, or
                document. The rest can come later.
              </p>
              <div className="button-row">
                <Link className="button primary" href="/studio/capture">
                  Catch a Spark
                </Link>
              </div>
            </section>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container pageStack">
        {trashed === "1" ? (
          <div className="statusMessage statusSuccess">
            The item was moved to Trash. You can begin a new Spark whenever you are ready.
          </div>
        ) : null}

        <section
          className="card"
          style={{
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(220, 182, 92, 0.48)",
            background:
              "radial-gradient(circle at top right, rgba(151, 106, 40, 0.18), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
          }}
        >
          <div className="eyebrow">Creator workspace</div>
          <h1
            className="h2"
            style={{
              marginTop: "0.35rem",
              marginBottom: "0.7rem",
              fontSize: "clamp(2.35rem, 5vw, 4.25rem)",
              lineHeight: 1,
            }}
          >
            Songcatcher Studio
          </h1>
          <p
            className="copy"
            style={{ maxWidth: 820, fontSize: "1.08rem", marginTop: 0 }}
          >
            Catch something new, continue the song that needs you now, or
            deliberately open the full catalog. One meaningful move at a time.
          </p>

          <div className="button-row">
            {user ? (
              <>
                <Link className="button primary" href="/studio/capture">
                  Catch a New Spark
                </Link>
                <Link
                  className="button secondary"
                  href="/studio?view=portfolio#song-portfolio"
                >
                  Browse My Songs
                </Link>
              </>
            ) : (
              <Link
                className="button primary"
                href="/auth/sign-in?next=/studio"
              >
                Sign in to Begin
              </Link>
            )}
            <a className="button tertiary" href="#guided-demo">
              See how the journey works
            </a>
          </div>
        </section>

        {user ? (
          <>
            <section className="recommended-action">
              <div className="recommended-action__eyebrow">
                {focusAction.eyebrow}
              </div>
              <h2 className="recommended-action__title">
                {focusAction.title}
              </h2>
              <div className="recommended-action__description">
                <p>{focusAction.description}</p>
              </div>

              {focusSong ? (
                <div className="pillRow" style={{ marginTop: "0.75rem" }}>
                  <span className="pill">{focusSong.current_stage}</span>
                  {focusSong.muse_slug ? (
                    <span className="pill">{focusSong.muse_slug}</span>
                  ) : null}
                  {focusSong.open_task_count + focusSong.in_progress_task_count > 0 ? (
                    <span className="pill">
                      {focusSong.open_task_count + focusSong.in_progress_task_count} active {focusSong.open_task_count + focusSong.in_progress_task_count === 1 ? "task" : "tasks"}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="recommended-action__controls">
                <Link className="button primary" href={focusAction.href}>
                  {focusAction.label}
                </Link>
                <Link className="button secondary" href="/studio/capture">
                  Catch Something New
                </Link>
                <Link
                  className="button tertiary"
                  href="/studio?view=portfolio#song-portfolio"
                >
                  Browse the full catalog
                </Link>
              </div>
            </section>

            <CompactPipeline pipeline={pipeline} />
          </>
        ) : (
          <section className="card">
            <div className="eyebrow">A simple creative path</div>
            <h2 className="h2">Catch. Understand. Collaborate. Shape.</h2>
            <p className="copy" style={{ maxWidth: 820 }}>
              A private account lets you capture words or recordings, run
              Song Intelligence, work with the Muses, and keep every version
              together.
            </p>
            <div className="button-row">
              <Link
                className="button primary"
                href="/auth/sign-in?next=/studio/capture"
              >
                Sign in to Catch a Spark
              </Link>
            </div>
          </section>
        )}

        <section
          id="guided-demo"
          className="card"
          style={{
            border: "1px solid rgba(220, 182, 92, 0.38)",
            background:
              "linear-gradient(145deg, rgba(151, 106, 40, 0.1), rgba(255,255,255,0.025))",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: "1rem",
              alignItems: "end",
            }}
          >
            <div>
              <div className="eyebrow">New to the process?</div>
              <h2 className="h2" style={{ marginBottom: "0.55rem" }}>
                See one Spark become a song
              </h2>
              <p className="copy" style={{ maxWidth: 760, marginBottom: 0 }}>
                Follow “Do You Believe?” from dream fragment through capture,
                Song Intelligence, Muse collaboration, development, sharing,
                and listener response.
              </p>
            </div>
            <div className="button-row" style={{ justifyContent: "flex-start" }}>
              <Link
                href="/studio/demo/do-you-believe"
                className="button secondary"
              >
                Take the Song Journey
              </Link>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
