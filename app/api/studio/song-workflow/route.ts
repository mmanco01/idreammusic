import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PRIORITY_TIERS = ["now", "next", "later", "someday", "archive"] as const;

const WORKFLOW_STATUSES = [
  "unreviewed",
  "active",
  "waiting",
  "completed",
  "archived",
] as const;

type PriorityTier = (typeof PRIORITY_TIERS)[number];
type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

function isPriorityTier(value: string): value is PriorityTier {
  return PRIORITY_TIERS.includes(value as PriorityTier);
}

function isWorkflowStatus(value: string): value is WorkflowStatus {
  return WORKFLOW_STATUSES.includes(value as WorkflowStatus);
}

export async function PATCH(request: Request) {
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

    const formData = await request.formData();
    const songId = String(formData.get("song_id") || "");
    const priorityTierValue = String(formData.get("priority_tier") || "later");
    const workflowStatusValue = String(
      formData.get("workflow_status") || "active",
    );
    const priorityRankText = String(formData.get("priority_rank") || "").trim();
    const personalRatingText = String(
      formData.get("personal_rating") || "",
    ).trim();

    if (!songId) {
      return NextResponse.json(
        { status: "error", message: "A song is required." },
        { status: 400 },
      );
    }

    if (!isPriorityTier(priorityTierValue)) {
      return NextResponse.json(
        { status: "error", message: "The selected priority is invalid." },
        { status: 400 },
      );
    }

    if (!isWorkflowStatus(workflowStatusValue)) {
      return NextResponse.json(
        { status: "error", message: "The workflow status is invalid." },
        { status: 400 },
      );
    }

    const parsedRank = priorityRankText ? Number(priorityRankText) : null;
    if (
      parsedRank !== null &&
      (!Number.isInteger(parsedRank) || parsedRank < 1)
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "Priority rank must be a whole number greater than zero.",
        },
        { status: 400 },
      );
    }

    const parsedPersonalRating = personalRatingText
      ? Number(personalRatingText)
      : null;

    if (
      parsedPersonalRating !== null &&
      (!Number.isFinite(parsedPersonalRating) ||
        parsedPersonalRating < 0 ||
        parsedPersonalRating > 100)
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "My rating must be between 0 and 100.",
        },
        { status: 400 },
      );
    }

    const { data: ownedSong, error: ownedSongError } = await supabase
      .from("songs")
      .select("id")
      .eq("id", songId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (ownedSongError || !ownedSong) {
      return NextResponse.json(
        {
          status: "error",
          message:
            ownedSongError?.message || "Song not found or not owned by you.",
        },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();

    const { data: workflow, error: workflowError } = await supabase
      .from("song_workflow")
      .upsert(
        {
          song_id: songId,
          user_id: user.id,
          priority_tier: priorityTierValue,
          priority_rank: parsedRank,
          workflow_status: workflowStatusValue,
          personal_rating: parsedPersonalRating,
          updated_at: now,
        },
        {
          onConflict: "song_id,user_id",
        },
      )
      .select("priority_tier, priority_rank, workflow_status, personal_rating")
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        {
          status: "error",
          message: `Workflow save failed: ${
            workflowError?.message || "No workflow row was returned."
          }`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Song workflow saved.",
      workflow,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Song workflow save failed.",
      },
      { status: 500 },
    );
  }
}
