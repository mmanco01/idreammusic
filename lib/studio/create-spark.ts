type SparkNoteInput = {
  title?: string;
  body?: string;
};

type CreateSparkInput = {
  userId: string;
  title: string;
  sparkText?: string;
  museSlug?: string;
  notes?: SparkNoteInput[];
};

type CreateSparkResult = {
  songId: string;
  songSlug: string;
  versionId: string;
  museSlug: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function fallbackSparkTitle() {
  return `Untitled Spark — ${new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  })}`;
}

export async function createSparkRecord(
  supabase: any,
  input: CreateSparkInput,
): Promise<CreateSparkResult> {
  const resolvedTitle = input.title.trim() || fallbackSparkTitle();
  const sparkText = String(input.sparkText || "").trim();
  const notes = (input.notes || []).filter(
    (note) => String(note.title || "").trim() || String(note.body || "").trim(),
  );
  const firstNoteText = notes.find((note) => String(note.body || "").trim())
    ?.body;
  const summarySource = sparkText || String(firstNoteText || "").trim();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", input.userId)
    .maybeSingle();

  if (profileError) {
    console.warn("Unable to load creator profile during Spark creation:", profileError.message);
  }

  let museId: string | null = null;
  let resolvedMuseSlug = "unassigned";

  if (input.museSlug) {
    const { data: muse, error: museError } = await supabase
      .from("muses")
      .select("id, slug")
      .eq("slug", input.museSlug)
      .maybeSingle();

    if (museError || !muse) {
      throw museError || new Error("The selected Muse could not be found.");
    }

    museId = muse.id;
    resolvedMuseSlug = muse.slug;
  }

  const uniqueSlug = `${slugify(resolvedTitle) || "untitled-spark"}-${Date.now().toString(36)}`;
  let songId: string | null = null;

  try {
    const { data: song, error: songError } = await supabase
      .from("songs")
      .insert({
        owner_user_id: input.userId,
        title_working: resolvedTitle,
        title_final: null,
        slug: uniqueSlug,
        current_stage: "spark",
        status: "private",
        songwriter_name: profile?.display_name?.trim() || null,
        muse_id: museId,
        summary: summarySource.slice(0, 500) || null,
        hook_line: null,
        published_at: null,
      })
      .select("id, slug")
      .single();

    if (songError || !song) {
      throw songError || new Error("Could not create the Spark record.");
    }

    songId = song.id;

    const { error: stageError } = await supabase.from("song_stages").insert({
      song_id: song.id,
      stage: "spark",
      is_current: true,
    });

    if (stageError) throw stageError;

    const { data: version, error: versionError } = await supabase
      .from("song_versions")
      .insert({
        song_id: song.id,
        version_number: 1,
        stage: "spark",
        title: resolvedTitle,
        lyrics: sparkText || null,
        visibility: "private",
        is_stage_primary: true,
        arrangement_notes: null,
        created_by: input.userId,
      })
      .select("id")
      .single();

    if (versionError || !version) {
      throw versionError || new Error("Could not create the first Spark version.");
    }

    const noteRows = notes.map((note, index) => ({
      song_id: song.id,
      song_version_id: version.id,
      author_user_id: input.userId,
      title: String(note.title || "").trim() || `Capture note ${index + 1}`,
      body:
        String(note.body || "").trim() || String(note.title || "").trim(),
      visibility: "private",
    }));

    if (noteRows.length) {
      const { error: notesError } = await supabase
        .from("writer_notes")
        .insert(noteRows);

      if (notesError) throw notesError;
    }

    return {
      songId: song.id,
      songSlug: song.slug,
      versionId: version.id,
      museSlug: resolvedMuseSlug,
    };
  } catch (error) {
    if (songId) {
      await supabase.from("songs").delete().eq("id", songId).eq("owner_user_id", input.userId);
    }

    throw error;
  }
}
