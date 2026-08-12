import OpenAI from "openai";
import {
  createHash,
} from "node:crypto";

import {
  RESEARCH_AGENT_PROMPT,
} from "@/lib/agentic/prompts";

function normalizedUrl(
  value: string,
): string {
  try {
    const url =
      new URL(value);

    url.hash = "";

    return (
      url.origin.toLowerCase() +
      url.pathname.replace(/\/+$/, "") +
      url.search
    );
  } catch {
    return value
      .trim()
      .replace(/\/+$/, "")
      .toLowerCase();
  }
}

function collectUrls(
  value: unknown,
  urls: Set<string>,
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item
      of value
    ) {
      collectUrls(
        item,
        urls,
      );
    }

    return;
  }

  for (
    const [
      key,
      child,
    ]
    of Object.entries(
      value as Record<
        string,
        unknown
      >,
    )
  ) {
    if (
      key.toLowerCase() ===
        "url" &&
      typeof child ===
        "string" &&
      /^https?:\/\//i.test(
        child,
      )
    ) {
      urls.add(
        normalizedUrl(
          child,
        ),
      );
    }

    collectUrls(
      child,
      urls,
    );
  }
}

function hashValue(
  value: string,
): string {
  return createHash(
    "sha256",
  )
    .update(value)
    .digest("hex");
}

