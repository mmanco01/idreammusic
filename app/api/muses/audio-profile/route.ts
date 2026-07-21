import { createHash } from "node:crypto";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  MUSE_AUDIO_ANALYSIS_VERSION,
  analyzeAudioBuffer,
  downloadAudio,
  resolveAudioSource,
} from "@/lib/muses/audio-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function cleanString(
  value: unknown,
  maxLength: number,
) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

async function getAuthContext() {
  const supabase =
    await createServerSupabaseClient();

  if (!supabase) {
    throw new Error(
      "Supabase is not available.",
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "Please sign in to use the Audio Bridge.",
    );
  }

  return {
    supabase,
    user,
  };
}

async function getCurrentVersion({
  supabase,
  userId,
  songId,
}: {
  supabase: any;
  userId: string;
  songId: string;
}) {
  const { data: song, error } =
    await supabase
      .from("songs")
      .select(`
        id,
        title_working,
        title_final,
        owner_user_id,
        song_versions (
          id,
          version_number,
          is_stage_primary,
          lyrics,
          arrangement_notes,
          created_at
        )
      `)
      .eq("id", songId)
      .eq("owner_user_id", userId)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load the song: ${error.message}`,
    );
  }

  if (!song) {
    throw new Error(
      "The song was not found or does not belong to you.",
    );
  }

  const versions = Array.isArray(
    song.song_versions,
  )
    ? [...song.song_versions].sort(
        (a: any, b: any) => {
          if (
            a.is_stage_primary &&
            !b.is_stage_primary
          ) {
            return -1;
          }

          if (
            !a.is_stage_primary &&
            b.is_stage_primary
          ) {
            return 1;
          }

          return (
            Number(
              b.version_number ?? 0,
            ) -
            Number(
              a.version_number ?? 0,
            )
          );
        },
      )
    : [];

  const currentVersion =
    versions[0] ?? null;

  if (!currentVersion) {
    throw new Error(
      "This song has no current version.",
    );
  }

  return {
    song,
    currentVersion,
  };
}

function serializeProfile(row: any) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    songId: row.song_id,
    songVersionId:
      row.song_version_id,
    attachmentId:
      row.attachment_id,
    analysisVersion:
      row.analysis_version,
    modelName: row.model_name,
    sourceFilename:
      row.source_filename,
    sourceMimeType:
      row.source_mime_type,
    sourceFormat:
      row.source_format,
    sourceBytes:
      row.source_bytes,
    profile:
      row.profile_json ?? null,
    errorMessage:
      row.error_message ?? null,
    startedAt:
      row.started_at ?? null,
    completedAt:
      row.completed_at ?? null,
    createdAt:
      row.created_at,
    updatedAt:
      row.updated_at,
  };
}

export async function GET(
  request: Request,
) {
  try {
    const url = new URL(request.url);
    const songId = cleanString(
      url.searchParams.get("songId"),
      100,
    );

    if (!songId) {
      return NextResponse.json(
        {
          status: "error",
          message: "songId is required.",
        },
        { status: 400 },
      );
    }

    const { supabase, user } =
      await getAuthContext();

    const { currentVersion } =
      await getCurrentVersion({
        supabase,
        userId: user.id,
        songId,
      });

    const { data, error } =
      await supabase
        .from("muse_audio_profiles")
        .select("*")
        .eq(
          "owner_user_id",
          user.id,
        )
        .eq("song_id", songId)
        .eq(
          "song_version_id",
          currentVersion.id,
        )
        .eq(
          "analysis_version",
          MUSE_AUDIO_ANALYSIS_VERSION,
        )
        .order("updated_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (error) {
      if (
        error.message
          .toLowerCase()
          .includes(
            "muse_audio_profiles",
          )
      ) {
        throw new Error(
          "The Audio Bridge database migration has not been installed.",
        );
      }

      throw new Error(error.message);
    }

    return NextResponse.json({
      status: "success",
      profile: serializeProfile(data),
      currentSongVersionId:
        currentVersion.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The Audio Bridge status could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
) {
  let profileRowId = "";

  try {
    const body = (await request
      .json()
      .catch(() => null)) as
      | {
          songId?: unknown;
          attachmentId?: unknown;
          force?: unknown;
        }
      | null;

    const songId = cleanString(
      body?.songId,
      100,
    );
    const attachmentId = cleanString(
      body?.attachmentId,
      100,
    );
    const force =
      body?.force === true;

    if (!songId) {
      return NextResponse.json(
        {
          status: "error",
          message: "songId is required.",
        },
        { status: 400 },
      );
    }

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is unavailable inside the Audio Bridge runtime.",
      );
    }

    const { supabase, user } =
      await getAuthContext();

    const { song, currentVersion } =
      await getCurrentVersion({
        supabase,
        userId: user.id,
        songId,
      });

    const source =
      await resolveAudioSource({
        supabase,
        userId: user.id,
        songId,
        attachmentId:
          attachmentId || undefined,
      });

    const { data: existing } =
      await supabase
        .from("muse_audio_profiles")
        .select("*")
        .eq(
          "owner_user_id",
          user.id,
        )
        .eq("song_id", songId)
        .eq(
          "song_version_id",
          source.songVersionId,
        )
        .eq(
          "attachment_id",
          source.attachmentId,
        )
        .eq(
          "analysis_version",
          MUSE_AUDIO_ANALYSIS_VERSION,
        )
        .order("updated_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (
      existing?.status === "ready" &&
      !force
    ) {
      return NextResponse.json({
        status: "success",
        reused: true,
        profile:
          serializeProfile(existing),
      });
    }

    const now =
      new Date().toISOString();
    const model =
      process.env.OPENAI_AUDIO_MODEL ||
      "gpt-audio-1.5";

    const { data: processingRow, error: upsertError } =
      await supabase
        .from("muse_audio_profiles")
        .upsert(
          {
            owner_user_id: user.id,
            song_id: songId,
            song_version_id:
              source.songVersionId,
            attachment_id:
              source.attachmentId,
            status: "processing",
            analysis_version:
              MUSE_AUDIO_ANALYSIS_VERSION,
            model_name: model,
            source_filename:
              source.filename,
            source_mime_type:
              source.mimeType,
            source_format:
              source.format,
            error_message: null,
            started_at: now,
            completed_at: null,
          },
          {
            onConflict:
              "owner_user_id,song_version_id,attachment_id,analysis_version",
          },
        )
        .select("*")
        .single();

    if (
      upsertError ||
      !processingRow
    ) {
      throw new Error(
        upsertError?.message ||
          "The audio profile could not enter processing state.",
      );
    }

    profileRowId =
      processingRow.id;

    const buffer =
      await downloadAudio({
        source,
      });

    const sourceHash =
      createHash("sha256")
        .update(buffer)
        .digest("hex");

    const openai = new OpenAI({
      apiKey,
    });

    const analysis =
      await analyzeAudioBuffer({
        openai,
        model,
        buffer,
        format: source.format,
        songTitle:
          song.title_final ||
          song.title_working ||
          "Untitled song",
        lyrics:
          currentVersion.lyrics,
        arrangementNotes:
          currentVersion
            .arrangement_notes,
      });

    const completedAt =
      new Date().toISOString();

    const { data: readyRow, error: saveError } =
      await supabase
        .from("muse_audio_profiles")
        .update({
          status: "ready",
          model_name: model,
          source_bytes:
            buffer.byteLength,
          source_sha256: sourceHash,
          profile_json:
            analysis.profile,
          raw_model_output:
            analysis.rawModelOutput,
          error_message: null,
          completed_at:
            completedAt,
        })
        .eq("id", profileRowId)
        .eq(
          "owner_user_id",
          user.id,
        )
        .select("*")
        .single();

    if (saveError || !readyRow) {
      throw new Error(
        saveError?.message ||
          "The completed audio profile could not be saved.",
      );
    }

    return NextResponse.json({
      status: "success",
      reused: false,
      profile:
        serializeProfile(readyRow),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Audio analysis failed.";

    if (profileRowId) {
      try {
        const supabase =
          await createServerSupabaseClient();

        if (supabase) {
          await supabase
            .from("muse_audio_profiles")
            .update({
              status: "error",
              error_message: message,
              completed_at:
                new Date().toISOString(),
            })
            .eq("id", profileRowId);
        }
      } catch {
        // Preserve the original error.
      }
    }

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      { status: 500 },
    );
  }
}
