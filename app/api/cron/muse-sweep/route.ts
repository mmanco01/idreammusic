import {
  NextResponse,
} from "next/server";

import {
  getAgentAdminClient,
  isAgentWorkerRequest,
} from "@/lib/agentic/project-adapters";

import {
  DEFAULT_MUSE_SWEEP_KEY,
} from "@/lib/agentic/muse-sweep-definitions";

import {
  runMuseSweepWorkerStep,
} from "@/lib/agentic/muse-sweep";

export const runtime =
  "nodejs";

export const maxDuration =
  300;

export async function GET(
  request: Request,
) {
  try {
    if (
      !isAgentWorkerRequest(
        request,
      )
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Unauthorized Agent worker request.",
        },
        {
          status: 401,
        },
      );
    }

    const authorization =
      request.headers.get(
        "authorization",
      ) ?? "";

    const origin =
      new URL(
        request.url,
      ).origin;

    /*
     * Safety default:
     * unattended execution stays on the completed
     * historical v1 sweep unless this environment
     * setting is deliberately changed.
     */
    const sweepKey =
      process.env
        .MUSE_SWEEP_CRON_KEY
        ?.trim() ||
      DEFAULT_MUSE_SWEEP_KEY;

    const supabase =
      getAgentAdminClient();

    const result =
      await runMuseSweepWorkerStep({
        supabase,
        origin,
        authorization,
        sweepKey,
      });

    return NextResponse.json(
      result,
    );
  } catch (error) {
    console.error(
      "Muse Sweep worker error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Muse Sweep worker failed.",
      },
      {
        status: 500,
      },
    );
  }
}
