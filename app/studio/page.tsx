import Link from "next/link";
import { getServerAuthContext } from "@/lib/auth";
import { getMySongs } from "@/lib/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import StudioPortfolio, {
  type StudioPortfolioSong,
} from "@/components/studio/StudioPortfolio";
import { FeaturedDemoCard } from "@/components/studio/FeaturedDemoCard";

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
      final_version_count: 0,
      all_versions_final: false,
      is_finished: false,
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
  const engagementSummaries = (engagementResult.data || []) as EngagementSummaryRow[];
  const listenerRatingSummaries = (listenerRatingsResult.data ||
    []) as ListenerRatingSummaryRow[];

  const versionSummary = new Map<
    string,
    {
      total: number;
      final: number;
    }
  >();

  for (const version of versions) {
    const current = versionSummary.get(version.song_id) || {
      total: 0,
      final: 0,
    };

    current.total += 1;

    if (String(version.stage || "").toLowerCase() === "final") {
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

    const allVersionsFinal = version.total > 0 && version.final === version.total;
    const workflowStatus = workflow?.workflow_status || "active";

    const isFinished =
      allVersionsFinal ||
      workflowStatus === "completed" ||
      workflowStatus === "archived";

    return {
      ...normalizeStudioSong(song),
      version_count: version.total,
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
        ? readNestedStringArray(rawResult, ["audience", "sync_opportunities"])
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

export default async function StudioPage() {
  const { user, profile } = await getServerAuthContext();
  const mySongs = user ? await getMySongs(user.id) : [];
  const portfolioSongs = user
    ? await buildStudioPortfolio(user.id, mySongs)
    : [];

  return (
    <section className="section">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Creator Studio</div>
            <h1 className="h2">Songcatcher Studio</h1>
            <p className="copy" style={{ maxWidth: 820 }}>
              Capture ideas, develop songs with AI guidance, measure real listener
              response, and use Song Opportunity Intelligence to decide what
              deserves your time and attention next.
            </p>
          </div>

          {!user ? (
            <Link className="button primary" href="/auth/sign-in?next=/studio">
              Sign in to upload
            </Link>
          ) : (
            <Link className="button primary" href="/studio/capture">
              New song or recording
            </Link>
          )}
        </div>

        <div className="stage-grid">
          <div className="stage-card">
            <h3 className="h3">Capture</h3>
            <p className="copy">
              Upload a spark, draft, final cut, lyric sheet, or voice memo and
              connect it to the right Muse.
            </p>
            <Link className="button" href="/studio/capture">
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

          <div className="stage-card">
            <h3 className="h3">Review &amp; Prioritize</h3>
            <p className="copy">
              Compare Opportunity Scores, human ratings, listener engagement,
              development stage, AI analysis, and release readiness—then decide
              what deserves attention next.
            </p>
            <Link className="button" href="/admin/review">
              Review songs
            </Link>
          </div>
        </div>

        <FeaturedDemoCard />

        {user ? (
          <div className="card" id="song-portfolio">
            <div className="eyebrow">Signed in as</div>
            <h2 className="h3">{profile?.display_name || user.email}</h2>
            <p className="copy">
              Your catalog ranked by explainable Song Opportunity Intelligence,
              with priorities, AI scores, audience fit, listener ratings, plays,
              versions, and development workload in one place.
            </p>

            {portfolioSongs.length ? (
              <StudioPortfolio initialSongs={portfolioSongs} />
            ) : (
              <p className="copy" style={{ marginTop: "1rem" }}>
                You have not uploaded a song yet. Start at the capture page or
                any Muse page.
              </p>
            )}
          </div>
        ) : (
          <div className="card" id="song-portfolio">
            <h2 className="h3">Not signed in yet</h2>
            <p className="copy">
              Sign in first, then use the Muse pages as direct upload entry
              points for your songs.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
