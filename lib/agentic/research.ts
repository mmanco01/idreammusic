import OpenAI from "openai";
import {
  createHash,
} from "node:crypto";

import {
  RESEARCH_AGENT_PROMPT,
} from "@/lib/agentic/prompts";

function clean(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function normalizedUrl(
  value: string,
): string {
  try {
    const url = new URL(value);

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

function hashValue(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
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

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrls(item, urls);
    }

    return;
  }

  for (
    const [key, child]
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
      typeof child === "string" &&
      /^https?:\/\//i.test(child)
    ) {
      urls.add(
        normalizedUrl(child),
      );
    }

    collectUrls(
      child,
      urls,
    );
  }
}

type ResearchCandidate = {
  title: string;
  author: string | null;
  publisher: string | null;
  publication_date: string | null;
  source_url: string;
  source_type: string;
  target_capabilities: string[];
  relevance_reason: string;
  authority_score: number;
  novelty_score: number;
  overlap_score: number;
  rights_status:
    | "CLEARED"
    | "PUBLIC_DOMAIN"
    | "LICENSED"
    | "USER_PROVIDED"
    | "UNKNOWN"
    | "RESTRICTED";
  research_notes: string;
};

type ResearchOutput = {
  candidates: ResearchCandidate[];
};

export async function runResearchAgent({
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
        input,
        requested_source_count,
        retry_count,
        max_retries,
        started_at
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
    ![
      "NEW",
      "RESEARCHING",
    ].includes(
      job.status,
    )
  ) {
    throw new Error(
      `Research Agent cannot run while job ${jobId} is ${job.status}.`,
    );
  }

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

  const capabilities =
    targetCapabilities.length
      ? targetCapabilities
      : [
          "core concepts implied by the Muse mission",
          "songwriting application",
          "diagnostic reasoning",
          "creative guidance",
          "limitations and cautions",
        ];

  const configuredPool =
    Number(
      jobInput
        ?.research_behavior
        ?.target_candidate_pool ??
        16,
    );

  const targetPool =
    Number.isFinite(
      configuredPool,
    )
      ? Math.max(
          10,
          Math.min(
            20,
            Math.floor(
              configuredPool,
            ),
          ),
        )
      : 16;

  const startedAt =
    new Date().toISOString();

  if (
    job.status === "NEW"
  ) {
    const {
      error: startError,
    } = await supabase
      .from("agent_jobs")
      .update({
        status:
          "RESEARCHING",

        current_agent:
          "RESEARCH",

        started_at:
          job.started_at ??
          startedAt,

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
          "RESEARCH_STARTED",

        actor_type:
          "AGENT",

        actor_name:
          "research-agent-v1",

        from_status:
          "NEW",

        to_status:
          "RESEARCHING",

        payload: {
          initiated_by:
            initiatedByUserId,

          target_pool:
            targetPool,

          capabilities,
        },
      });
  }

  try {
    /*
     * If a previous attempt died before completing,
     * remove uncurated leftovers before retrying.
     */
    const {
      error: cleanupError,
    } = await supabase
      .from(
        "source_candidates",
      )
      .delete()
      .eq(
        "job_id",
        jobId,
      )
      .eq(
        "disposition",
        "CANDIDATE",
      );

    if (cleanupError) {
      throw new Error(
        cleanupError.message,
      );
    }

    const {
      data: existingSources,
      error:
        existingSourcesError,
    } = await supabase
      .from(
        "muse_knowledge_sources",
      )
      .select(
        `
          title,
          author_creator,
          canonical_url,
          verification_status,
          is_active
        `,
      )
      .eq(
        "muse_slug",
        job.muse_key,
      )
      .limit(150);

    if (
      existingSourcesError
    ) {
      throw new Error(
        existingSourcesError.message,
      );
    }

    const existingSummary =
      (
        existingSources ??
        []
      )
        .slice(
          0,
          100,
        )
        .map(
          (
            source: any,
          ) =>
            [
              clean(
                source.title,
                180,
              ),

              clean(
                source.author_creator,
                120,
              ),

              clean(
                source.canonical_url,
                300,
              ),
            ]
              .filter(Boolean)
              .join(" | "),
        )
        .filter(Boolean)
        .join("\n");

    const model =
      process.env
        .OPENAI_AGENT_RESEARCH_MODEL ||
      "gpt-5.6";

    const userPrompt =
      `
Research Muse:
${job.muse_key}

Mission:
${job.mission}

Current baseline:
${job.baseline_version}

Candidate version:
${job.candidate_version}

Find exactly ${targetPool} strong source candidates.

Target capabilities:
${capabilities
  .map(
    (
      item: string,
    ) => `- ${item}`,
  )
  .join("\n")}

Existing Muse sources to avoid duplicating:
${existingSummary ||
  "(No existing-source inventory was available.)"}

Research requirements:
- Search the live web.
- Prefer primary, scholarly, university, professional, publisher, author, archival, or otherwise authoritative sources.
- A book may be a candidate, but use a credible page that establishes the book/source and its relevance.
- Do not invent a URL.
- Do not copy large copyrighted passages.
- This stage identifies evidence; it does not ingest source text.
- Use multiple source families rather than sixteen near-duplicates.
- Score authority, novelty, and overlap from 0 through 100.
- overlap_score means overlap with existing ${job.muse_key} knowledge; LOWER is better.
- If a complete publication date cannot be verified, return null rather than guessing.
- rights_status should normally be UNKNOWN unless there is clear evidence for another allowed value.
- Every source must materially support at least one target capability.
`.trim();

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
              userPrompt,
          },
        ],

        text: {
          format: {
            type:
              "json_schema",

            name:
              "idreammusic_research_candidates",

            strict:
              true,

            schema: {
              type:
                "object",

              additionalProperties:
                false,

              properties: {
                candidates: {
                  type:
                    "array",

                  minItems:
                    targetPool,

                  maxItems:
                    targetPool,

                  items: {
                    type:
                      "object",

                    additionalProperties:
                      false,

                    properties: {
                      title: {
                        type:
                          "string",
                      },

                      author: {
                        type: [
                          "string",
                          "null",
                        ],
                      },

                      publisher: {
                        type: [
                          "string",
                          "null",
                        ],
                      },

                      publication_date:
                        {
                          type: [
                            "string",
                            "null",
                          ],
                        },

                      source_url: {
                        type:
                          "string",
                      },

                      source_type: {
                        type:
                          "string",
                      },

                      target_capabilities:
                        {
                          type:
                            "array",

                          minItems:
                            1,

                          items: {
                            type:
                              "string",

                            enum:
                              capabilities,
                          },
                        },

                      relevance_reason:
                        {
                          type:
                            "string",
                        },

                      authority_score:
                        {
                          type:
                            "integer",

                          minimum:
                            0,

                          maximum:
                            100,
                        },

                      novelty_score:
                        {
                          type:
                            "integer",

                          minimum:
                            0,

                          maximum:
                            100,
                        },

                      overlap_score:
                        {
                          type:
                            "integer",

                          minimum:
                            0,

                          maximum:
                            100,
                        },

                      rights_status:
                        {
                          type:
                            "string",

                          enum: [
                            "CLEARED",
                            "PUBLIC_DOMAIN",
                            "LICENSED",
                            "USER_PROVIDED",
                            "UNKNOWN",
                            "RESTRICTED",
                          ],
                        },

                      research_notes:
                        {
                          type:
                            "string",
                        },
                    },

                    required: [
                      "title",
                      "author",
                      "publisher",
                      "publication_date",
                      "source_url",
                      "source_type",
                      "target_capabilities",
                      "relevance_reason",
                      "authority_score",
                      "novelty_score",
                      "overlap_score",
                      "rights_status",
                      "research_notes",
                    ],
                  },
                },
              },

              required: [
                "candidates",
              ],
            },
          },
        },
      });

    if (
      !response.output_text
    ) {
      throw new Error(
        "Research Agent returned no structured output.",
      );
    }

    const parsed =
      JSON.parse(
        response.output_text,
      ) as ResearchOutput;

    if (
      !Array.isArray(
        parsed.candidates,
      ) ||
      parsed.candidates.length !==
        targetPool
    ) {
      throw new Error(
        `Research Agent returned ${parsed.candidates?.length ?? 0} candidates; expected ${targetPool}.`,
      );
    }

    /*
     * Build the provenance set from actual
     * web-search output metadata.
     */
    const consultedUrls =
      new Set<string>();

    collectUrls(
      response.output,
      consultedUrls,
    );

    const rows =
      parsed.candidates.map(
        (
          candidate,
        ) => {
          const sourceUrl =
            clean(
              candidate.source_url,
              2000,
            );

          const normalized =
            normalizedUrl(
              sourceUrl,
            );

          const consulted =
            consultedUrls.has(
              normalized,
            );

          return {
            job_id:
              jobId,

            muse_key:
              job.muse_key,

            title:
              clean(
                candidate.title,
                500,
              ),

            author:
              clean(
                candidate.author,
                300,
              ) || null,

            publisher:
              clean(
                candidate.publisher,
                300,
              ) || null,

            publication_date:
              candidate.publication_date ||
              null,

            source_url:
              sourceUrl,

            source_type:
              clean(
                candidate.source_type,
                100,
              ),

            retrieved_at:
              new Date()
                .toISOString(),

            target_capabilities:
              candidate
                .target_capabilities,

            relevance_reason:
              clean(
                candidate.relevance_reason,
                4000,
              ),

            authority_score:
              candidate
                .authority_score,

            novelty_score:
              candidate
                .novelty_score,

            overlap_score:
              candidate
                .overlap_score,

            /*
             * COMPLETE only when the candidate URL
             * matches a URL actually surfaced by
             * the web-search call.
             */
            provenance_status:
              consulted
                ? "COMPLETE"
                : "PARTIAL",

            rights_status:
              candidate
                .rights_status,

            research_notes:
              clean(
                candidate.research_notes,
                5000,
              ),

            disposition:
              "CANDIDATE",

            source_hash:
              hashValue(
                normalized,
              ),

            metadata: {
              research_agent:
                "research-agent-v1",

              research_model:
                model,

              openai_response_id:
                response.id,

              consulted_by_web_search:
                consulted,

              normalized_source_url:
                normalized,
            },
          };
        },
      );

    const {
      data:
        insertedCandidates,

      error:
        insertError,
    } = await supabase
      .from(
        "source_candidates",
      )
      .insert(rows)
      .select(
        `
          id,
          title,
          source_url,
          authority_score,
          novelty_score,
          overlap_score,
          provenance_status
        `,
      );

    if (insertError) {
      throw new Error(
        `Could not save Research Agent candidates: ${insertError.message}`,
      );
    }

    const completeCount =
      rows.filter(
        (
          row,
        ) =>
          row.provenance_status ===
          "COMPLETE",
      ).length;

    const report = {
      agent:
        "research-agent-v1",

      model,

      openai_response_id:
        response.id,

      muse_key:
        job.muse_key,

      candidate_version:
        job.candidate_version,

      candidate_count:
        rows.length,

      requested_source_count:
        job.requested_source_count,

      provenance_complete_count:
        completeCount,

      provenance_partial_count:
        rows.length -
        completeCount,

      consulted_url_count:
        consultedUrls.size,

      target_capabilities:
        capabilities,

      candidate_ids:
        (
          insertedCandidates ??
          []
        ).map(
          (
            item: any,
          ) => item.id,
        ),
    };

    const {
      error:
        artifactError,
    } = await supabase
      .from(
        "agent_artifacts",
      )
      .insert({
        job_id:
          jobId,

        artifact_type:
          "RESEARCH_REPORT",

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

    const {
      error:
        completionError,
    } = await supabase
      .from(
        "agent_jobs",
      )
      .update({
        status:
          "RESEARCHED",

        current_agent:
          null,

        last_error:
          null,

        result_summary: {
          research:
            report,
        },
      })
      .eq(
        "id",
        jobId,
      );

    if (completionError) {
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
          "RESEARCH_COMPLETED",

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

      candidates:
        insertedCandidates ??
        [],
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Research Agent error.";

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
        ? "NEW"
        : "FAILED";

    await supabase
      .from(
        "agent_jobs",
      )
      .update({
        status:
          nextStatus,

        current_agent:
          null,

        retry_count:
          retryCount,

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
          "RESEARCH_FAILED",

        actor_type:
          "AGENT",

        actor_name:
          "research-agent-v1",

        from_status:
          "RESEARCHING",

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
