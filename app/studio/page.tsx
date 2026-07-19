import Link from "next/link";
import { getServerAuthContext } from "@/lib/auth";
import { getMySongs } from "@/lib/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import StudioPortfolio, {
  type StudioPortfolioSong,
} from "@/components/studio/StudioPortfolio";
import StudioStageGrid from "@/components/studio/StudioStageGrid";

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

export default async function StudioPage() {
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
    portfolioSongs.find(
      (song) =>
        normalizeSongTitle(song.title).includes(
          "do you believe",
        ),
    ) ??
    null;

  const pipeline = {
    total: portfolioSongs.length,
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

  return (
    <section className="section">
      <div className="container pageStack">
        <style>{`
          @media (min-width: 760px) {
            .studio-title-one-line,
            .demo-title-one-line {
              white-space: nowrap;
            }

            .demo-title-one-line {
              font-size: clamp(1.7rem, 3vw, 2.65rem) !important;
            }
          }

          @media (max-width: 759px) {
            .studio-title-one-line,
            .demo-title-one-line {
              white-space: normal;
            }
          }
        `}</style>

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
            className="h2 studio-title-one-line"
            style={{
              marginTop: "0.45rem",
              marginBottom: "1rem",
              fontSize: "clamp(2.35rem, 5vw, 4.45rem)",
              lineHeight: 1,
            }}
          >
            Songcatcher Studio
          </h1>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
              alignItems: "end",
              gap: "1.25rem",
            }}
          >
            <div>
              <p
                className="copy"
                style={{
                  maxWidth: 820,
                  fontSize: "1.08rem",
                  lineHeight: 1.7,
                  marginTop: 0,
                }}
              >
                Catch songs, understand what they need, work with the
                Muses, and decide what deserves your creative attention
                next.
              </p>

              <div className="button-row">
                {user ? (
                  <>
                    <Link
                      className="button primary"
                      href="/studio/capture"
                    >
                      New song or recording
                    </Link>

                    <a className="button" href="#song-portfolio">
                      Browse my songs
                    </a>
                  </>
                ) : (
                  <Link
                    className="button primary"
                    href="/auth/sign-in?next=/studio"
                  >
                    Sign in to begin
                  </Link>
                )}

                <a className="button" href="#guided-demo">
                  See the complete journey
                </a>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: "0.7rem",
              }}
            >
              {[
                ["Catch", "Capture the spark"],
                ["Understand", "Run Song Intelligence"],
                ["Collaborate", "Work with the Muses"],
                ["Share", "Reach real listeners"],
              ].map(([title, description]) => (
                <div
                  key={title}
                  style={{
                    padding: "0.9rem",
                    borderRadius: 14,
                    border: "1px solid var(--line)",
                    background: "rgba(0,0,0,0.12)",
                  }}
                >
                  <div className="eyebrow">{title}</div>
                  <p
                    className="copy"
                    style={{ margin: "0.35rem 0 0" }}
                  >
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {user ? (
          <section className="card">
            <div className="eyebrow">My creative pipeline</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.8rem",
                marginTop: "0.8rem",
              }}
            >
              {[
                ["Songs", pipeline.total],
                ["Sparks", pipeline.sparks],
                ["Drafts", pipeline.drafts],
                ["Final", pipeline.finals],
                ["Active tasks", pipeline.activeTasks],
                ["Listens", pipeline.totalListens],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  style={{
                    padding: "0.9rem",
                    borderRadius: 14,
                    border: "1px solid var(--line)",
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="eyebrow">{label}</div>
                  <div
                    className="h3"
                    style={{
                      marginTop: "0.35rem",
                      marginBottom: 0,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: "0.45rem",
                alignItems: "center",
                marginTop: "1rem",
              }}
              aria-label="Spark to Draft to Final pipeline"
            >
              {[
                ["Spark", pipeline.sparks],
                ["Draft", pipeline.drafts],
                ["Final", pipeline.finals],
              ].map(([label, value], index) => (
                <div
                  key={String(label)}
                  style={{
                    padding: "0.75rem",
                    textAlign: "center",
                    borderRadius: 999,
                    border:
                      index === 2
                        ? "1px solid rgba(220, 182, 92, 0.55)"
                        : "1px solid var(--line)",
                    background:
                      index === 2
                        ? "rgba(151, 106, 40, 0.14)"
                        : "rgba(255,255,255,0.025)",
                  }}
                >
                  <strong>{label}</strong> · {value}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="eyebrow">Today in the Studio</div>
          <h2 className="h2">Choose the next meaningful move</h2>
          <p className="copy" style={{ maxWidth: 850 }}>
            Capture something new, continue developing a song, or use
            opportunity intelligence to focus on the song most ready for
            your attention.
          </p>

          <StudioStageGrid
            songs={portfolioSongs}
            isSignedIn={Boolean(user)}
          />
        </section>

        <section
          id="guided-demo"
          className="card"
          style={{
            border: "1px solid rgba(220, 182, 92, 0.48)",
            background:
              "radial-gradient(circle at top right, rgba(151, 106, 40, 0.16), transparent 34%), linear-gradient(145deg, rgba(151, 106, 40, 0.12), rgba(255,255,255,0.025))",
          }}
        >
          <div className="eyebrow">Guided demonstration</div>

          <h2
            className="h2 demo-title-one-line"
            style={{
              marginTop: "0.45rem",
              marginBottom: "1rem",
              fontSize: "clamp(1.7rem, 3vw, 2.65rem)",
              lineHeight: 1.04,
            }}
          >
            Follow one song through the full iDreamMusic experience
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: "1rem",
              alignItems: "end",
            }}
          >
            <div>
              <p
                className="copy"
                style={{
                  maxWidth: 900,
                  marginTop: 0,
                }}
              >
                See how “Do You Believe?” moves from a dream fragment into
                capture, Song Intelligence, Muse collaboration, development,
                sharing, and listener response.
              </p>

              <div className="pillRow" style={{ marginTop: "0.8rem" }}>
                {[
                  "Arrival",
                  "Capture",
                  "Intelligence",
                  "Muse collaboration",
                  "Final song",
                  "Listener response",
                ].map((step) => (
                  <span className="pill" key={step}>
                    {step}
                  </span>
                ))}
              </div>
            </div>

            <div className="button-row">
              <Link
                href="/studio/demo/do-you-believe"
                className="button primary"
              >
                Take the Song Journey
              </Link>

              {featuredPortfolioSong ? (
                <Link
                  href={`/studio/songs/${featuredPortfolioSong.slug}/edit`}
                  className="button"
                >
                  Work the Song
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {user ? (
          <section className="card" id="song-portfolio">
            <div className="eyebrow">My creative catalog</div>
            <h2 className="h2">My Song Portfolio</h2>

            <p
              className="copy"
              style={{
                marginTop: "-0.15rem",
                marginBottom: "0.65rem",
                opacity: 0.82,
              }}
            >
              Signed in as {profile?.display_name || user.email}
            </p>

            <p className="copy" style={{ maxWidth: 900 }}>
              Sort and compare your catalog using one consistent Song
              Opportunity Intelligence ranking, along with Muse, stage,
              priorities, AI scores, audience fit, listener ratings, plays,
              versions, and active work.
            </p>

            {portfolioSongs.length ? (
              <>
                {featuredPortfolioSong ? (
                  <FeaturedPortfolioSong
                    song={featuredPortfolioSong}
                  />
                ) : (
                  <div
                    className="card"
                    style={{ marginTop: "1rem" }}
                  >
                    <div className="eyebrow">
                      Featured demonstration song
                    </div>
                    <p className="copy">
                      “Do You Believe?” was not found in the
                      current portfolio. Confirm that its song title
                      contains “Do You Believe”.
                    </p>
                  </div>
                )}

                <StudioPortfolio
                  initialSongs={portfolioSongs}
                />
              </>
            ) : (
              <p className="copy" style={{ marginTop: "1rem" }}>
                You have not uploaded a song yet. Begin with a new song,
                voice memo, lyric, or recording.
              </p>
            )}
          </section>
        ) : (
          <section className="card" id="song-portfolio">
            <div className="eyebrow">Your private workspace</div>
            <h2 className="h2">Sign in to build your song portfolio</h2>
            <p className="copy">
              Capture songs, track versions, run Song Intelligence, work
              with the Muses, and measure listener response in one place.
            </p>

            <div className="button-row">
              <Link
                className="button primary"
                href="/auth/sign-in?next=/studio"
              >
                Sign in
              </Link>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
