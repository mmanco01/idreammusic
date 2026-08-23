import { NextResponse } from "next/server";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

export const runtime = "nodejs";

type RetryValidationRequest = {
  reason?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned =
    value.trim().slice(0, maxLength);

  return cleaned || null;
}

function isRecord(
  value: unknown,
): value is Record<string, any> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
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
    const { user } =
      await requireAgentAdmin(request);

    const { id } =
      await params;

    const body =
      (await request
        .json()
        .catch(() => ({}))) as RetryValidationRequest;

    const reason =
      cleanString(
        body.reason,
        2000,
      );

    if (!reason) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "A retry-validation reason is required.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase =
      getAgentAdminClient() as any;

    const {
      data: job,
      error: jobError,
    } =
      await supabase
        .from("agent_jobs")
        .select(
          "id,status,candidate_version,result_summary",
        )
        .eq("id", id)
        .single();

    if (
      jobError ||
      !job
    ) {
      throw new Error(
        jobError?.message ||
          "Agent job could not be found.",
      );
    }

    if (
      job.status !== "HUMAN_REVIEW"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            `Validation retry requires HUMAN_REVIEW; job is ${job.status}.`,
        },
        {
          status: 409,
        },
      );
    }

    const summary =
      isRecord(job.result_summary)
        ? job.result_summary
        : {};

    const validation =
      isRecord(summary.validation)
        ? summary.validation
        : null;

    if (
      !validation ||
      validation.phase !== "COMPLETE"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "No completed validation state exists to retry.",
        },
        {
          status: 409,
        },
      );
    }

    const previousClassification =
      isRecord(validation.final)
        ? validation.final.classification ?? null
        : null;

    const nextSummary = {
      ...summary,
    };

    delete nextSummary.validation;

    const {
      error: updateError,
    } =
      await supabase
        .from("agent_jobs")
        .update({
          status: "STAGED",
          current_agent: null,
          requires_human_review: false,
          last_error: null,
          result_summary: nextSummary,
        })
        .eq("id", id);

    if (updateError) {
      throw new Error(
        `Could not reset validation: ${updateError.message}`,
      );
    }

    const {
      error: auditError,
    } =
      await supabase
        .from("agent_audit_events")
        .insert({
          job_id: id,
          event_type:
            "VALIDATION_RETRY_REQUESTED",
          actor_type: "HUMAN",
          actor_name:
            user.email ?? user.id,
          from_status:
            "HUMAN_REVIEW",
          to_status:
            "STAGED",
          payload: {
            candidate_version:
              job.candidate_version,
            reason,
            previous_classification:
              previousClassification,
          },
        });

    if (auditError) {
      throw new Error(
        `Could not write validation retry audit event: ${auditError.message}`,
      );
    }

    return NextResponse.json({
      status: "success",
      jobId: id,
      jobStatus: "STAGED",
      validationReset: true,
      productionChanged: false,
      previousClassification,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Validation retry could not be prepared.";

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
      "Retry-validation error:",
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