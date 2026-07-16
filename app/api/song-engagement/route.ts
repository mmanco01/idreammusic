import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EVENT_TYPES = ["audio_play", "video_click"] as const;
type EngagementEventType = (typeof EVENT_TYPES)[number];

function isEngagementEventType(value: string): value is EngagementEventType {
  return EVENT_TYPES.includes(value as EngagementEventType);
}

function cleanOptionalText(value: unknown, maxLength: number) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { status: "error", message: "Supabase is not available." },
        { status: 500 },
      );
    }

    const payload = (await request.json().catch(() => null)) as {
      song_id?: string;
      song_version_id?: string;
      attachment_id?: string;
      event_type?: string;
      anonymous_session_id?: string;
      event_key?: string;
      source_page?: string;
      target_url?: string;
    } | null;

    if (!payload) {
      return NextResponse.json(
        { status: "error", message: "A valid engagement event is required." },
        { status: 400 },
      );
    }

    const songId = String(payload.song_id || "");
    const songVersionId = String(payload.song_version_id || "");
    const attachmentId = String(payload.attachment_id || "");
    const eventType = String(payload.event_type || "");
    const anonymousSessionId = cleanOptionalText(
      payload.anonymous_session_id,
      200,
    );
    const eventKey = String(payload.event_key || "")
      .trim()
      .slice(0, 500);
    const sourcePage = cleanOptionalText(payload.source_page, 200);
    const targetUrl = cleanOptionalText(payload.target_url, 2000);

    if (!songId) {
      return NextResponse.json(
        { status: "error", message: "A song is required." },
        { status: 400 },
      );
    }

    if (!isEngagementEventType(eventType)) {
      return NextResponse.json(
        { status: "error", message: "The engagement event type is invalid." },
        { status: 400 },
      );
    }

    if (eventKey.length < 8) {
      return NextResponse.json(
        { status: "error", message: "A valid event key is required." },
        { status: 400 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !anonymousSessionId) {
      return NextResponse.json(
        {
          status: "error",
          message: "An anonymous session identifier is required.",
        },
        { status: 400 },
      );
    }

    const { data: song, error: songError } = await supabase
      .from("songs")
      .select("id")
      .eq("id", songId)
      .maybeSingle();

    if (songError || !song) {
      return NextResponse.json(
        {
          status: "error",
          message: songError?.message || "Song not found.",
        },
        { status: 404 },
      );
    }

    if (songVersionId) {
      const { data: version, error: versionError } = await supabase
        .from("song_versions")
        .select("id")
        .eq("id", songVersionId)
        .eq("song_id", songId)
        .maybeSingle();

      if (versionError || !version) {
        return NextResponse.json(
          {
            status: "error",
            message:
              versionError?.message ||
              "Song version was not found for this song.",
          },
          { status: 400 },
        );
      }
    }

    if (attachmentId) {
      const { data: attachment, error: attachmentError } = await supabase
        .from("attachments")
        .select("id")
        .eq("id", attachmentId)
        .eq("song_id", songId)
        .maybeSingle();

      if (attachmentError || !attachment) {
        return NextResponse.json(
          {
            status: "error",
            message:
              attachmentError?.message ||
              "Attachment was not found for this song.",
          },
          { status: 400 },
        );
      }
    }

    const { error: insertError } = await supabase
      .from("song_engagement_events")
      .upsert(
        {
          song_id: songId,
          song_version_id: songVersionId || null,
          attachment_id: attachmentId || null,
          event_type: eventType,
          user_id: user?.id || null,
          anonymous_session_id: user ? null : anonymousSessionId,
          event_key: eventKey,
          source_page: sourcePage,
          target_url: targetUrl,
        },
        {
          onConflict: "event_key",
          ignoreDuplicates: true,
        },
      );

    if (insertError) {
      return NextResponse.json(
        {
          status: "error",
          message: `Engagement tracking failed: ${insertError.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Engagement recorded or already counted for this session.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Engagement tracking failed.",
      },
      { status: 500 },
    );
  }
}
