import {
  NextResponse,
} from "next/server";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

import {
  approveReleaseCandidate,
} from "@/lib/agentic/release-manager";

export const runtime =
  "nodejs";

type ApproveRequest = {
  decisionNotes?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
): string | null {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const cleaned =
    value
      .trim()
      .slice(
        0,
        maxLength,
      );

  return cleaned ||
    null;
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const {
      user,
    } =
      await requireAgentAdmin(
        request,
      );

    const {
      id,
    } =
      await params;

    const body =
      (await request
        .json()
        .catch(
          () => ({}),
        )) as ApproveRequest;

    const supabase =
      getAgentAdminClient();

    const result =
      await approveReleaseCandidate({
        supabase,
        jobId:
          id,
        decidedByUserId:
          user.id,
        actorName:
          user.email ??
          user.id,
        decisionNotes:
          cleanString(
            body.decisionNotes,
            2000,
          ),
      });

    return NextResponse.json(
      result,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Release approval could not be recorded.";

    if (
      error instanceof
      AgentAuthorizationError
    ) {
      return NextResponse.json(
        {
          status:
            "error",
          message,
        },
        {
          status:
            error.status,
        },
      );
    }

    console.error(
      "Release approval error:",
      error,
    );

    return NextResponse.json(
      {
        status:
          "error",
        message,
      },
      {
        status:
          500,
      },
    );
  }
}
