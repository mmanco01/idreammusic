import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSparkRecord } from "@/lib/studio/create-spark";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

    const body = (await request.json().catch(() => null)) as
      | {
          title?: string;
          sparkText?: string;
          museSlug?: string;
          notes?: Array<{ title?: string; body?: string }>;
        }
      | null;

    if (!body) {
      return NextResponse.json(
        { status: "error", message: "Spark capture data is missing." },
        { status: 400 },
      );
    }

    const hasContent = Boolean(
      String(body.title || "").trim() ||
        String(body.sparkText || "").trim() ||
        (body.notes || []).some(
          (note) =>
            String(note.title || "").trim() || String(note.body || "").trim(),
        ),
    );

    // File-only capture is valid. The browser uploads its files after this
    // private Spark shell has been created.
    const result = await createSparkRecord(supabase, {
      userId: user.id,
      title: String(body.title || ""),
      sparkText: String(body.sparkText || ""),
      museSlug: String(body.museSlug || "") || undefined,
      notes: body.notes || [],
    });

    return NextResponse.json({
      status: "success",
      message: hasContent
        ? "Your Spark is safe."
        : "Your private Spark shell is ready for its captured files.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "The Spark could not be saved.",
      },
      { status: 500 },
    );
  }
}
