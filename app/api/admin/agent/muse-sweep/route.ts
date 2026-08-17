import {
  NextResponse,
} from "next/server";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

import {
  DEFAULT_MUSE_SWEEP_KEY,
} from "@/lib/agentic/muse-sweep-definitions";

import {
  ensureMuseSweepJobs,
  getMuseSweepStatus,
  runMuseSweepStep,
} from "@/lib/agentic/muse-sweep";

export const runtime =
  "nodejs";

export const maxDuration =
  300;

type SweepRequest = {
  action?: unknown;
  parallelism?: unknown;
  sweepKey?: unknown;
};

function cleanAction(
  value: unknown,
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .toLowerCase()
    : "status";
}

function cleanParallelism(
  value: unknown,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return 2;
  }

  return Math.max(
    1,
    Math.min(
      2,
      Math.floor(
        parsed,
      ),
    ),
  );
}

function cleanSweepKey(
  value: unknown,
) {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    return DEFAULT_MUSE_SWEEP_KEY;
  }

  return value.trim();
}

export async function POST(
  request: Request,
) {
  try {
    const {
      user,
    } =
      await requireAgentAdmin(
        request,
      );

    const body =
      (await request
        .json()
        .catch(
          () => ({}),
        )) as SweepRequest;

    const action =
      cleanAction(
        body.action,
      );

    const sweepKey =
      cleanSweepKey(
        body.sweepKey,
      );

    const supabase =
      getAgentAdminClient();

    if (
      action === "start"
    ) {
      const result =
        await ensureMuseSweepJobs({
          supabase,
          initiatedByUserId:
            user.id,
          sweepKey,
        });

      return NextResponse.json(
        result,
      );
    }

    if (
      action === "step"
    ) {
      const origin =
        new URL(
          request.url,
        ).origin;

      const cookie =
        request.headers.get(
          "cookie",
        ) ?? "";

      const result =
        await runMuseSweepStep({
          supabase,
          origin,
          cookie,
          parallelism:
            cleanParallelism(
              body.parallelism,
            ),
          sweepKey,
        });

      return NextResponse.json(
        result,
      );
    }

    if (
      action === "status"
    ) {
      const jobs =
        await getMuseSweepStatus({
          supabase,
          sweepKey,
        });

      return NextResponse.json({
        status:
          "success",
        sweepKey,
        jobs,
      });
    }

    return NextResponse.json(
      {
        status:
          "error",
        message:
          "Muse Sweep action must be start, step, or status.",
      },
      {
        status:
          400,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Muse Sweep Orchestrator could not run.";

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
      "Muse Sweep Orchestrator error:",
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
