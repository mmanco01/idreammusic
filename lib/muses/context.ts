import type { MuseIdentity } from "@/lib/muses/types";

type BuildMuseContextArgs = {
  supabase: any;
  userId: string;
  songId: string;
  conversationId: string;
  muse: MuseIdentity;
  role: "primary" | "specialist" | "collaborator";
};

function sortVersions(versions: any[]): any[] {
  return [...versions].sort((a, b) => {
    if (a.is_stage_primary && !b.is_stage_primary) return -1;
    if (!a.is_stage_primary && b.is_stage_primary) return 1;
    return Number(b.version_number ?? 0) - Number(a.version_number ?? 0);
  });
}

function compareSnapshots(
  previousContext: any,
  current: {
    currentVersion: any;
    latestTranscript: any;
    latestAnalysis: any;
    openTasks: any[];
  },
): string[] {
  if (!previousContext) {
    return ["This is the first saved context snapshot for this Muse conversation."];
  }

  const changes: string[] = [];
  const previousVersion = previousContext.currentVersion ?? null;
  const previousTranscript = previousContext.latestTranscript ?? null;
  const previousAnalysis = previousContext.latestAnalysis ?? null;
  const previousOpenTasks = Array.isArray(previousContext.openTasks)
    ? previousContext.openTasks
    : [];

  if (previousVersion?.id !== current.currentVersion?.id) {
    changes.push(
      current.currentVersion
        ? `The active song version changed to Version ${current.currentVersion.versionNumber ?? "?"}.`
        : "The previously active song version is no longer present.",
    );
  } else if (previousVersion?.lyrics !== current.currentVersion?.lyrics) {
    changes.push("The lyrics changed within the active version.");
  }

  if (previousVersion?.stage !== current.currentVersion?.stage) {
    changes.push(
      `The active stage changed from ${previousVersion?.stage ?? "unknown"} to ${current.currentVersion?.stage ?? "unknown"}.`,
    );
  }

  if (previousTranscript?.id !== current.latestTranscript?.id) {
    changes.push(
      current.latestTranscript
        ? "A different transcript is now the latest transcript."
        : "The previous transcript is no longer available.",
    );
  } else if (previousTranscript?.text !== current.latestTranscript?.text) {
    changes.push("The current transcript was edited or reviewed.");
  }

  if (previousAnalysis?.id !== current.latestAnalysis?.id) {
    changes.push(
      current.latestAnalysis
        ? "A newer Song Intelligence analysis is available."
        : "The previous Song Intelligence analysis is no longer available.",
    );
  }

  const previousTaskIds = new Set(previousOpenTasks.map((task: any) => task.id));
  const currentTaskIds = new Set(current.openTasks.map((task: any) => task.id));

  const newTaskCount = [...currentTaskIds].filter(
    (id) => !previousTaskIds.has(id),
  ).length;
  const closedTaskCount = [...previousTaskIds].filter(
    (id) => !currentTaskIds.has(id),
  ).length;

  if (newTaskCount > 0) {
    changes.push(
      `${newTaskCount} new open development ${newTaskCount === 1 ? "task is" : "tasks are"} present.`,
    );
  }

  if (closedTaskCount > 0) {
    changes.push(
      `${closedTaskCount} previously open ${closedTaskCount === 1 ? "task is" : "tasks are"} no longer open.`,
    );
  }

  if (!changes.length) {
    changes.push(
      "No material song-state changes were detected since the previous saved context.",
    );
  }

  return changes;
}

