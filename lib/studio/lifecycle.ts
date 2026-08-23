import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import type {
  CraftFocus,
  LifecyclePhase,
  LifecycleSource,
  StudioLifecycleSong,
} from "@/lib/studio/lifecycle-types";

export type {
  CraftFocus,
  LifecyclePhase,
  LifecycleSource,
  StudioLifecycleSong,
} from "@/lib/studio/lifecycle-types";

type SongRow = {
  id: string;
  owner_user_id: string;
  slug: string;
  title_working: string | null;
  title_final: string | null;
  current_stage: string;
  status: string;
  summary: string | null;
  muse_id: string | null;
  published_at: string | null;
  updated_at: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
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

function readNestedNumber(value: unknown, path: string[]): number | null {
  let current: unknown = value;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }
  return typeof current === "number" && Number.isFinite(current)
    ? current
    : null;
}

function inferLifecycle(song: SongRow): LifecyclePhase {
  if (song.status === "published" || song.published_at) return "release";
  if (String(song.current_stage).toLowerCase() === "spark") return "capture";
  return "craft";
}


function chunks<T>(values: T[], size = 100): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    output.push(values.slice(i, i + size));
  }
  return output;
}

type QueryBatchResult<T> = { data: T[]; errors: string[] };

async function fetchSongIdBatches<T>(
  songIds: string[],
  fetchBatch: (ids: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<QueryBatchResult<T>> {
  const data: T[] = [];
  const errors: string[] = [];

  for (const batch of chunks(songIds, 100)) {
    const result = await fetchBatch(batch);
    if (result.error) {
      errors.push(result.error.message);
      continue;
    }
    data.push(...(result.data || []));
  }

  return { data, errors };
}

async function getAllOwnedSongs(userId: string): Promise<SongRow[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const pageSize = 500;
  const rows: SongRow[] = [];

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("songs")
      .select(
        "id, owner_user_id, slug, title_working, title_final, current_stage, status, summary, muse_id, published_at, updated_at",
      )
      .eq("owner_user_id", userId)
      .order("updated_at", { ascending: false })
      .range(start, start + pageSize - 1);

    if (error) {
      console.error("Studio v1 songs query failed:", error.message);
      return rows;
    }

    const page = (data || []) as SongRow[];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
}

export async function getStudioLifecycleSongs(
  userId: string,
): Promise<StudioLifecycleSong[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId) return [];

  const songs = await getAllOwnedSongs(userId);
  if (!songs.length) return [];

  const songIds = songs.map((song) => song.id);
  const museIds = Array.from(
    new Set(songs.map((song) => song.muse_id).filter(Boolean)),
  ) as string[];

  const [
    lifecycleRows,
    workflowRows,
    versionRows,
    taskRows,
    analysisRows,
    engagementRows,
    ratingRows,
    museResult,
  ] = await Promise.all([
    fetchSongIdBatches<any>(songIds, (ids) =>
      supabase
        .from("song_lifecycle")
        .select(
          "song_id, lifecycle_phase, craft_focus, lifecycle_source, ready_to_release_at",
        )
        .in("song_id", ids),
    ),

    fetchSongIdBatches<any>(songIds, (ids) =>
      supabase
        .from("song_workflow")
        .select(
          "song_id, next_action, priority_tier, workflow_status, personal_rating",
        )
        .eq("user_id", userId)
        .in("song_id", ids),
    ),

    fetchSongIdBatches<any>(songIds, (ids) =>
      supabase.from("song_versions").select("song_id").in("song_id", ids),
    ),

    fetchSongIdBatches<any>(songIds, (ids) =>
      supabase
        .from("song_tasks")
        .select("song_id, status")
        .in("song_id", ids),
    ),

    fetchSongIdBatches<any>(songIds, (ids) =>
      supabase
        .from("ai_analysis_runs")
        .select("song_id, raw_result, completed_at, created_at")
        .eq("status", "ready")
        .in("song_id", ids)
        .order("created_at", { ascending: false }),
    ),

    fetchSongIdBatches<any>(songIds, (ids) =>
      supabase
        .from("song_engagement_summaries")
        .select("song_id, audio_play_count")
        .in("song_id", ids),
    ),

    fetchSongIdBatches<any>(songIds, (ids) =>
      supabase
        .from("song_rating_summaries")
        .select("song_id, average_rating, rating_count")
        .in("song_id", ids),
    ),

    museIds.length
      ? supabase.from("muses").select("id, slug").in("id", museIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const [name, result] of [
    ["lifecycle", lifecycleRows],
    ["workflow", workflowRows],
    ["versions", versionRows],
    ["tasks", taskRows],
    ["analysis", analysisRows],
    ["engagement", engagementRows],
    ["ratings", ratingRows],
  ] as const) {
    for (const error of result.errors) {
      console.error(`Studio v1 ${name} query failed:`, error);
    }
  }

  if (museResult.error) {
    console.error("Studio v1 muses query failed:", museResult.error.message);
  }

  const lifecycleBySong = new Map(
    lifecycleRows.data.map((row: any) => [row.song_id, row]),
  );
  const workflowBySong = new Map(
    workflowRows.data.map((row: any) => [row.song_id, row]),
  );
  const museById = new Map(
    (museResult.data || []).map((row: any) => [row.id, row.slug]),
  );

  const versionCount = new Map<string, number>();
  for (const row of versionRows.data) {
    versionCount.set(row.song_id, (versionCount.get(row.song_id) || 0) + 1);
  }

  const tasks = new Map<string, { open: number; inProgress: number }>();
  for (const row of taskRows.data) {
    const current = tasks.get(row.song_id) || { open: 0, inProgress: 0 };
    if (row.status === "open") current.open += 1;
    if (row.status === "in_progress") current.inProgress += 1;
    tasks.set(row.song_id, current);
  }

  const latestAnalysis = new Map<string, any>();
  for (const row of analysisRows.data) {
    if (!latestAnalysis.has(row.song_id)) latestAnalysis.set(row.song_id, row);
  }

  const engagementBySong = new Map(
    engagementRows.data.map((row: any) => [row.song_id, row]),
  );
  const ratingBySong = new Map(
    ratingRows.data.map((row: any) => [row.song_id, row]),
  );

  return songs.map((song) => {
    const lifecycle = lifecycleBySong.get(song.id);
    const workflow = workflowBySong.get(song.id);
    const task = tasks.get(song.id) || { open: 0, inProgress: 0 };
    const analysis = latestAnalysis.get(song.id);
    const rawResult = analysis?.raw_result;
    const engagement = engagementBySong.get(song.id);
    const rating = ratingBySong.get(song.id);

    return {
      id: song.id,
      slug: song.slug,
      title: song.title_final || song.title_working || "Untitled song",
      summary: song.summary,
      current_stage: song.current_stage,
      status: song.status,
      published_at: song.published_at,
      updated_at: song.updated_at,
      muse_slug: song.muse_id ? museById.get(song.muse_id) || null : null,

      // Runtime fallback keeps Studio usable during migration review, but the
      // DB row remains the canonical state once backfill is applied.
      lifecycle_phase:
        (lifecycle?.lifecycle_phase as LifecyclePhase | undefined) ||
        inferLifecycle(song),
      craft_focus: (lifecycle?.craft_focus as CraftFocus | null) ?? null,
      lifecycle_source:
        (lifecycle?.lifecycle_source as LifecycleSource | undefined) ||
        "inferred",
      ready_to_release_at: lifecycle?.ready_to_release_at || null,

      next_action: workflow?.next_action || null,
      priority_tier: workflow?.priority_tier || null,
      workflow_status: workflow?.workflow_status || null,
      personal_rating:
        workflow?.personal_rating === null || workflow?.personal_rating === undefined
          ? null
          : Number(workflow.personal_rating),

      version_count: versionCount.get(song.id) || 0,
      open_task_count: task.open,
      in_progress_task_count: task.inProgress,

      ai_overall_score: analysis ? readNumber(rawResult, "overall_score") : null,
      ai_ready_for_release_score: analysis
        ? readNumber(rawResult, "ready_for_release_score")
        : null,
      ai_audience_score: analysis
        ? readNestedNumber(rawResult, ["audience", "audience_rank_score"])
        : null,

      audio_play_count: Number(engagement?.audio_play_count || 0),
      listener_rating_average:
        rating?.average_rating === null || rating?.average_rating === undefined
          ? null
          : Number(rating.average_rating),
      listener_rating_count: Number(rating?.rating_count || 0),
    };
  });
}
