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
  runProvenanceRepair,
} from "@/lib/agentic/provenance-repair";

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
      await runProvenanceRepair({
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
      "Agent provenance repair error:",
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
            : "Provenance repair failed.",
      },
      {
        status,
      },
    );
  }
}
