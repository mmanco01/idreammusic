import OpenAI from "openai";
import { NextResponse } from "next/server";
import { calliope } from "@/lib/muses/calliope";
import { calliopeSystemPrompt } from "@/lib/muses/prompts/calliope";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MuseChatRequest = {
  museSlug?: unknown;
  message?: unknown;
  songId?: unknown;
};

type SongVersionContext = {
  id: string;
  version_number: number | null;
  stage: string | null;
  title: string | null;
  lyrics: string | null;
  arrangement_notes: string | null;
  story_behind_song: string | null;
  is_stage_primary: boolean | null;
  created_at: string | null;
};

type SongContext = {
  id: string;
  slug: string;
  title: string;
  title_working: string | null;
  title_final: string | null;
  summary: string | null;
  hook_line: string | null;
  current_stage: string | null;
  versions: SongVersionContext[];
};

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

async function getSongById(
  songId: string,
  userId: string,
): Promise<SongContext | null> {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await (supabase as any)
    .from("songs")
    .select(`
      id,
      slug,
      title_working,
      title_final,
      summary,
      hook_line,
      current_stage,
      owner_user_id,
      song_versions (
        id,
        version_number,
        stage,
        title,
        lyrics,
        arrangement_notes,
        story_behind_song,
        is_stage_primary,
        created_at
      )
    `)
    .eq("id", songId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getSongById error:", error);
    throw new Error(`Could not load the song: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const versions = Array.isArray(data.song_versions)
    ? (data.song_versions as SongVersionContext[])
    : [];

  versions.sort((a, b) => {
    if (a.is_stage_primary && !b.is_stage_primary) return -1;
    if (!a.is_stage_primary && b.is_stage_primary) return 1;

    return (b.version_number ?? 0) - (a.version_number ?? 0);
  });

  return {
    id: data.id,
    slug: data.slug,
    title:
      data.title_final ||
      data.title_working ||
      "Untitled song",
    title_working: data.title_working ?? null,
    title_final: data.title_final ?? null,
    summary: data.summary ?? null,
    hook_line: data.hook_line ?? null,
    current_stage: data.current_stage ?? null,
    versions,
  };
}

function buildMuseContext(song: SongContext | null) {
  return {
    muse: {
      slug: calliope.slug,
      name: calliope.name,
      domain: calliope.domain,
      purpose: calliope.purpose,
      personality: calliope.personality,
      speakingStyle: calliope.speakingStyle,
      songwritingStrengths: calliope.songwritingStrengths,
      evaluationCriteria: calliope.evaluationCriteria,
      questionsSheAsks: calliope.questionsSheAsks,
      boundaries: calliope.boundaries,
    },

    song: song
      ? {
          id: song.id,
          slug: song.slug,
          title: song.title,
          workingTitle: song.title_working,
          finalTitle: song.title_final,
          summary: song.summary,
          hookLine: song.hook_line,
          currentStage: song.current_stage,

          versions: song.versions.slice(0, 6).map((version) => ({
            versionNumber: version.version_number,
            stage: version.stage,
            title: version.title,
            lyrics: version.lyrics,
            arrangementNotes: version.arrangement_notes,
            storyBehindSong: version.story_behind_song,
            isPrimary: version.is_stage_primary,
          })),
        }
      : null,

    /*
     * Muse-specific knowledge retrieval can be added here later.
     * Keeping this as an empty array allows the route to compile
     * before a muse_knowledge table or retrieval service exists.
     */
    knowledge: [],
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          status: "error",
          message: "OPENAI_API_KEY is not configured.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as MuseChatRequest;

    const museSlug = cleanString(body.museSlug, 50).toLowerCase();
    const message = cleanString(body.message, 12000);
    const songId = cleanString(body.songId, 100);

    if (museSlug !== "calliope") {
      return NextResponse.json(
        {
          status: "error",
          message: "Calliope is currently the only supported Muse.",
        },
        { status: 400 },
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          status: "error",
          message: "Please enter a message for Calliope.",
        },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        {
          status: "error",
          message: "Supabase is not available.",
        },
        { status: 500 },
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Muse chat authentication error:", authError);
    }

    /*
     * General Calliope chat may work without a song.
     * Access to private song context requires the song owner to be signed in.
     */
    if (songId && !user) {
      return NextResponse.json(
        {
          status: "error",
          message: "Please sign in before discussing a saved song.",
        },
        { status: 401 },
      );
    }

    const song =
      songId && user
        ? await getSongById(songId, user.id)
        : null;

    if (songId && !song) {
      return NextResponse.json(
        {
          status: "error",
          message: "The song was not found or does not belong to you.",
        },
        { status: 404 },
      );
    }

    const context = buildMuseContext(song);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model:
        process.env.OPENAI_MUSE_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-5-mini",

      instructions: calliopeSystemPrompt,

      input: `
Here is the current iDreamMusic context:

${JSON.stringify(context, null, 2)}

The songwriter says:

${message}

Respond as Calliope. Use the song context when available. Do not pretend
to have heard audio or seen lyrics that are not present. Preserve the
songwriter's voice and focus on the most useful next creative step.
      `.trim(),

      store: false,
    });

    const reply = response.output_text?.trim();

    if (!reply) {
      return NextResponse.json(
        {
          status: "error",
          message: "Calliope did not return a response.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: "success",
      muse: {
        slug: calliope.slug,
        name: calliope.name,
        domain: calliope.domain,
      },
      song: song
        ? {
            id: song.id,
            slug: song.slug,
            title: song.title,
          }
        : null,
      reply,
    });
  } catch (error) {
    console.error("Muse chat route error:", error);

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Calliope could not respond.",
      },
      { status: 500 },
    );
  }
}
