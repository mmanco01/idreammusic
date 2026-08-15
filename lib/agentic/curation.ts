import OpenAI from "openai";
import {
  createHash,
} from "node:crypto";

import {
  CURATION_AGENT_PROMPT,
} from "@/lib/agentic/prompts";

function hashValue(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

type ProposedDecision = {
  source_candidate_id: string;
  decision:
    | "ACCEPT"
    | "REJECT"
    | "DEFER"
    | "HUMAN_REVIEW";
  authority_score: number;
  relevance_score: number;
  muse_fit_score: number;
  evidence_quality_score: number;
  novelty_score: number;
  duplication_score: number;
  rationale: string;
  conflict_notes: string | null;
};

type CurationOutput = {
  decisions: ProposedDecision[];
};

function decisionRank(
  decision: ProposedDecision,
) {
  return (
    decision.authority_score +
    decision.relevance_score +
    decision.muse_fit_score +
    decision.evidence_quality_score +
    decision.novelty_score -
    decision.duplication_score
  );
}

export async function runCurationAgent({
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
        title,
        mission,
        baseline_version,
        candidate_version,
        status,
        requested_source_count,
        input,
        result_summary,
        retry_count,
        max_retries
      `,
    )
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    throw new Error(
      jobError?.message ||
        "Agent job could not be found.",
    );
  }

  if (
    ![
      "RESEARCHED",
      "CURATING",
    ].includes(job.status)
  ) {
    throw new Error(
      `Curation Agent cannot run while job ${jobId} is ${job.status}.`,
    );
  }

  const {
    data: humanDecisions,
    error: humanDecisionError,
  } = await supabase
    .from("curation_decisions")
    .select("id")
    .eq("job_id", jobId)
    .eq("reviewer_type", "HUMAN")
    .limit(1);

  if (humanDecisionError) {
    throw new Error(
      humanDecisionError.message,
    );
  }

  if (
    humanDecisions &&
    humanDecisions.length
  ) {
    throw new Error(
      "Automatic Curation cannot overwrite existing human editorial decisions.",
    );
  }

  const {
    data: candidates,
    error: candidateError,
  } = await supabase
    .from("source_candidates")
    .select("*")
    .eq("job_id", jobId)
    .order(
      "authority_score",
      {
        ascending: false,
      },
    );

  if (candidateError) {
    throw new Error(
      candidateError.message,
    );
  }

  const sourceCandidates =
    candidates ?? [];

  const requestedCount =
    Number(
      job.requested_source_count ??
      10,
    );

  const jobInput =
    job.input &&
    typeof job.input ===
      "object"
      ? job.input as any
      : {};

  const targetCapabilities =
    Array.isArray(
      jobInput.target_capabilities,
    )
      ? jobInput
          .target_capabilities
          .filter(
            (
              value: unknown,
            ): value is string =>
              typeof value ===
                "string",
          )
          .map(
            (value: string) =>
              value.trim(),
          )
          .filter(Boolean)
      : [];

  const capabilityLines =
    targetCapabilities.length
      ? targetCapabilities
          .map(
            (value: string) =>
              `  - ${value}`,
          )
          .join("\n")
      : "  - capabilities implied by the Muse mission";

  if (
    sourceCandidates.length <
    requestedCount
  ) {
    throw new Error(
      `Only ${sourceCandidates.length} research candidates exist; ${requestedCount} are required.`,
    );
  }

  const completeCandidates =
    sourceCandidates.filter(
      (candidate: any) =>
        candidate.provenance_status ===
        "COMPLETE",
    );

  if (
    completeCandidates.length <
    requestedCount
  ) {
    throw new Error(
      `Only ${completeCandidates.length} candidates have complete provenance; ${requestedCount} are required.`,
    );
  }

  if (
    job.status ===
    "RESEARCHED"
  ) {
    const {
      error: startError,
    } = await supabase
      .from("agent_jobs")
      .update({
        status:
          "CURATING",
        current_agent:
          "CURATION",
        last_error:
          null,
      })
      .eq("id", jobId);

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
          "CURATION_STARTED",
        actor_type:
          "AGENT",
        actor_name:
          "curation-agent-v1",
        from_status:
          "RESEARCHED",
        to_status:
          "CURATING",
        payload: {
          initiated_by:
            initiatedByUserId,
          candidate_count:
            sourceCandidates.length,
          requested_accept_count:
            requestedCount,
          complete_provenance_count:
            completeCandidates.length,
        },
      });
  }

  try {
    /*
     * Safe retry:
     * remove only prior AGENT decisions.
     */
    const {
      error: cleanupDecisionError,
    } = await supabase
      .from("curation_decisions")
      .delete()
      .eq("job_id", jobId)
      .eq(
        "reviewer_type",
        "AGENT",
      );

    if (cleanupDecisionError) {
      throw new Error(
        cleanupDecisionError.message,
      );
    }

    const {
      error: resetError,
    } = await supabase
      .from("source_candidates")
      .update({
        disposition:
          "CANDIDATE",
      })
      .eq("job_id", jobId);

    if (resetError) {
      throw new Error(
        resetError.message,
      );
    }

    const candidatePayload =
      sourceCandidates.map(
        (candidate: any) => ({
          id:
            candidate.id,
          title:
            candidate.title,
          author:
            candidate.author,
          publisher:
            candidate.publisher,
          source_url:
            candidate.source_url,
          source_type:
            candidate.source_type,
          target_capabilities:
            candidate.target_capabilities,
          relevance_reason:
            candidate.relevance_reason,
          research_authority_score:
            candidate.authority_score,
          research_novelty_score:
            candidate.novelty_score,
          research_overlap_score:
            candidate.overlap_score,
          provenance_status:
            candidate.provenance_status,
          rights_status:
            candidate.rights_status,
          research_notes:
            candidate.research_notes,
        }),
      );

    const candidateIds =
      sourceCandidates.map(
        (candidate: any) =>
          String(candidate.id),
      );

    const model =
      process.env
        .OPENAI_AGENT_CURATION_MODEL ||
      process.env
        .OPENAI_AGENT_RESEARCH_MODEL ||
      "gpt-5.6";

    const prompt =
      `
Muse:
${job.muse_key}

Mission:
${job.mission}

You have ${sourceCandidates.length} researched candidates.

The target is exactly ${requestedCount} ACCEPT decisions if at least ${requestedCount} candidates meet the quality standard.

IMPORTANT GOVERNANCE:
- A candidate with provenance_status PARTIAL may NOT be ACCEPTED in this autonomous pass. Use DEFER.
- RESTRICTED material may NOT be ACCEPTED.
- UNKNOWN rights status does not automatically disqualify a source because this stage selects evidence sources; later ingestion must use lawful original synthesis rather than copied copyrighted text.
- Favor sources that contribute real new capability rather than repeating existing ideas.
- Prefer direct songwriting/popular-song relevance when authority is comparable.
- A highly authoritative source is useful only if its concepts transfer meaningfully to ${job.muse_key} and this Muse's mission.
- Do not reward prestige alone.
- Look for balanced coverage across this Muse's target capabilities:
${capabilityLines}
- Use HUMAN_REVIEW only for a genuine editorial conflict that should be surfaced to Mike.

Research candidates:
${JSON.stringify(
  candidatePayload,
  null,
  2,
)}
`.trim();

    const response =
      await openai.responses.create({
        model,

        input: [
          {
            role:
              "system",
            content:
              CURATION_AGENT_PROMPT,
          },
          {
            role:
              "user",
            content:
              prompt,
          },
        ],

        text: {
          format: {
            type:
              "json_schema",
            name:
              "idreammusic_curation_decisions",
            strict:
              true,
            schema: {
              type:
                "object",
              additionalProperties:
                false,
              properties: {
                decisions: {
                  type:
                    "array",
                  minItems:
                    sourceCandidates.length,
                  maxItems:
                    sourceCandidates.length,
                  items: {
                    type:
                      "object",
                    additionalProperties:
                      false,
                    properties: {
                      source_candidate_id: {
                        type:
                          "string",
                        enum:
                          candidateIds,
                      },
                      decision: {
                        type:
                          "string",
                        enum: [
                          "ACCEPT",
                          "REJECT",
                          "DEFER",
                          "HUMAN_REVIEW",
                        ],
                      },
                      authority_score: {
                        type:
                          "integer",
                        minimum:
                          0,
                        maximum:
                          100,
                      },
                      relevance_score: {
                        type:
                          "integer",
                        minimum:
                          0,
                        maximum:
                          100,
                      },
                      muse_fit_score: {
                        type:
                          "integer",
                        minimum:
                          0,
                        maximum:
                          100,
                      },
                      evidence_quality_score: {
                        type:
                          "integer",
                        minimum:
                          0,
                        maximum:
                          100,
                      },
                      novelty_score: {
                        type:
                          "integer",
                        minimum:
                          0,
                        maximum:
                          100,
                      },
                      duplication_score: {
                        type:
                          "integer",
                        minimum:
                          0,
                        maximum:
                          100,
                      },
                      rationale: {
                        type:
                          "string",
                      },
                      conflict_notes: {
                        type: [
                          "string",
                          "null",
                        ],
                      },
                    },
                    required: [
                      "source_candidate_id",
                      "decision",
                      "authority_score",
                      "relevance_score",
                      "muse_fit_score",
                      "evidence_quality_score",
                      "novelty_score",
                      "duplication_score",
                      "rationale",
                      "conflict_notes",
                    ],
                  },
                },
              },
              required: [
                "decisions",
              ],
            },
          },
        },
      });

    if (
      !response.output_text
    ) {
      throw new Error(
        "Curation Agent returned no structured output.",
      );
    }

    const parsed =
      JSON.parse(
        response.output_text,
      ) as CurationOutput;

    if (
      !Array.isArray(
        parsed.decisions,
      ) ||
      parsed.decisions.length !==
        sourceCandidates.length
    ) {
      throw new Error(
        "Curation Agent did not return one decision per candidate.",
      );
    }

    const uniqueIds =
      new Set(
        parsed.decisions.map(
          (decision) =>
            decision
              .source_candidate_id,
        ),
      );

    if (
      uniqueIds.size !==
      sourceCandidates.length
    ) {
      throw new Error(
        "Curation Agent returned duplicate or missing candidate decisions.",
      );
    }

const candidateById =
  new Map<string, any>(
    sourceCandidates.map(
      (candidate: any): [string, any] => [
        String(
          candidate.id,
        ),
        candidate,
      ],
    ),
  );

    /*
     * Hard governance overrides.
     */
    let decisions =
      parsed.decisions.map(
        (decision) => {
          const candidate =
            candidateById.get(
              decision
                .source_candidate_id,
            );

          if (!candidate) {
            throw new Error(
              `Unknown source candidate ${decision.source_candidate_id}.`,
            );
          }

          if (
            candidate
              .provenance_status !==
              "COMPLETE" &&
            decision.decision ===
              "ACCEPT"
          ) {
            return {
              ...decision,
              decision:
                "DEFER" as const,
              rationale:
                `${decision.rationale} Autonomous acceptance blocked because provenance is ${candidate.provenance_status}.`,
            };
          }

          if (
            candidate
              .rights_status ===
              "RESTRICTED" &&
            decision.decision ===
              "ACCEPT"
          ) {
            return {
              ...decision,
              decision:
                "REJECT" as const,
              rationale:
                `${decision.rationale} Autonomous acceptance blocked because rights status is RESTRICTED.`,
            };
          }

          return decision;
        },
      );

    /*
     * If the model accepted more than requested,
     * retain the strongest requestedCount and
     * defer the extras.
     */
    const accepted =
      decisions
        .filter(
          (decision) =>
            decision.decision ===
            "ACCEPT",
        )
        .sort(
          (a, b) =>
            decisionRank(b) -
            decisionRank(a),
        );

    if (
      accepted.length >
      requestedCount
    ) {
      const keep =
        new Set(
          accepted
            .slice(
              0,
              requestedCount,
            )
            .map(
              (decision) =>
                decision
                  .source_candidate_id,
            ),
        );

      decisions =
        decisions.map(
          (decision) => {
            if (
              decision.decision ===
                "ACCEPT" &&
              !keep.has(
                decision
                  .source_candidate_id,
              )
            ) {
              return {
                ...decision,
                decision:
                  "DEFER" as const,
                rationale:
                  `${decision.rationale} Deferred because the requested acceptance target was already filled by higher-ranked candidates.`,
              };
            }

            return decision;
          },
        );
    }

    const finalAccepted =
      decisions.filter(
        (decision) =>
          decision.decision ===
          "ACCEPT",
      );

    const humanReview =
      decisions.filter(
        (decision) =>
          decision.decision ===
          "HUMAN_REVIEW",
      );

    if (
      finalAccepted.length <
      requestedCount
    ) {
      throw new Error(
        `Curation produced only ${finalAccepted.length} acceptable sources; ${requestedCount} are required.`,
      );
    }

    const decisionRows =
      decisions.map(
        (decision) => ({
          job_id:
            jobId,
          source_candidate_id:
            decision
              .source_candidate_id,
          decision:
            decision.decision,
          authority_score:
            decision
              .authority_score,
          relevance_score:
            decision
              .relevance_score,
          muse_fit_score:
            decision
              .muse_fit_score,
          evidence_quality_score:
            decision
              .evidence_quality_score,
          novelty_score:
            decision
              .novelty_score,
          duplication_score:
            decision
              .duplication_score,
          rationale:
            decision.rationale,
          conflict_notes:
            decision.conflict_notes,
          reviewer_type:
            "AGENT",
        }),
      );

    const {
      error: insertError,
    } = await supabase
      .from(
        "curation_decisions",
      )
      .insert(
        decisionRows,
      );

    if (insertError) {
      throw new Error(
        insertError.message,
      );
    }

    const groups = {
      ACCEPTED:
        decisions
          .filter(
            (item) =>
              item.decision ===
              "ACCEPT",
          )
          .map(
            (item) =>
              item
                .source_candidate_id,
          ),

      REJECTED:
        decisions
          .filter(
            (item) =>
              item.decision ===
              "REJECT",
          )
          .map(
            (item) =>
              item
                .source_candidate_id,
          ),

      DEFERRED:
        decisions
          .filter(
            (item) =>
              item.decision ===
                "DEFER" ||
              item.decision ===
                "HUMAN_REVIEW",
          )
          .map(
            (item) =>
              item
                .source_candidate_id,
          ),
    };

    for (
      const [
        disposition,
        ids,
      ]
      of Object.entries(
        groups,
      )
    ) {
      if (!ids.length) {
        continue;
      }

      const {
        error:
          dispositionError,
      } = await supabase
        .from(
          "source_candidates",
        )
        .update({
          disposition,
        })
        .in(
          "id",
          ids,
        );

      if (
        dispositionError
      ) {
        throw new Error(
          dispositionError.message,
        );
      }
    }

    const report = {
      agent:
        "curation-agent-v1",
      model,
      openai_response_id:
        response.id,
      muse_key:
        job.muse_key,
      candidate_version:
        job.candidate_version,
      researched_count:
        sourceCandidates.length,
      accepted_count:
        groups.ACCEPTED.length,
      rejected_count:
        groups.REJECTED.length,
      deferred_count:
        groups.DEFERRED.length,
      human_review_count:
        humanReview.length,
      accepted_source_ids:
        groups.ACCEPTED,
      rejected_source_ids:
        groups.REJECTED,
      deferred_source_ids:
        groups.DEFERRED,
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
          "CURATION_REPORT",
        artifact_version:
          1,
        created_by_agent:
          "CURATION",
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
          "CURATED",
        current_agent:
          null,
        last_error:
          null,
        requires_human_review:
          humanReview.length >
          0,
        result_summary: {
          ...existingSummary,
          curation:
            report,
        },
      })
      .eq("id", jobId);

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
          "CURATION_COMPLETED",
        actor_type:
          "AGENT",
        actor_name:
          "curation-agent-v1",
        from_status:
          "CURATING",
        to_status:
          "CURATED",
        payload:
          report,
      });

    return {
      status:
        "success",
      jobId,
      ...report,
      decisions,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Curation Agent error.";

    const retryCount =
      Number(
        job.retry_count ??
        0,
      ) + 1;

    const maxRetries =
      Number(
        job.max_retries ??
        3,
      );

    const nextStatus =
      retryCount <=
      maxRetries
        ? "RESEARCHED"
        : "HUMAN_REVIEW";

    await supabase
      .from("agent_jobs")
      .update({
        status:
          nextStatus,
        current_agent:
          null,
        retry_count:
          retryCount,
        last_error:
          message,
        requires_human_review:
          nextStatus ===
          "HUMAN_REVIEW",
      })
      .eq("id", jobId);

    await supabase
      .from(
        "agent_audit_events",
      )
      .insert({
        job_id:
          jobId,
        event_type:
          "CURATION_FAILED",
        actor_type:
          "AGENT",
        actor_name:
          "curation-agent-v1",
        from_status:
          "CURATING",
        to_status:
          nextStatus,
        payload: {
          error:
            message,
          retry_count:
            retryCount,
          max_retries:
            maxRetries,
        },
      });

    throw error;
  }
}
