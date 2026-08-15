import {
  NextResponse,
} from "next/server";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

import {
  runValidationAgentStep,
} from "@/lib/agentic/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

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
  const { id } = await params;

  let supabase: any = null;

  try {
    const { user } =
      await requireAgentAdmin(
        request,
      );

    supabase =
      getAgentAdminClient();

    const origin =
      new URL(request.url).origin;

    const cookie =
      request.headers.get(
        "cookie",
      ) ?? "";

    const result =
      await runValidationAgentStep({
        supabase,
        jobId: id,
        initiatedByUserId:
          user.id,
        origin,
        cookie,
      });

    return NextResponse.json(
      result,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Validation Agent could not run.";

    if (
      supabase &&
      id
    ) {
      await supabase
        .from("agent_jobs")
        .update({
          current_agent: null,
          last_error: message,
        })
        .eq("id", id);
    }

    if (
      error instanceof
      AgentAuthorizationError
    ) {
      return NextResponse.json(
        {
          status: "error",
          message,
        },
        {
          status: error.status,
        },
      );
    }

    console.error(
      "Validation Agent error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      {
        status: 500,
      },
    );
  }
}
