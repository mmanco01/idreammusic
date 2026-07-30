import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ songId: string }> },
) {
  try {
    const { songId } = await context.params;
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

    const { data: ownedSong, error: lookupError } = await (supabase as any)
      .from("songs")
      .select("id, deleted_at")
      .eq("id", songId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (lookupError || !ownedSong) {
      return NextResponse.json(
        {
          status: "error",
          message: lookupError?.message || "Song not found or not owned by you.",
        },
        { status: 404 },
      );
    }

    if (ownedSong.deleted_at) {
      return NextResponse.json({
        status: "success",
        message: "This item is already in Trash.",
      });
    }

    const { error: updateError } = await (supabase as any)
      .from("songs")
      .update({
        status: "private",
        published_at: null,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq("id", songId)
      .eq("owner_user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { status: "error", message: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Moved to Trash.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The item could not be moved to Trash.",
      },
      { status: 500 },
    );
  }
}
