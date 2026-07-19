import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getMuseBySlug, MUSE_OPTIONS } from "@/lib/muses";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MuseChatMode = "chat" | "collaborate";

type MuseChatRequest = {
  mode?: unknown;
  museSlug?: unknown;
  message?: unknown;
  songId?: unknown;
  originalQuestion?: unknown;
  primaryMuseSlug?: unknown;
  collaboratorMuseSlug?: unknown;
  primaryResponse?: unknown;
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
  assigned_muse_slug: string | null;
  assigned_muse_name: string | null;
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
      muse_id,
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

  let assignedMuseSlug: string | null = null;
  let assignedMuseName: string | null = null;

  if (data.muse_id) {
    const { data: museRow, error: museError } = await (supabase as any)
      .from("muses")
      .select("slug, name")
      .eq("id", data.muse_id)
      .maybeSingle();

    if (museError) {
      console.error("Unable to load assigned Muse:", museError);
    } else if (museRow) {
      assignedMuseSlug = museRow.slug ?? null;
      assignedMuseName = museRow.name ?? null;
    }
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
    assigned_muse_slug: assignedMuseSlug,
    assigned_muse_name: assignedMuseName,
    versions,
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

    const mode: MuseChatMode =
      body.mode === "collaborate" ? "collaborate" : "chat";

    const songId = cleanString(body.songId, 100);
    const message = cleanString(body.message, 16000);
    const originalQuestion = cleanString(body.originalQuestion, 8000);
    const primaryResponse = cleanString(body.primaryResponse, 24000);
    const primaryMuseSlug = cleanString(body.primaryMuseSlug, 50);

    const requestedMuseSlug =
      mode === "collaborate"
        ? cleanString(body.collaboratorMuseSlug, 50)
        : cleanString(body.museSlug, 50);

    const muse = getMuseBySlug(requestedMuseSlug);

    if (!muse) {
      return NextResponse.json(
        {
          status: "error",
          message: `Unsupported Muse. Available Muses: ${MUSE_OPTIONS.map(
            (option) => option.name,
          ).join(", ")}.`,
        },
        { status: 400 },
      );
    }

    let primaryMuse = null;

    if (mode === "collaborate") {
      primaryMuse = getMuseBySlug(primaryMuseSlug);

      if (!primaryMuse) {
        return NextResponse.json(
          {
            status: "error",
            message: "The primary Muse could not be identified.",
          },
          { status: 400 },
        );
      }

      if (primaryMuse.slug === muse.slug) {
        return NextResponse.json(
          {
            status: "error",
            message: "Choose a different Muse for collaboration.",
          },
          { status: 400 },
        );
      }

      if (!originalQuestion || !primaryResponse) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "The original question and first Muse response are required for collaboration.",
          },
          { status: 400 },
        );
      }
    } else if (!message) {
      return NextResponse.json(
        {
          status: "error",
          message: `Please enter a message for ${muse.name}.`,
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

    const isPrimaryMuse =
      Boolean(song?.assigned_muse_slug) &&
      song?.assigned_muse_slug === muse.slug;

    const context = {
      selectedMuse: {
        slug: muse.slug,
        name: muse.name,
        domain: muse.domain,
        role:
          mode === "collaborate"
            ? "This Muse has been invited to offer a distinct second perspective."
            : isPrimaryMuse
              ? "This is the song's assigned primary Muse."
              : "This Muse has been invited as a specialist collaborator.",
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
            assignedMuse: {
              slug: song.assigned_muse_slug,
              name: song.assigned_muse_name,
            },
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
      knowledge: [],
    };

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const collaborationPrompt =
      mode === "collaborate" && primaryMuse
        ? `
Here is the current iDreamMusic context:

${JSON.stringify(context, null, 2)}

The songwriter originally asked:

${originalQuestion}

${primaryMuse.name}, Muse of ${primaryMuse.domain}, responded:

${primaryResponse}

You are now joining the conversation as ${muse.name}, Muse of ${muse.domain}.

Give a genuinely different and useful second perspective through your own
specialty. Do not simply agree with, summarize, or restate ${primaryMuse.name}.
Point out what your lens notices that ${primaryMuse.name}'s lens may not
emphasize.

When song context is available, ground your observations in that material.
When no song text is available, work only from the question and prior answer.
Never pretend to have heard audio or seen material that is not present.

Use this structure:

1. A brief opening that names the most important thing your Muse notices.
2. Your distinct analysis and practical recommendation.
3. A final heading exactly titled:
   "How my perspective differs from ${primaryMuse.name}"

Under that heading, explain the difference clearly in two to four sentences.
Preserve the songwriter's voice and keep the response focused.
        `.trim()
        : `
Here is the current iDreamMusic context:

${JSON.stringify(context, null, 2)}

The songwriter says:

${message}

Respond as ${muse.name}, Muse of ${muse.domain}. Use the available song
context when relevant. Do not pretend to have heard audio or seen material
that is not present. Preserve the songwriter's voice. Focus on the most
useful next creative step through your own Muse specialty.
        `.trim();

    const response = await openai.responses.create({
      model:
        process.env.OPENAI_MUSE_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-5-mini",
      instructions: muse.systemPrompt,
      input: collaborationPrompt,
      max_output_tokens: 1600,
      store: false,
    });

    const reply = response.output_text?.trim();

    if (!reply) {
      return NextResponse.json(
        {
          status: "error",
          message: `${muse.name} did not return a response.`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: "success",
      mode,
      muse: {
        slug: muse.slug,
        name: muse.name,
        domain: muse.domain,
        isPrimaryMuse,
      },
      primaryMuse:
        mode === "collaborate" && primaryMuse
          ? {
              slug: primaryMuse.slug,
              name: primaryMuse.name,
              domain: primaryMuse.domain,
            }
          : null,
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
            : "The Muse could not respond.",
      },
      { status: 500 },
    );
  }
}
