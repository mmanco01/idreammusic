import OpenAI from "openai";
import {
  createHash,
} from "node:crypto";

import {
  stageCandidateKnowledge,
} from "@/lib/agentic/staging";

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

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrls(
        item,
        urls,
      );
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

function hashValue(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

type KnowledgeSynthesis = {
  evidence_sufficient: boolean;
  evidence_summary: string;
  knowledge_title: string;
  knowledge_text: string;
  supported_concepts: string[];
  evidence_urls: string[];
  limitations: string[];
  confidence: number;
};

export async function runKnowledgeIngestionAgent({
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
    ![
      "CURATED",
      "STAGING",
    ].includes(job.status)
  ) {
    throw new Error(
      `Knowledge Ingestion Agent cannot run while job ${jobId} is ${job.status}.`,
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
        source_type,
        target_capabilities,
        relevance_reason,
        provenance_status,
        rights_status,
        disposition,
        research_notes,
        metadata
      `,
    )
    .eq(
      "job_id",
      jobId,
    )
    .eq(
      "disposition",
      "ACCEPTED",
    );

  if (candidateError) {
    throw new Error(
      candidateError.message,
    );
  }

  const acceptedCandidates =
    candidates ?? [];

  if (
    !acceptedCandidates.length
  ) {
    throw new Error(
      "No accepted source candidates were found.",
    );
  }

  const {
    data: decisions,
    error: decisionError,
  } = await supabase
    .from(
      "curation_decisions",
    )
    .select(
      `
        source_candidate_id,
        decision,
        rationale,
        authority_score,
        relevance_score,
        muse_fit_score,
        evidence_quality_score,
        novelty_score,
        duplication_score
      `,
    )
    .eq(
      "job_id",
      jobId,
    )
    .eq(
      "decision",
      "ACCEPT",
    );

  if (decisionError) {
    throw new Error(
      decisionError.message,
    );
  }

  const decisionBySourceId =
    new Map<string, any>(
      (
        decisions ??
        []
      ).map(
        (
          decision: any,
        ): [string, any] => [
          String(
            decision.source_candidate_id,
          ),
          decision,
        ],
      ),
    );

  if (
    job.status ===
    "CURATED"
  ) {
    const {
      error: startError,
    } = await supabase
      .from("agent_jobs")
      .update({
        status:
          "STAGING",

        current_agent:
          "KNOWLEDGE_INGESTION",

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
          "KNOWLEDGE_INGESTION_STARTED",

        actor_type:
          "AGENT",

        actor_name:
          "knowledge-ingestion-agent-v1",

        from_status:
          "CURATED",

        to_status:
          "STAGING",

        payload: {
          initiated_by:
            initiatedByUserId,

          accepted_source_count:
            acceptedCandidates.length,
        },
      });
  }

  try {
    const model =
      process.env
        .OPENAI_AGENT_INGESTION_MODEL ||
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
      of acceptedCandidates
    ) {
      const decision =
        decisionBySourceId.get(
          String(
            candidate.id,
          ),
        );

      /*
       * Hard governance gates.
       */
      if (
        candidate.provenance_status !==
        "COMPLETE"
      ) {
        results.push({
          source_candidate_id:
            candidate.id,

          title:
            candidate.title,

          staged:
            false,

          reason:
            "PROVENANCE_INCOMPLETE",
        });

        continue;
      }

      if (
        candidate.rights_status ===
        "RESTRICTED"
      ) {
        results.push({
          source_candidate_id:
            candidate.id,

          title:
            candidate.title,

          staged:
            false,

          reason:
            "RIGHTS_RESTRICTED",
        });

        continue;
      }

      if (!decision) {
        results.push({
          source_candidate_id:
            candidate.id,

          title:
            candidate.title,

          staged:
            false,

          reason:
            "NO_ACCEPT_DECISION",
        });

        continue;
      }

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
                `
You are the iDreamMusic Knowledge Ingestion Agent.

Your job is NOT to copy source material.

Your job is to determine what can be responsibly learned from an approved source and create original, concise, songwriter-facing knowledge for a candidate Muse.

Evidence discipline is mandatory.

Rules:
- Use live web research.
- Never synthesize knowledge merely from a title.
- Never invent the contents of a book, paper, or article.
- Use only concepts supported by evidence you actually consult.
- Prefer the original source, journal abstract, publisher description, author material, university material, accessible scholarly summaries, or other authoritative evidence.
- Marketing blurbs alone are insufficient for detailed conceptual claims.
- If evidence is insufficient, set evidence_sufficient to false.
- Do not reproduce copyrighted passages.
- Do not quote lyrics.
- Do not imitate the source author's prose.
- Write entirely original synthesis.
- Distinguish a source's actual claims from your application of those ideas to songwriting.
- Do not turn descriptive scholarship into universal songwriting rules.
- Keep the Muse's existing identity intact.
- This is candidate knowledge only. It is not production canon.
`.trim(),
            },

            {
              role:
                "user",

              content:
                `
Muse:
${job.muse_key}

Mission:
${job.mission}

Candidate version:
${job.candidate_version}

Approved source:

Title:
${candidate.title}

Author:
${candidate.author ?? "(unknown)"}

Publisher:
${candidate.publisher ?? "(unknown)"}

Source type:
${candidate.source_type ?? "(unknown)"}

Canonical URL:
${candidate.source_url}

Target capabilities:
${(
  candidate.target_capabilities ??
  []
).join(", ")}

Research relevance:
${candidate.relevance_reason ?? ""}

Curation rationale:
${decision.rationale ?? ""}

Research notes:
${candidate.research_notes ?? ""}

TASK:

Research this exact approved source and determine what evidence is actually available.

If the available evidence is strong enough, create one focused original knowledge synthesis for ${job.muse_key}.

The synthesis should teach practical reasoning rather than summarize the source as a book report.

It should explain:
1. the useful concept,
2. why it matters in songwriting,
3. how ${job.muse_key} should recognize it in a song,
4. how ${job.muse_key} might use it when advising a songwriter,
5. important limits or cautions.

Do not make claims that the available evidence does not support.

Return only URLs that were actually consulted as evidence.
`.trim(),
            },
          ],

          text: {
            format: {
              type:
                "json_schema",

              name:
                "idreammusic_knowledge_synthesis",

              strict:
                true,

              schema: {
                type:
                  "object",

                additionalProperties:
                  false,

                properties: {
                  evidence_sufficient: {
                    type:
                      "boolean",
                  },

                  evidence_summary: {
                    type:
                      "string",
                  },

                  knowledge_title: {
                    type:
                      "string",
                  },

                  knowledge_text: {
                    type:
                      "string",
                  },

                  supported_concepts: {
                    type:
                      "array",

                    items: {
                      type:
                        "string",
                    },
                  },

                  evidence_urls: {
                    type:
                      "array",

                    items: {
                      type:
                        "string",
                    },
                  },

                  limitations: {
                    type:
                      "array",

                    items: {
                      type:
                        "string",
                    },
                  },

                  confidence: {
                    type:
                      "integer",

                    minimum:
                      0,

                    maximum:
                      100,
                  },
                },

                required: [
                  "evidence_sufficient",
                  "evidence_summary",
                  "knowledge_title",
                  "knowledge_text",
                  "supported_concepts",
                  "evidence_urls",
                  "limitations",
                  "confidence",
                ],
              },
            },
          },
        });

      if (
        !response.output_text
      ) {
        results.push({
          source_candidate_id:
            candidate.id,

          title:
            candidate.title,

          staged:
            false,

          reason:
            "NO_SYNTHESIS_OUTPUT",

          openai_response_id:
            response.id,
        });

        continue;
      }

      const synthesis =
        JSON.parse(
          response.output_text,
        ) as KnowledgeSynthesis;

      /*
       * Verify that evidence URLs claimed by
       * the model were actually present in
       * web-search output.
       */
      const consultedUrls =
        new Set<string>();

      collectUrls(
        response.output,
        consultedUrls,
      );

      const verifiedEvidenceUrls =
        Array.from(
          new Set(
            synthesis.evidence_urls
              .filter(
                (
                  url,
                ) =>
                  typeof url ===
                    "string" &&
                  /^https?:\/\//i.test(
                    url,
                  ),
              )
              .map(
                normalizedUrl,
              )
              .filter(
                (
                  url,
                ) =>
                  consultedUrls.has(
                    url,
                  ),
              ),
          ),
        );

      const knowledgeText =
        clean(
          synthesis.knowledge_text,
          12000,
        );

      const evidencePassed =
        synthesis.evidence_sufficient ===
          true &&
        verifiedEvidenceUrls.length >
          0 &&
        knowledgeText.length >=
          250 &&
        synthesis.confidence >=
          70;

      if (!evidencePassed) {
        results.push({
          source_candidate_id:
            candidate.id,

          title:
            candidate.title,

          staged:
            false,

          reason:
            "INSUFFICIENT_EVIDENCE",

          confidence:
            synthesis.confidence,

          evidence_sufficient:
            synthesis.evidence_sufficient,

          verified_evidence_url_count:
            verifiedEvidenceUrls.length,

          consulted_url_count:
            consultedUrls.size,

          openai_response_id:
            response.id,

          evidence_summary:
            clean(
              synthesis.evidence_summary,
              3000,
            ),
        });

        continue;
      }

      const supportedConcepts =
        synthesis
          .supported_concepts
          .map(
            (
              concept,
            ) =>
              clean(
                concept,
                500,
              ),
          )
          .filter(Boolean);

      const limitations =
        synthesis.limitations
          .map(
            (
              limitation,
            ) =>
              clean(
                limitation,
                1000,
              ),
          )
          .filter(Boolean);

      /*
       * This is the text that becomes candidate
       * Muse knowledge.
       *
       * It is original synthesis rather than
       * copied source material.
       */
      const curatedText =
        [
          `# ${clean(
            synthesis.knowledge_title,
            500,
          )}`,

          "",

          `Muse: ${job.muse_key}`,

          `Candidate version: ${job.candidate_version}`,

          "",

          "## Source",

          `${candidate.title}${
            candidate.author
              ? ` â€” ${candidate.author}`
              : ""
          }`,

          candidate.publisher
            ? `Publisher: ${candidate.publisher}`
            : "",

          `Canonical source: ${candidate.source_url}`,

          "",

          "## Supported Concepts",

          ...supportedConcepts.map(
            (
              concept,
            ) =>
              `- ${concept}`,
          ),

          "",

          "## Knowledge Synthesis",

          knowledgeText,

          "",

          "## Evidence Basis",

          clean(
            synthesis.evidence_summary,
            4000,
          ),

          "",

          "## Evidence Consulted",

          ...verifiedEvidenceUrls.map(
            (
              url,
            ) =>
              `- ${url}`,
          ),

          "",

          "## Limitations",

          ...(
            limitations.length
              ? limitations
              : [
                  `Use as one evidence source among the broader ${job.muse_key} knowledge base.`,
                ]
          ).map(
            (
              limitation,
            ) =>
              `- ${limitation}`,
          ),

          "",

          `Evidence confidence: ${synthesis.confidence}/100`,

          "",

          "This document is an original iDreamMusic synthesis for candidate evaluation. It is not copied source text.",
        ]
          .filter(
            (
              value,
            ) =>
              value !==
              null &&
              value !==
              undefined,
          )
          .join("\n");

      const staged =
        await stageCandidateKnowledge({
          supabase,
          openai,
          agentJobId:
            jobId,

          sourceCandidateId:
            candidate.id,

          curatedText,

          createdByUserId:
            initiatedByUserId,
        });

      results.push({
        source_candidate_id:
          candidate.id,

        title:
          candidate.title,

        staged:
          true,

        evidence_confidence:
          synthesis.confidence,

        supported_concepts:
          supportedConcepts,

        evidence_urls:
          verifiedEvidenceUrls,

        consulted_url_count:
          consultedUrls.size,

        openai_response_id:
          response.id,

        source_id:
          staged.sourceId,

        document_id:
          staged.documentId,

        chunk_count:
          staged.chunkCount,

        already_staged:
          staged.alreadyStaged,
      });
    }

    const stagedResults =
      results.filter(
        (
          result,
        ) =>
          result.staged ===
          true,
      );

    const skippedResults =
      results.filter(
        (
          result,
        ) =>
          result.staged !==
          true,
      );

    if (
      !stagedResults.length
    ) {
      throw new Error(
        "Knowledge Ingestion Agent could not stage any evidence-supported candidate knowledge.",
      );
    }

    const report = {
      agent:
        "knowledge-ingestion-agent-v1",

      model,

      muse_key:
        job.muse_key,

      candidate_version:
        job.candidate_version,

      accepted_source_count:
        acceptedCandidates.length,

      staged_source_count:
        stagedResults.length,

      skipped_source_count:
        skippedResults.length,

      total_chunk_count:
        stagedResults.reduce(
          (
            total,
            result,
          ) =>
            total +
            Number(
              result.chunk_count ??
              0,
            ),
          0,
        ),

      staged_source_ids:
        stagedResults.map(
          (
            result,
          ) =>
            result.source_candidate_id,
        ),

      skipped_sources:
        skippedResults,

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
          "KNOWLEDGE_INGESTION_REPORT",

        artifact_version:
          1,

        created_by_agent:
          "KNOWLEDGE_INGESTION",

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
          "STAGED",

        current_agent:
          null,

        last_error:
          null,

        result_summary: {
          ...existingSummary,

          knowledge_ingestion:
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
          "KNOWLEDGE_INGESTION_COMPLETED",

        actor_type:
          "AGENT",

        actor_name:
          "knowledge-ingestion-agent-v1",

        from_status:
          "STAGING",

        to_status:
          "STAGED",

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
        : "Unknown Knowledge Ingestion Agent error.";

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
          "KNOWLEDGE_INGESTION_FAILED",

        actor_type:
          "AGENT",

        actor_name:
          "knowledge-ingestion-agent-v1",

        from_status:
          "STAGING",

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
