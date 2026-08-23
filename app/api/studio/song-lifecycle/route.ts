import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PHASES = new Set(["capture", "craft", "release"]);
const FOCI = new Set(["explore", "shape", "develop", "refine", "demo"]);

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { status: "error", message: "Supabase is unavailable." },
      { status: 503 },
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

  const body = (await request.json().catch(() => null)) as
    | {
        song_id?: string;
        lifecycle_phase?: string | null;
        craft_focus?: string | null;
        ready_to_release?: boolean;
      }
    | null;

  const songId = body?.song_id?.trim();
  if (!songId) {
    return NextResponse.json(
      { status: "error", message: "song_id is required." },
      { status: 400 },
    );
  }

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("id, owner_user_id, current_stage, status, published_at")
    .eq("id", songId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (songError || !song) {
    return NextResponse.json(
      { status: "error", message: "Song not found or not owned by you." },
      { status: 404 },
    );
  }

  const { data: current } = await supabase
    .from("song_lifecycle")
    .select(
      "lifecycle_phase, craft_focus, lifecycle_source, ready_to_release_at",
    )
    .eq("song_id", songId)
    .maybeSingle();

  let nextPhase =
    body?.lifecycle_phase === undefined || body.lifecycle_phase === null
      ? current?.lifecycle_phase ||
        (song.status === "published" || song.published_at
          ? "release"
          : String(song.current_stage).toLowerCase() === "spark"
            ? "capture"
            : "craft")
      : body.lifecycle_phase;

  if (!PHASES.has(nextPhase)) {
    return NextResponse.json(
      { status: "error", message: "Invalid lifecycle phase." },
      { status: 400 },
    );
  }

  // Release means intentionally entered the world. Do not let the Studio
  // claim Release unless there is existing publication evidence.
  if (
    nextPhase === "release" &&
    song.status !== "published" &&
    !song.published_at
  ) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "A song can enter Release only after it has been published/shared through the existing release flow.",
      },
      { status: 409 },
    );
  }

  let nextFocus: string | null =
    body?.craft_focus === undefined
      ? current?.craft_focus || null
      : body.craft_focus;

  if (nextFocus !== null && !FOCI.has(nextFocus)) {
    return NextResponse.json(
      { status: "error", message: "Invalid Craft focus." },
      { status: 400 },
    );
  }

  if (nextPhase !== "craft") nextFocus = null;

  const enteringCraft =
    body?.lifecycle_phase === "craft" && current?.lifecycle_phase !== "craft";

  const readyAt =
    body?.ready_to_release === undefined
      ? enteringCraft
        ? null
        : current?.ready_to_release_at || null
      : body.ready_to_release
        ? new Date().toISOString()
        : null;

  const payload = {
    song_id: songId,
    lifecycle_phase: nextPhase,
    craft_focus: nextFocus,
    lifecycle_source: "manual",
    ready_to_release_at: readyAt,
    ready_to_release_by: readyAt ? user.id : null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error: saveError } = await supabase
    .from("song_lifecycle")
    .upsert(payload, { onConflict: "song_id" })
    .select(
      "song_id, lifecycle_phase, craft_focus, lifecycle_source, ready_to_release_at",
    )
    .single();

  if (saveError || !saved) {
    return NextResponse.json(
      {
        status: "error",
        message: saveError?.message || "Could not save lifecycle state.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "success", lifecycle: saved });
}