export async function buildMuseContext({
  supabase,
  userId,
  songId,
  conversationId,
  muse,
  role,
}: BuildMuseContextArgs) {
  const { data: song, error: songError } = await supabase
    .from("songs")
    .select(`
      id,
      slug,
      title_working,
      title_final,
      summary,
      hook_line,
      current_stage,
      status,
      song_origin,
      songwriter_name,
      genre,
      owner_user_id,
      muse_id,
      song_versions (
        id,
        version_number,
        stage,
        title,
        lyrics,
        chord_chart,
        melody_notes,
        arrangement_notes,
        story_behind_song,
        visibility,
        is_stage_primary,
        created_at
      )
    `)
    .eq("id", songId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (songError) {
    throw new Error(`Could not load the song: ${songError.message}`);
  }

  if (!song) return null;

  let assignedMuse: { slug: string | null; name: string | null } = {
    slug: null,
    name: null,
  };

  if (song.muse_id) {
    const { data: museRow } = await supabase
      .from("muses")
      .select("slug, name")
      .eq("id", song.muse_id)
      .maybeSingle();

    if (museRow) {
      assignedMuse = {
        slug: museRow.slug ?? null,
        name: museRow.name ?? null,
      };
    }
  }

  const versions = sortVersions(
    Array.isArray(song.song_versions) ? song.song_versions : [],
  );
  const currentVersion =
    versions.find((version) => version.is_stage_primary) ?? versions[0] ?? null;

  const [
    transcriptResult,
    analysisResult,
    taskResult,
    memoryResult,
    decisionResult,
    questionResult,
    messageResult,
    previousSnapshotResult,
    diagnosticResult,
  ] = await Promise.all([
    supabase
      .from("song_transcripts")
      .select(
        "id, song_version_id, attachment_id, transcript_text, transcript_source, language_code, transcription_model, is_reviewed, reviewed_at, updated_at, created_at",
      )
      .eq("song_id", songId)
      .order("updated_at", { ascending: false })
      .limit(8),

    supabase
      .from("ai_analysis_runs")
      .select(
        "id, song_version_id, transcript_id, model_name, analysis_version, status, audience_rank_score, audience_tier, suggested_phase, strengths, work_needed, summary, raw_result, completed_at, created_at",
      )
      .eq("song_id", songId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("song_tasks")
      .select(
        "id, song_version_id, analysis_run_id, title, description, status, priority, due_date, completed_at, created_at, updated_at",
      )
      .eq("song_id", songId)
      .in("status", ["open", "in_progress"])
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(12),

    supabase
      .from("muse_memories")
      .select(
        "id, muse_slug, memory_type, content, reason, importance, confidence, status, created_at",
      )
      .eq("owner_user_id", userId)
      .eq("song_id", songId)
      .eq("status", "accepted")
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("muse_creative_decisions")
      .select(
        "id, muse_slug, decision_type, decision_text, reason, rejected_alternative, rejection_reason, status, decided_at, created_at",
      )
      .eq("owner_user_id", userId)
      .eq("song_id", songId)
      .in("status", ["accepted", "rejected"])
      .order("created_at", { ascending: false })
      .limit(15),

    supabase
      .from("muse_unresolved_questions")
      .select("id, muse_slug, question, priority, status, created_at")
      .eq("owner_user_id", userId)
      .eq("song_id", songId)
      .eq("status", "open")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),

    supabase
      .from("muse_messages")
      .select(
        "id, role, kind, muse_slug, content, question_text, comparison_with, created_at",
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(16),

    supabase
      .from("muse_context_snapshots")
      .select("context_json, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("muse_diagnostic_findings")
      .select(
        "diagnostic_key, diagnostic_label, score, finding, evidence, confidence, change_direction, created_at",
      )
      .eq("owner_user_id", userId)
      .eq("song_id", songId)
      .eq("muse_slug", muse.slug)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const transcripts = transcriptResult.data ?? [];
  const analyses = analysisResult.data ?? [];

  const latestTranscript =
    transcripts.find(
      (transcript: any) =>
        currentVersion && transcript.song_version_id === currentVersion.id,
    ) ??
    transcripts[0] ??
    null;

  const latestAnalysis =
    analyses.find(
      (analysis: any) =>
        currentVersion && analysis.song_version_id === currentVersion.id,
    ) ??
    analyses[0] ??
    null;

  const normalizedCurrentVersion = currentVersion
    ? {
        id: currentVersion.id,
        versionNumber: currentVersion.version_number,
        stage: currentVersion.stage,
        title: currentVersion.title,
        lyrics: currentVersion.lyrics,
        chordChart: currentVersion.chord_chart,
        melodyNotes: currentVersion.melody_notes,
        arrangementNotes: currentVersion.arrangement_notes,
        storyBehindSong: currentVersion.story_behind_song,
        visibility: currentVersion.visibility,
        isPrimary: currentVersion.is_stage_primary,
        createdAt: currentVersion.created_at,
      }
    : null;

  const normalizedTranscript = latestTranscript
    ? {
        id: latestTranscript.id,
        songVersionId: latestTranscript.song_version_id,
        text: latestTranscript.transcript_text,
        source: latestTranscript.transcript_source,
        languageCode: latestTranscript.language_code,
        model: latestTranscript.transcription_model,
        isReviewed: latestTranscript.is_reviewed,
        reviewedAt: latestTranscript.reviewed_at,
        updatedAt: latestTranscript.updated_at,
      }
    : null;

  const normalizedAnalysis = latestAnalysis
    ? {
        id: latestAnalysis.id,
        songVersionId: latestAnalysis.song_version_id,
        transcriptId: latestAnalysis.transcript_id,
        modelName: latestAnalysis.model_name,
        analysisVersion: latestAnalysis.analysis_version,
        audienceRankScore: latestAnalysis.audience_rank_score,
        audienceTier: latestAnalysis.audience_tier,
        suggestedPhase: latestAnalysis.suggested_phase,
        strengths: latestAnalysis.strengths,
        workNeeded: latestAnalysis.work_needed,
        summary: latestAnalysis.summary,
        rawResult: latestAnalysis.raw_result,
        completedAt: latestAnalysis.completed_at,
      }
    : null;

  const openTasks = (taskResult.data ?? []).map((task: any) => ({
    id: task.id,
    songVersionId: task.song_version_id,
    analysisRunId: task.analysis_run_id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.due_date,
  }));

  const previousContext = previousSnapshotResult.data?.context_json ?? null;
  const changesSinceLastSession = compareSnapshots(previousContext, {
    currentVersion: normalizedCurrentVersion,
    latestTranscript: normalizedTranscript,
    latestAnalysis: normalizedAnalysis,
    openTasks,
  });

  const previousDiagnosticsByKey = new Map<string, any>();

  for (const finding of diagnosticResult.data ?? []) {
    if (!previousDiagnosticsByKey.has(finding.diagnostic_key)) {
      previousDiagnosticsByKey.set(finding.diagnostic_key, {
        key: finding.diagnostic_key,
        label: finding.diagnostic_label,
        score: finding.score,
        finding: finding.finding,
        evidence: finding.evidence,
        confidence: finding.confidence,
        changeDirection: finding.change_direction,
        createdAt: finding.created_at,
      });
    }
  }

  return {
    selectedMuse: {
      slug: muse.slug,
      name: muse.name,
      domain: muse.domain,
      role,
    },
    song: {
      id: song.id,
      slug: song.slug,
      title: song.title_final || song.title_working || "Untitled song",
      workingTitle: song.title_working,
      finalTitle: song.title_final,
      summary: song.summary,
      hookLine: song.hook_line,
      currentStage: song.current_stage,
      status: song.status,
      origin: song.song_origin,
      songwriterName: song.songwriter_name,
      genre: song.genre,
      assignedMuse,
    },
    currentVersion: normalizedCurrentVersion,
    earlierVersions: versions
      .filter((version) => version.id !== currentVersion?.id)
      .slice(0, 5)
      .map((version) => ({
        id: version.id,
        versionNumber: version.version_number,
        stage: version.stage,
        title: version.title,
        lyrics: version.lyrics,
        arrangementNotes: version.arrangement_notes,
        storyBehindSong: version.story_behind_song,
        createdAt: version.created_at,
      })),
    latestTranscript: normalizedTranscript,
    latestAnalysis: normalizedAnalysis,
    openTasks,
    acceptedMemories: memoryResult.data ?? [],
    recordedDecisions: decisionResult.data ?? [],
    unresolvedQuestions: questionResult.data ?? [],
    recentConversation: [...(messageResult.data ?? [])].reverse(),
    changesSinceLastSession,
    previousDiagnostics: Array.from(
      previousDiagnosticsByKey.values(),
    ),
    knowledge: [],
  };
}

export async function saveMuseContextSnapshot({
  supabase,
  userId,
  conversationId,
  museSlug,
  context,
}: {
  supabase: any;
  userId: string;
  conversationId: string;
  museSlug: string;
  context: any;
}) {
  const { error } = await supabase.from("muse_context_snapshots").insert({
    conversation_id: conversationId,
    owner_user_id: userId,
    song_id: context.song?.id ?? null,
    song_version_id: context.currentVersion?.id ?? null,
    transcript_id: context.latestTranscript?.id ?? null,
    analysis_run_id: context.latestAnalysis?.id ?? null,
    muse_slug: museSlug,
    context_json: context,
  });

  if (error) {
    console.error("Unable to save Muse context snapshot:", error.message);
  }
}
