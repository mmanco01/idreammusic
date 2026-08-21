import { NextResponse } from "next/server";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

import { getMuseProfile } from "@/lib/agentic/muse-sweep-definitions";

export const runtime = "nodejs";

type MuseRunRequest = { museKey?: unknown; depth?: unknown };

function cleanMuseKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAgentAdmin(request);
    const body = (await request.json().catch(() => ({}))) as MuseRunRequest;
    const museKey = cleanMuseKey(body.museKey);
    const depth = Number(body.depth ?? 2);

    if (depth !== 2) {
      return NextResponse.json(
        { status: "error", message: "Manager one-off Muse runs currently support Depth-02 only." },
        { status: 400 },
      );
    }

    const profile = getMuseProfile(museKey);
    const candidateVersion = `${museKey}-depth-agent-02`;
    const supabase = getAgentAdminClient() as any;

    const { data: existing, error: existingError } = await supabase
      .from("agent_jobs")
      .select("id,muse_key,title,candidate_version,status,created_at,updated_at")
      .eq("candidate_version", candidateVersion)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw new Error(`Could not inspect existing Muse run: ${existingError.message}`);

    if (existing) {
      return NextResponse.json({
        status: "success",
        created: false,
        displayName: profile.displayName,
        candidateVersion,
        job: existing,
      });
    }

    const { data: job, error: insertError } = await supabase
      .from("agent_jobs")
      .insert({
        job_type: "MUSE_KNOWLEDGE_EXPANSION",
        priority: 60,
        risk_level: "LOW",
        muse_key: museKey,
        title: `${profile.displayName} Autonomous Depth Experiment 02`,
        mission: profile.mission,
        baseline_version: "muse-iq-v1.2",
        candidate_version: candidateVersion,
        status: "NEW",
        requested_source_count: 10,
        requires_human_review: true,
        input: {
          initiated_by: user.id,
          initiated_from: "manager-single-muse",
          depth: 2,
          target_capabilities: profile.targetCapabilities,
          human_release_required: true,
          stop_at: "AWAITING_APPROVAL",
        },
      })
      .select("id,muse_key,title,candidate_version,status,created_at,updated_at")
      .single();

    if (insertError || !job) throw new Error(insertError?.message || "Could not create one-off Muse job.");

    await supabase.from("agent_audit_events").insert({
      job_id: job.id,
      event_type: "MANAGER_MUSE_RUN_CREATED",
      actor_type: "HUMAN",
      actor_name: "Manager Muse Sweep Control",
      from_status: null,
      to_status: "NEW",
      payload: {
        muse_key: museKey,
        candidate_version: candidateVersion,
        depth: 2,
        initiated_by: user.id,
      },
    });

    return NextResponse.json({
      status: "success",
      created: true,
      displayName: profile.displayName,
      candidateVersion,
      job,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "One-off Muse run could not be created.";

    if (error instanceof AgentAuthorizationError) {
      return NextResponse.json({ status: "error", message }, { status: error.status });
    }

    console.error("Manager Muse run error:", error);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