export async function runProvenanceRepair({
  supabase,
  openai,
  jobId,
  initiatedByUserId,
}: {
  supabase: any;
  openai: OpenAI;
  jobId: string;
  initiatedByUserId: string;
}) {
  const {
    data: job,
    error: jobError,
  } = await supabase
    .from("agent_jobs")
    .select(
      `
        id,
        muse_key,
        mission,
        status,
        baseline_version,
        candidate_version,
        result_summary
      `,
    )
    .eq(
      "id",
      jobId,
    )
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
    job.status !==
    "CURATED"
  ) {
    throw new Error(
      `Provenance repair requires CURATED status; job is ${job.status}.`,
    );
  }

  const {
    data: candidates,
    error: candidateError,
  } = await supabase
    .from(
      "source_candidates",
    )
    .select(
      `
        id,
        title,
        author,
        publisher,
        source_url,
        provenance_status,
        disposition,
        metadata
      `,
    )
    .eq(
      "job_id",
      jobId,
    )
    .neq(
      "provenance_status",
      "COMPLETE",
    );

  if (candidateError) {
    throw new Error(
      candidateError.message,
    );
  }

  const targets =
    (
      candidates ??
      []
    ).filter(
      (candidate: any) =>
        candidate.disposition ===
        "DEFERRED",
    );

  if (
    !targets.length
  ) {
    return {
      status:
        "success",
      jobId,
      repaired_count:
        0,
      remaining_partial_count:
        0,
      message:
        "No deferred provenance candidates require repair.",
    };
  }

  const {
    error: startError,
  } = await supabase
    .from("agent_jobs")
    .update({
      status:
        "RESEARCHING",
      current_agent:
        "RESEARCH",
      last_error:
        null,
    })
    .eq(
      "id",
      jobId,
    );

  if (startError) {
    throw new Error(
      startError.message,
    );
  }

  await supabase
    .from(
      "agent_audit_events",
    )
    .insert({
      job_id:
        jobId,
      event_type:
        "PROVENANCE_REPAIR_STARTED",
      actor_type:
        "AGENT",
      actor_name:
        "research-agent-v1",
      from_status:
        "CURATED",
      to_status:
        "RESEARCHING",
      payload: {
        initiated_by:
          initiatedByUserId,
        target_count:
          targets.length,
        target_ids:
          targets.map(
            (
              candidate: any,
            ) =>
              candidate.id,
          ),
      },
    });

  try {
    const model =
      process.env
        .OPENAI_AGENT_RESEARCH_MODEL ||
      "gpt-5.6";

    const results:
      Array<Record<
        string,
        unknown
      >> = [];

    for (
      const candidate
      of targets
    ) {
      const canonical =
        normalizedUrl(
          candidate.source_url,
        );

      const response =
        await openai.responses.create({
          model,

          tools: [
            {
              type:
                "web_search",
            },
          ],

          tool_choice:
            "auto",

          include: [
            "web_search_call.action.sources",
          ],

          input: [
            {
              role:
                "system",

              content:
                RESEARCH_AGENT_PROMPT,
            },

            {
              role:
                "user",

              content:
                `
This is a TARGETED PROVENANCE REPAIR.

Do not research replacement sources.

Verify this exact source and, if technically possible, consult/open the exact canonical URL using web search.

Title:
${candidate.title}

Author:
${candidate.author ?? "(unknown)"}

Publisher:
${candidate.publisher ?? "(unknown)"}

Canonical URL:
${candidate.source_url}

Requirements:
- Use live web search.
- Focus only on establishing that this exact canonical source exists and corresponds to the stated work.
- Do not invent or substitute another work.
- Do not quote or reproduce copyrighted source text.
- A publisher, journal, university, author, archive, DOI, or other authoritative page may help locate the source, but the canonical URL itself must actually be consulted for our automated COMPLETE gate.
- Briefly summarize what you were able to verify.
`.trim(),
            },
          ],
        });

      const consultedUrls =
        new Set<string>();

      collectUrls(
        response.output,
        consultedUrls,
      );

      const verified =
        consultedUrls.has(
          canonical,
        );

      const existingMetadata =
        candidate.metadata &&
        typeof candidate.metadata ===
          "object"
          ? candidate.metadata
          : {};

      const repairMetadata = {
        ...existingMetadata,

        provenance_repair: {
          agent:
            "research-agent-v1",
          model,
          response_id:
            response.id,
          attempted_at:
            new Date()
              .toISOString(),
          canonical_url:
            candidate.source_url,
          canonical_url_consulted:
            verified,
          consulted_url_count:
            consultedUrls.size,
          consulted_urls:
            Array.from(
              consultedUrls,
            ).slice(
              0,
              50,
            ),
          summary:
            response.output_text
              ?.trim()
              .slice(
                0,
                3000,
              ) ??
            null,
        },
      };

      const {
        error: updateError,
      } = await supabase
        .from(
          "source_candidates",
        )
        .update({
          provenance_status:
            verified
              ? "COMPLETE"
              : "PARTIAL",

          metadata:
            repairMetadata,
        })
        .eq(
          "id",
          candidate.id,
        );

      if (updateError) {
        throw new Error(
          updateError.message,
        );
      }

      results.push({
        source_candidate_id:
          candidate.id,
        title:
          candidate.title,
        canonical_url:
          candidate.source_url,
        repaired:
          verified,
        consulted_url_count:
          consultedUrls.size,
        openai_response_id:
          response.id,
      });
    }

    const repairedCount =
      results.filter(
        (result) =>
          result.repaired ===
          true,
      ).length;

    const remainingCount =
      results.length -
      repairedCount;

    const report = {
      agent:
        "research-agent-v1",
      operation:
        "provenance-repair",
      model,
      muse_key:
        job.muse_key,
      candidate_version:
        job.candidate_version,
      attempted_count:
        results.length,
      repaired_count:
        repairedCount,
      remaining_partial_count:
        remainingCount,
      results,
    };

    const {
      error: artifactError,
    } = await supabase
      .from(
        "agent_artifacts",
      )
      .insert({
        job_id:
          jobId,
        artifact_type:
          "PROVENANCE_REPAIR_REPORT",
        artifact_version:
          1,
        created_by_agent:
          "RESEARCH",
        payload:
          report,
        content_hash:
          hashValue(
            JSON.stringify(
              report,
            ),
          ),
        immutable:
          true,
      });

    if (artifactError) {
      throw new Error(
        artifactError.message,
      );
    }

    const existingSummary =
      job.result_summary &&
      typeof job.result_summary ===
        "object"
        ? job.result_summary
        : {};

    const {
      error: completionError,
    } = await supabase
      .from("agent_jobs")
      .update({
        status:
          "RESEARCHED",
        current_agent:
          null,
        last_error:
          null,
        result_summary: {
          ...existingSummary,
          provenance_repair:
            report,
        },
      })
      .eq(
        "id",
        jobId,
      );

    if (
      completionError
    ) {
      throw new Error(
        completionError.message,
      );
    }

    await supabase
      .from(
        "agent_audit_events",
      )
      .insert({
        job_id:
          jobId,
        event_type:
          "PROVENANCE_REPAIR_COMPLETED",
        actor_type:
          "AGENT",
        actor_name:
          "research-agent-v1",
        from_status:
          "RESEARCHING",
        to_status:
          "RESEARCHED",
        payload:
          report,
      });

    return {
      status:
        "success",
      jobId,
      ...report,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown provenance repair error.";

    await supabase
      .from("agent_jobs")
      .update({
        status:
          "CURATED",
        current_agent:
          null,
        last_error:
          message,
      })
      .eq(
        "id",
        jobId,
      );

    await supabase
      .from(
        "agent_audit_events",
      )
      .insert({
        job_id:
          jobId,
        event_type:
          "PROVENANCE_REPAIR_FAILED",
        actor_type:
          "AGENT",
        actor_name:
          "research-agent-v1",
        from_status:
          "RESEARCHING",
        to_status:
          "CURATED",
        payload: {
          error:
            message,
        },
      });

    throw error;
  }
}
