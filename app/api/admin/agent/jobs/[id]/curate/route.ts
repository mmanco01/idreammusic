import OpenAI from "openai";

import {
  NextResponse,
} from "next/server";

import {
  AgentAuthorizationError,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

import {
  getAgentAdminClient,
} from "@/lib/agentic/admin-client";

import {
  runCurationAgent,
} from "@/lib/agentic/curation";

export const runtime =
  "nodejs";

export const maxDuration =
  300;

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    if (
      !process.env
        .OPENAI_API_KEY
    ) {
      return NextResponse.json(
        {
          status:
            "error",
          message:
            "OPENAI_API_KEY is not configured.",
        },
        {
          status:
            500,
        },
      );
    }

    const {
      user,
    } =
      await requireAgentAdmin(
        request,
      );

    const {
      id,
    } =
      await context.params;

    const supabase =
      getAgentAdminClient();

    const openai =
      new OpenAI({
        apiKey:
          process.env
            .OPENAI_API_KEY,
      });

    const result =
      await runCurationAgent({
        supabase,
        openai,
        jobId:
          id,
        initiatedByUserId:
          user.id,
      });

    return NextResponse.json(
      result,
    );
  } catch (error) {
    console.error(
      "Agent Curation error:",
      error,
    );

    const status =
      error instanceof
        AgentAuthorizationError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        status:
          "error",
        message:
          error instanceof Error
            ? error.message
            : "Curation Agent failed.",
      },
      {
        status,
      },
    );
  }
}
