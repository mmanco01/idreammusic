import {
  NextResponse,
} from "next/server";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

import {
  prepareReleaseCandidate,
} from "@/lib/agentic/release-manager";

export const runtime =
  "nodejs";

export const maxDuration =
  300;

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

    const supabase =
      getAgentAdminClient();

    const result =
      await prepareReleaseCandidate({
        supabase,
        jobId:
          id,
        initiatedByUserId:
          user.id,
      });

    return NextResponse.json(
      result,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Release Manager could not prepare the release candidate.";

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
      "Release Manager prepare error:",
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
