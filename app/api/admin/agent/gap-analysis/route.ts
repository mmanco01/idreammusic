import {
  NextResponse,
} from "next/server";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

import {
  createApprovedDepth03Jobs,
  decideMuseGapRecommendation,
  getLatestMuseGapAnalysis,
  runMuseGapAnalysis,
} from "@/lib/agentic/gap-analysis";

export const runtime = "nodejs";
export const maxDuration = 300;

type GapAnalysisRequest = {
  action?: unknown;
  recommendationId?: unknown;
  decision?: unknown;
  decisionNotes?: unknown;
  runId?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned =
    value.trim().slice(0, maxLength);

  return cleaned || null;
}

export async function POST(
  request: Request,
) {
  try {
    const { user } =
      await requireAgentAdmin(request);

    const supabase =
      getAgentAdminClient() as any;

    const body =
      (await request
        .json()
        .catch(() => ({}))) as GapAnalysisRequest;

    const action =
      cleanString(body.action, 50)
        ?.toLowerCase() || "latest";

    if (action === "latest") {
      return NextResponse.json(
        await getLatestMuseGapAnalysis({
          supabase,
        }),
      );
    }

    if (action === "analyze") {
      return NextResponse.json(
        await runMuseGapAnalysis({
          supabase,
          initiatedByUserId: user.id,
        }),
      );
    }

    if (action === "decide") {
      const recommendationId =
        cleanString(
          body.recommendationId,
          100,
        );
      const decision =
        cleanString(
          body.decision,
          20,
        )?.toUpperCase();
      const decisionNotes =
        cleanString(
          body.decisionNotes,
          2000,
        );

      if (!recommendationId) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "A gap recommendation ID is required.",
          },
          { status: 400 },
        );
      }

      if (
        decision !== "APPROVED" &&
        decision !== "REJECTED"
      ) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "Decision must be APPROVED or REJECTED.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        await decideMuseGapRecommendation({
          supabase,
          recommendationId,
          decision,
          decisionNotes,
          userId: user.id,
        }),
      );
    }

    if (
      action === "create-approved-jobs"
    ) {
      const runId = cleanString(
        body.runId,
        100,
      );

      if (!runId) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "A completed gap analysis run ID is required.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        await createApprovedDepth03Jobs({
          supabase,
          runId,
          initiatedByUserId: user.id,
        }),
      );
    }

    return NextResponse.json(
      {
        status: "error",
        message:
          "Gap Analysis action must be latest, analyze, decide, or create-approved-jobs.",
      },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Muse Gap Analysis could not run.";

    if (
      error instanceof AgentAuthorizationError
    ) {
      return NextResponse.json(
        {
          status: "error",
          message,
        },
        { status: error.status },
      );
    }

    console.error(
      "Muse Gap Analysis error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      { status: 500 },
    );
  }
}
