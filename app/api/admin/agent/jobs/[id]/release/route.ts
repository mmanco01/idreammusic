import { NextResponse } from "next/server";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

import { executeApprovedRelease } from "@/lib/agentic/release-execution";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAgentAdmin(request);
    const { id } = await params;
    const supabase = getAgentAdminClient();

    const result = await executeApprovedRelease({
      supabase,
      jobId: id,
      executedByUserId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Approved release could not be executed.";

    if (error instanceof AgentAuthorizationError) {
      return NextResponse.json(
        { status: "error", message },
        { status: error.status },
      );
    }

    console.error("Release execution error:", error);

    return NextResponse.json(
      { status: "error", message },
      { status: 500 },
    );
  }
}
