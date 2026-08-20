import { NextResponse } from "next/server";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

export const runtime = "nodejs";

type ReturnRequest = {
  decisionNotes?: unknown;
};

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAgentAdmin(request);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as ReturnRequest;
    const decisionNotes = cleanString(body.decisionNotes, 2000);

    if (!decisionNotes) {
      return NextResponse.json(
        { status: "error", message: "A return-for-work note is required." },
        { status: 400 },
      );
    }

    const supabase = getAgentAdminClient() as any;

    const { data: job, error: jobError } = await supabase
      .from("agent_jobs")
      .select("id,status,candidate_version")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      throw new Error(jobError?.message || "Agent job could not be found.");
    }

    if (job.status !== "AWAITING_APPROVAL") {
      return NextResponse.json(
        {
          status: "error",
          message: `Release can only be returned for work while awaiting approval; job is ${job.status}.`,
        },
        { status: 409 },
      );
    }

    const { data: releases, error: releaseLookupError } = await supabase
      .from("release_candidates")
      .select("id,status")
      .eq("job_id", id)
      .eq("status", "AWAITING_APPROVAL")
      .order("created_at", { ascending: false })
      .limit(1);

    if (releaseLookupError) {
      throw new Error(`Could not inspect release candidate: ${releaseLookupError.message}`);
    }

    const release = releases?.[0];
    if (!release) {
      return NextResponse.json(
        { status: "error", message: "No release candidate is awaiting approval for this job." },
        { status: 409 },
      );
    }

    const { data: approvals, error: approvalLookupError } = await supabase
      .from("agent_approvals")
      .select("id,status")
      .eq("job_id", id)
      .eq("release_candidate_id", release.id)
      .eq("approval_type", "RELEASE")
      .eq("status", "PENDING")
      .order("requested_at", { ascending: false })
      .limit(1);

    if (approvalLookupError) {
      throw new Error(`Could not inspect release approval: ${approvalLookupError.message}`);
    }

    const approval = approvals?.[0];
    if (!approval) {
      return NextResponse.json(
        { status: "error", message: "No pending human RELEASE approval exists for this job." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();

    const { error: approvalError } = await supabase
      .from("agent_approvals")
      .update({
        status: "REJECTED",
        decision_notes: decisionNotes,
        decided_at: now,
        decided_by: user.id,
      })
      .eq("id", approval.id);

    if (approvalError) {
      throw new Error(`Could not record return-for-work decision: ${approvalError.message}`);
    }

    const { error: releaseError } = await supabase
      .from("release_candidates")
      .update({ status: "REJECTED" })
      .eq("id", release.id);

    if (releaseError) {
      throw new Error(`Could not reject release candidate: ${releaseError.message}`);
    }

    const { error: jobUpdateError } = await supabase
      .from("agent_jobs")
      .update({
        status: "HUMAN_REVIEW",
        current_agent: null,
        requires_human_review: true,
        last_error: null,
      })
      .eq("id", id);

    if (jobUpdateError) {
      throw new Error(`Could not move job to HUMAN_REVIEW: ${jobUpdateError.message}`);
    }

    const { error: auditError } = await supabase
      .from("agent_audit_events")
      .insert({
        job_id: id,
        event_type: "RELEASE_RETURNED_FOR_WORK",
        actor_type: "HUMAN",
        actor_name: user.email ?? user.id,
        from_status: "AWAITING_APPROVAL",
        to_status: "HUMAN_REVIEW",
        payload: {
          release_candidate_id: release.id,
          approval_id: approval.id,
          candidate_version: job.candidate_version,
          decision_notes: decisionNotes,
        },
      });

    if (auditError) {
      throw new Error(`Could not write return-for-work audit event: ${auditError.message}`);
    }

    return NextResponse.json({
      status: "success",
      jobId: id,
      jobStatus: "HUMAN_REVIEW",
      releaseCandidateId: release.id,
      releaseCandidateStatus: "REJECTED",
      approvalId: approval.id,
      approvalStatus: "REJECTED",
      productionChanged: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Release candidate could not be returned for work.";

    if (error instanceof AgentAuthorizationError) {
      return NextResponse.json(
        { status: "error", message },
        { status: error.status },
      );
    }

    console.error("Return-for-work error:", error);
    return NextResponse.json(
      { status: "error", message },
      { status: 500 },
    );
  }
}
