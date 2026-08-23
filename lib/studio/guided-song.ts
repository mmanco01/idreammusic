import { MUSE_OPTIONS } from "@/lib/muses";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LifecyclePhase = "capture" | "craft" | "release";
export type CraftFocus = "explore" | "shape" | "develop" | "refine" | "demo";

export type GuidedTool = {
  label: string;
  href: string;
};

export type GuidedSongPreviewData = {
  id: string;
  slug: string;
  title: string;
  lifecyclePhase: LifecyclePhase;
  craftFocus: CraftFocus | null;
  artifactMaturity: string;
  visibility: string;
  readyToRelease: boolean;
  hasAssignedMuse: boolean;
  museName: string | null;
  museDomain: string | null;
  museSlug: string | null;
  origin: string | null;
  versionCount: number;
  recordingCount: number;
  transcriptCount: number;
  activeTaskCount: number;
  aiOverall: number | null;
  releaseReadiness: number | null;
  plays: number;
  listenerRating: number | null;
  listenerRatingCount: number;
  where: string;
  why: string;
  what: string;
  when: string;
  tools: GuidedTool[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readNumber(value: unknown, key: string): number | null {
  const record = asRecord(value);
  const candidate = record?.[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function displayVisibility(status: string | null | undefined) {
  const value = String(status || "private").toLowerCase();
  if (value === "published") return "Public";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function focusWhy(focus: CraftFocus | null, hasNamedWork: boolean) {
  if (!focus) {
    return "The song is in Craft, but no working focus has been chosen yet.";
  }

  if (focus === "explore") {
    return "The Spark has entered Craft, but the direction is still being discovered.";
  }

  if (focus === "shape") {
    return "The song has a direction, but its identity or structure is still taking form.";
  }

  if (focus === "develop") {
    return "The song has enough shape to develop the lyric, melody, harmony, groove, or arrangement.";
  }

  if (focus === "refine") {
    return hasNamedWork
      ? "A specific piece of work is already named for this Refine pass."
      : "No specific unresolved issue has been named yet.";
  }

  return "The song needs to be heard in representative form so listening can guide the next decision.";
}

function focusFallback(focus: CraftFocus | null, hasRecording: boolean) {
  if (!focus) {
    return "Choose what the song needs now: Explore, Shape, Develop, Refine, or Demo.";
  }

  if (focus === "explore") {
    return "Follow the strongest thread until a direction emerges.";
  }

  if (focus === "shape") {
    return "Name the song's center and establish a working form.";
  }

  if (focus === "develop") {
    return "Develop the weakest or missing part of the song.";
  }

  if (focus === "refine") {
    return "Listen through once and name the single highest-value issue.";
  }

  return hasRecording
    ? "Listen to the current recording and note the one thing that changes your next decision."
    : "Capture or upload a representative recording so you can hear the song as a song.";
}

function focusWhen(focus: CraftFocus | null) {
  if (!focus) {
    return "When you choose the kind of work the song needs now.";
  }

  if (focus === "explore") return "When a direction worth pursuing has emerged.";
  if (focus === "shape") return "When the song has a clear center and working form.";
  if (focus === "develop") return "When a complete working song exists.";
  if (focus === "refine") {
    return "When the issue is resolved — or when you consciously decide it does not need changing.";
  }

  return "When the recording represents the song well enough to judge the next move.";
}

export async function getGuidedSongPreview(
  userId: string,
  slug: string,
): Promise<GuidedSongPreviewData | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const { data: song, error: songError } = await (supabase as any)
    .from("songs")
    .select(`
      id,
      slug,
      title_working,
      title_final,
      current_stage,
      status,
      song_origin,
      muse_id,
      owner_user_id,
      song_versions (
        id,
        version_number,
        stage,
        lyrics,
        is_stage_primary,
        created_at
      ),
      attachments (
        id,
        file_type,
        mime_type
      ),
      song_transcripts (
        id
      )
    `)
    .eq("slug", slug)
    .eq("owner_user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (songError || !song) return null;

  const [
    lifecycleResult,
    workflowResult,
    tasksResult,
    analysisResult,
    engagementResult,
    ratingResult,
  ] = await Promise.all([
    (supabase as any)
      .from("song_lifecycle")
      .select("lifecycle_phase, craft_focus, ready_to_release_at")
      .eq("song_id", song.id)
      .maybeSingle(),

    (supabase as any)
      .from("song_workflow")
      .select("next_action")
      .eq("song_id", song.id)
      .eq("user_id", userId)
      .maybeSingle(),

    (supabase as any)
      .from("song_tasks")
      .select("id, title, status, priority, created_at")
      .eq("song_id", song.id)
      .in("status", ["open", "in_progress"])
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true }),

    (supabase as any)
      .from("ai_analysis_runs")
      .select("raw_result, completed_at, created_at")
      .eq("song_id", song.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    (supabase as any)
      .from("song_engagement_summaries")
      .select("audio_play_count")
      .eq("song_id", song.id)
      .maybeSingle(),

    (supabase as any)
      .from("song_rating_summaries")
      .select("average_rating, rating_count")
      .eq("song_id", song.id)
      .maybeSingle(),
  ]);

  const lifecycle = lifecycleResult.data ?? null;
  const lifecyclePhase = String(
    lifecycle?.lifecycle_phase ||
      (String(song.status || "").toLowerCase() === "published"
        ? "release"
        : String(song.current_stage || "").toLowerCase() === "spark"
          ? "capture"
          : "craft"),
  ) as LifecyclePhase;

  const craftFocus = lifecycle?.craft_focus
    ? (String(lifecycle.craft_focus) as CraftFocus)
    : null;

  let muse: (typeof MUSE_OPTIONS)[number] | null = null;

  if (song.muse_id) {
    const { data: museRow } = await (supabase as any)
      .from("muses")
      .select("slug")
      .eq("id", song.muse_id)
      .maybeSingle();

    if (museRow?.slug) {
      muse =
        MUSE_OPTIONS.find((option) => option.slug === String(museRow.slug)) ??
        null;
    }
  }

  const hasAssignedMuse = Boolean(muse);

  const versions = [...(song.song_versions ?? [])].sort(
    (a: any, b: any) => Number(b.version_number ?? 0) - Number(a.version_number ?? 0),
  );
  const primaryVersion =
    versions.find((version: any) => Boolean(version.is_stage_primary)) ??
    versions[0] ??
    null;

  const recordings = (song.attachments ?? []).filter(
    (attachment: any) =>
      attachment.file_type === "audio" ||
      String(attachment.mime_type || "").startsWith("audio/"),
  );

  const tasks = tasksResult.data ?? [];
  const inProgressTask = tasks.find((task: any) => task.status === "in_progress");
  const openTask = tasks.find((task: any) => task.status === "open");
  const humanNext = String(workflowResult.data?.next_action || "").trim();

  const namedWork =
    humanNext ||
    String(inProgressTask?.title || "").trim() ||
    String(openTask?.title || "").trim();

  let why = "";
  let what = "";
  let when = "";

  if (lifecyclePhase === "capture") {
    why = "This idea is still being protected as a Spark before it is asked to become more.";
    what =
      humanNext ||
      "Preserve enough of the Spark that you will recognize what mattered when you return.";
    when = "When you want to do more than preserve it, bring it into Craft.";
  } else if (lifecyclePhase === "release") {
    why = "This song has entered the world. The work now is to listen to Reception without letting metrics rewrite the song by default.";
    what =
      humanNext ||
      (Number(engagementResult.data?.audio_play_count || 0) > 0
        ? "Review Reception for signal, not instruction."
        : "Let the song live. No action is required unless something meaningful comes back.");
    when =
      "There is no required next stage. Reception may invite a new Craft iteration or inspire a new Capture.";
  } else {
    why = focusWhy(craftFocus, Boolean(namedWork));
    what =
      humanNext ||
      String(inProgressTask?.title || "").trim() ||
      String(openTask?.title || "").trim() ||
      focusFallback(craftFocus, recordings.length > 0);
    when = focusWhen(craftFocus);
  }

  const maturity = String(
    primaryVersion?.stage || song.current_stage || "spark",
  ).toLowerCase();

  const where =
    lifecyclePhase === "craft"
      ? `Craft${craftFocus ? ` · ${craftFocus.charAt(0).toUpperCase() + craftFocus.slice(1)}` : ""} · ${maturity.charAt(0).toUpperCase() + maturity.slice(1)}`
      : `${lifecyclePhase.charAt(0).toUpperCase() + lifecyclePhase.slice(1)} · ${maturity.charAt(0).toUpperCase() + maturity.slice(1)}`;

  const rawAnalysis = analysisResult.data?.raw_result ?? null;
  const aiOverall = readNumber(rawAnalysis, "overall_score");
  const releaseReadiness = readNumber(rawAnalysis, "ready_for_release_score");

  const fullHref = `/studio/songs/${slug}/edit?view=full`;
  const tools: GuidedTool[] = [];
  const hasLyrics = Boolean(primaryVersion?.lyrics?.trim());
  const hasAnalysisEvidence =
    recordings.length > 0 || (song.song_transcripts ?? []).length > 0;

  if (lifecyclePhase === "capture") {
    if (hasLyrics) {
      tools.push({ label: "Open lyrics", href: `${fullHref}#song-details` });
    }

    tools.push(
      hasAssignedMuse
        ? { label: `Talk to ${muse!.name}`, href: `${fullHref}#muses` }
        : { label: "Choose a Muse", href: `${fullHref}#muses` },
    );
  } else if (lifecyclePhase === "craft") {
    if (hasLyrics) {
      tools.push({ label: "Open lyrics", href: `${fullHref}#song-details` });
    }

    tools.push(
      hasAssignedMuse
        ? { label: `Talk to ${muse!.name}`, href: `${fullHref}#muses` }
        : { label: "Choose a Muse", href: `${fullHref}#muses` },
    );

    if (analysisResult.data) {
      tools.push({
        label: "Review Song Intelligence",
        href: `${fullHref}#intelligence`,
      });
    } else if (hasAnalysisEvidence) {
      tools.push({
        label: "Run Song Intelligence",
        href: `${fullHref}#intelligence`,
      });
    }
  } else {

    if (String(song.status || "").toLowerCase() === "published") {
      tools.push({
        label: "View public song",
        href: `/songs/${slug}`,
      });
    }

    if (hasAssignedMuse) {
      tools.push({
        label: `Talk to ${muse!.name}`,
        href: `${fullHref}#muses`,
      });
    }
  }

  return {
    id: String(song.id),
    slug: String(song.slug),
    title:
      String(song.title_final || song.title_working || primaryVersion?.title || "Untitled song"),
    lifecyclePhase,
    craftFocus,
    artifactMaturity:
      maturity.charAt(0).toUpperCase() + maturity.slice(1),
    visibility: displayVisibility(song.status),
    readyToRelease: Boolean(lifecycle?.ready_to_release_at),
    hasAssignedMuse,
    museName: muse?.name ?? null,
    museDomain: muse?.domain ?? null,
    museSlug: muse?.slug ?? null,
    origin: song.song_origin ? String(song.song_origin) : null,
    versionCount: versions.length,
    recordingCount: recordings.length,
    transcriptCount: (song.song_transcripts ?? []).length,
    activeTaskCount: tasks.length,
    aiOverall,
    releaseReadiness,
    plays: Number(engagementResult.data?.audio_play_count || 0),
    listenerRating:
      ratingResult.data?.average_rating === null ||
      ratingResult.data?.average_rating === undefined
        ? null
        : Number(ratingResult.data.average_rating),
    listenerRatingCount: Number(ratingResult.data?.rating_count || 0),
    where,
    why,
    what,
    when,
    tools: tools.slice(0, 3),
  };
}
