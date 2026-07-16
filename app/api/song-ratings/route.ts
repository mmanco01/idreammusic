import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function parseRating(value: unknown): number | null {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

async function getRatingSummary(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  songId: string,
  userId: string | null,
) {
  const { data: summary, error: summaryError } = await supabase
    .from("song_rating_summaries")
    .select("average_rating, rating_count")
    .eq("song_id", songId)
    .maybeSingle();

  if (summaryError) {
    throw new Error(`Rating summary failed: ${summaryError.message}`);
  }

  let myRating: number | null = null;

  if (userId) {
    const { data: ownRating, error: ownRatingError } = await supabase
      .from("song_ratings")
      .select("rating")
      .eq("song_id", songId)
      .eq("user_id", userId)
      .maybeSingle();

    if (ownRatingError) {
      throw new Error(`Your rating lookup failed: ${ownRatingError.message}`);
    }

    myRating = ownRating?.rating ?? null;
  }

  return {
    average_rating:
      summary?.average_rating === null || summary?.average_rating === undefined
        ? null
        : Number(summary.average_rating),
    rating_count: Number(summary?.rating_count || 0),
    my_rating: myRating,
    can_rate: Boolean(userId),
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { status: "error", message: "Supabase is not available." },
        { status: 500 },
      );
    }

    const url = new URL(request.url);
    const songId = url.searchParams.get("song_id") || "";

    if (!songId) {
      return NextResponse.json(
        { status: "error", message: "A song is required." },
        { status: 400 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const summary = await getRatingSummary(supabase, songId, user?.id || null);

    return NextResponse.json({
      status: "success",
      message: "Song rating loaded.",
      ...summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Song rating lookup failed.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { status: "error", message: "Supabase is not available." },
        { status: 500 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "Sign in to rate this song." },
        { status: 401 },
      );
    }

    const payload = (await request.json().catch(() => null)) as {
      song_id?: string;
      rating?: number;
    } | null;

    const songId = String(payload?.song_id || "");
    const rating = parseRating(payload?.rating);

    if (!songId) {
      return NextResponse.json(
        { status: "error", message: "A song is required." },
        { status: 400 },
      );
    }

    if (rating === null) {
      return NextResponse.json(
        { status: "error", message: "Choose a rating from 1 to 5." },
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

    const now = new Date().toISOString();

    const { error: upsertError } = await supabase.from("song_ratings").upsert(
      {
        song_id: songId,
        user_id: user.id,
        rating,
        updated_at: now,
      },
      {
        onConflict: "song_id,user_id",
      },
    );

    if (upsertError) {
      return NextResponse.json(
        {
          status: "error",
          message: `Rating save failed: ${upsertError.message}`,
        },
        { status: 500 },
      );
    }

    const summary = await getRatingSummary(supabase, songId, user.id);

    return NextResponse.json({
      status: "success",
      message: "Your rating was saved.",
      ...summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Song rating save failed.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { status: "error", message: "Supabase is not available." },
        { status: 500 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "You must be signed in." },
        { status: 401 },
      );
    }

    const payload = (await request.json().catch(() => null)) as {
      song_id?: string;
    } | null;

    const songId = String(payload?.song_id || "");

    if (!songId) {
      return NextResponse.json(
        { status: "error", message: "A song is required." },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase
      .from("song_ratings")
      .delete()
      .eq("song_id", songId)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json(
        {
          status: "error",
          message: `Rating removal failed: ${deleteError.message}`,
        },
        { status: 500 },
      );
    }

    const summary = await getRatingSummary(supabase, songId, user.id);

    return NextResponse.json({
      status: "success",
      message: "Your rating was removed.",
      ...summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Song rating removal failed.",
      },
      { status: 500 },
    );
  }
}
