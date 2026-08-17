import {
  randomUUID,
} from "node:crypto";

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

const WORKER_LEASE_SECONDS =
  600;

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

    const ownerToken =
      randomUUID();

    const leaseKey =
      `muse-sweep:${sweepKey}`;

    const {
      data: leaseData,
      error: leaseError,
    } =
      await (supabase.rpc as any)(
        "acquire_agent_worker_lease",
        {
          p_lease_key:
            leaseKey,
          p_owner_token:
            ownerToken,
          p_lease_seconds:
            WORKER_LEASE_SECONDS,
        },
      );

    if (leaseError) {
      throw new Error(
        `Could not acquire Muse Sweep worker lease: ${leaseError.message}`,
      );
    }

    const lease =
      Array.isArray(
        leaseData,
      )
        ? leaseData[0]
        : leaseData;

    if (!lease?.acquired) {
      return NextResponse.json({
        status: "success",
        orchestrator:
          "muse-sweep-orchestrator-v1",
        sweepKey,
        advancedCount: 0,
        leaseAcquired:
          false,
        leaseExpiresAt:
          lease?.lease_expires_at ??
          null,
        continueRequired:
          true,
        message:
          "Muse Sweep worker is already active for this sweep.",
      });
    }

    try {
      const result =
        await runMuseSweepWorkerStep({
          supabase,
          origin,
          authorization,
          sweepKey,
        });

      return NextResponse.json({
        ...result,
        leaseAcquired:
          true,
      });
    } finally {
      const {
        error: releaseError,
      } =
        await (supabase.rpc as any)(
          "release_agent_worker_lease",
          {
            p_lease_key:
              leaseKey,
            p_owner_token:
              ownerToken,
          },
        );

      if (releaseError) {
        console.error(
          "Could not release Muse Sweep worker lease:",
          releaseError,
        );
      }
    }
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
