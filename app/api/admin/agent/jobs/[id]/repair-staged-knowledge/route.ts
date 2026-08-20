import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  getAgentAdminClient,
  requireAgentAdmin,
  AgentAuthorizationError,
} from "@/lib/agentic/project-adapters";
import {
  chunkKnowledgeDocument,
  contentHash,
  normalizeKnowledgeText,
} from "@/lib/muses/knowledge-chunking";
import {
  embedKnowledgeTexts,
  knowledgeEmbeddingModel,
} from "@/lib/muses/knowledge";

export const runtime = "nodejs";
export const maxDuration = 300;

type JsonRecord = Record<string, any>;

function record(value: unknown): JsonRecord {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export async function POST(
  request: Request,
  { params }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { user } =
      await requireAgentAdmin(request);

    const { id } = await params;
    const supabase =
      getAgentAdminClient() as any;

    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("agent_jobs")
      .select(
        "id,muse_key,candidate_version,status,result_summary",
      )
      .eq("id", id)
      .single();

    if (jobError || !job) {
      throw new Error(
        jobError?.message ||
          "Agent job could not be found.",
      );
    }

    if (job.status !== "STAGED") {
      return NextResponse.json(
        {
          status: "error",
          message:
            `Staged-knowledge repair is only allowed while a job is STAGED. ` +
            `Job ${id} is ${job.status}.`,
        },
        { status: 409 },
      );
    }

    const {
      count: validationCount,
      error: validationError,
    } = await supabase
      .from("validation_runs")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("job_id", id);

    if (validationError) {
      throw new Error(
        `Could not inspect validation state: ${validationError.message}`,
      );
    }

    if ((validationCount ?? 0) > 0) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Validation has already begun for this job. Refusing to alter its candidate retrieval set.",
        },
        { status: 409 },
      );
    }

    const {
      data: documents,
      error: documentError,
    } = await supabase
      .from("muse_knowledge_documents")
      .select(
        "id,source_id,title,document_text,metadata,curation_status,candidate_version",
      )
      .eq("agent_job_id", id)
      .eq("curation_status", "draft")
      .order("title", {
        ascending: true,
      });

    if (documentError) {
      throw new Error(
        `Could not load staged candidate documents: ${documentError.message}`,
      );
    }

    if (!documents?.length) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "No draft candidate documents were found for this staged job.",
        },
        { status: 409 },
      );
    }

    const sourceIds = [
      ...new Set(
        documents.map(
          (document: any) =>
            String(document.source_id),
        ),
      ),
    ];

    const {
      data: sources,
      error: sourceError,
    } = await supabase
      .from("muse_knowledge_sources")
      .select(
        "id,bibliographic_citation,source_locator",
      )
      .in("id", sourceIds);

    if (sourceError) {
      throw new Error(
        `Could not load candidate source metadata: ${sourceError.message}`,
      );
    }

    const sourceById =
      new Map<string, any>(
        (sources ?? []).map(
          (source: any) => [
            String(source.id),
            source,
          ],
        ),
      );

    const openai =
      new OpenAI({
        apiKey:
          process.env.OPENAI_API_KEY,
      });

    const repairedDocuments:
      Array<Record<string, unknown>> =
      [];

    let totalChunkCount = 0;

    for (const document of documents) {
      const source =
        sourceById.get(
          String(document.source_id),
        );

      if (!source) {
        throw new Error(
          `Candidate document ${document.id} has no source row.`,
        );
      }

      const originalText =
        String(
          document.document_text ??
            "",
        );

      const normalizedText =
        normalizeKnowledgeText(
          originalText,
        );

      if (!normalizedText) {
        throw new Error(
          `Candidate document ${document.id} contains no usable text.`,
        );
      }

      const citationText =
        String(
          source
            .bibliographic_citation ??
            document.title ??
            "",
        ).trim();

      const sourceLocator =
        source.source_locator
          ? String(
              source.source_locator,
            )
          : null;

      const drafts =
        chunkKnowledgeDocument({
          text: normalizedText,
          citationText,
          sourceLocator,
          documentTitle:
            String(
              document.title ??
                "",
            ),
        });

      if (!drafts.length) {
        throw new Error(
          `Candidate document ${document.id} produced no repaired chunks.`,
        );
      }

      /*
       * Embeddings are prepared before any existing chunk rows
       * are changed. This repair does not rerun research,
       * curation, or knowledge synthesis.
       */
      const embeddings =
        await embedKnowledgeTexts({
          openai,
          texts:
            drafts.map(
              (draft) =>
                [
                  draft.heading ||
                    "",
                  draft.content,
                ]
                  .filter(Boolean)
                  .join("\n\n"),
            ),
        });

      if (
        embeddings.length !==
        drafts.length
      ) {
        throw new Error(
          `Embedding count mismatch for candidate document ${document.id}.`,
        );
      }

      const {
        data: existingChunks,
        error: chunkReadError,
      } = await supabase
        .from(
          "muse_knowledge_chunks",
        )
        .select(
          "id,chunk_index,metadata",
        )
        .eq(
          "document_id",
          document.id,
        )
        .order("chunk_index", {
          ascending: true,
        });

      if (chunkReadError) {
        throw new Error(
          `Could not load existing chunks for ${document.id}: ${chunkReadError.message}`,
        );
      }

      const oldChunks =
        existingChunks ?? [];

      const embeddedAt =
        new Date().toISOString();

      const baseMetadata = {
        ...record(
          document.metadata,
        ),
        ingestion_version:
          "agent-v1.1",
        chunking_version:
          "semantic-v2",
        rechunked_at:
          embeddedAt,
        rechunked_by:
          user.id,
      };

      /*
       * Convergent replacement:
       * update rows that already exist, add only additional
       * rows if needed, then remove surplus old rows last.
       * A retry safely converges to the same candidate set.
       */
      for (
        let index = 0;
        index < drafts.length;
        index += 1
      ) {
        const draft =
          drafts[index];

        const row = {
          source_id:
            document.source_id,
          document_id:
            document.id,
          owner_user_id:
            null,
          muse_slug:
            job.muse_key,
          chunk_index:
            draft.chunkIndex,
          heading:
            draft.heading,
          content:
            draft.content,
          content_origin:
            "curated_paraphrase",
          source_locator:
            draft.sourceLocator,
          citation_text:
            draft.citationText,
          token_estimate:
            draft.tokenEstimate,
          content_hash:
            draft.contentHash,
          metadata:
            baseMetadata,
          embedding:
            embeddings[index],
          embedding_model:
            knowledgeEmbeddingModel(),
          embedded_at:
            embeddedAt,
        };

        const existing =
          oldChunks[index];

        if (existing) {
          const {
            error: updateError,
          } = await supabase
            .from(
              "muse_knowledge_chunks",
            )
            .update(row)
            .eq(
              "id",
              existing.id,
            );

          if (updateError) {
            throw new Error(
              `Could not update repaired chunk ${existing.id}: ${updateError.message}`,
            );
          }
        } else {
          const {
            error: insertError,
          } = await supabase
            .from(
              "muse_knowledge_chunks",
            )
            .insert(row);

          if (insertError) {
            throw new Error(
              `Could not insert repaired chunk for ${document.id}: ${insertError.message}`,
            );
          }
        }
      }

      if (
        oldChunks.length >
        drafts.length
      ) {
        const surplusIds =
          oldChunks
            .slice(
              drafts.length,
            )
            .map(
              (chunk: any) =>
                chunk.id,
            );

        const {
          error: deleteError,
        } = await supabase
          .from(
            "muse_knowledge_chunks",
          )
          .delete()
          .in(
            "id",
            surplusIds,
          );

        if (deleteError) {
          throw new Error(
            `Could not remove surplus chunks for ${document.id}: ${deleteError.message}`,
          );
        }
      }

      const {
        error: documentUpdateError,
      } = await supabase
        .from(
          "muse_knowledge_documents",
        )
        .update({
          document_text:
            normalizedText,
          content_hash:
            contentHash(
              normalizedText,
            ),
          metadata:
            baseMetadata,
        })
        .eq(
          "id",
          document.id,
        );

      if (documentUpdateError) {
        throw new Error(
          `Could not normalize candidate document ${document.id}: ${documentUpdateError.message}`,
        );
      }

      totalChunkCount +=
        drafts.length;

      repairedDocuments.push({
        document_id:
          document.id,
        title:
          document.title,
        old_chunk_count:
          oldChunks.length,
        new_chunk_count:
          drafts.length,
        normalized_text_changed:
          normalizedText !==
          originalText,
      });
    }

    const existingSummary =
      record(
        job.result_summary,
      );

    const ingestionSummary =
      record(
        existingSummary
          .knowledge_ingestion,
      );

    const repairedAt =
      new Date().toISOString();

    const {
      error: jobUpdateError,
    } = await supabase
      .from("agent_jobs")
      .update({
        result_summary: {
          ...existingSummary,
          knowledge_ingestion: {
            ...ingestionSummary,
            total_chunk_count:
              totalChunkCount,
            chunking_version:
              "semantic-v2",
            rechunked_at:
              repairedAt,
            rechunked_by:
              user.id,
            rechunked_documents:
              repairedDocuments,
          },
        },
      })
      .eq("id", id)
      .eq("status", "STAGED");

    if (jobUpdateError) {
      throw new Error(
        `Could not update Agent staging summary: ${jobUpdateError.message}`,
      );
    }

    const {
      error: auditError,
    } = await supabase
      .from(
        "agent_audit_events",
      )
      .insert({
        job_id: id,
        event_type:
          "KNOWLEDGE_CHUNKING_REPAIRED",
        actor_type:
          "HUMAN",
        actor_name:
          user.email ??
          user.id,
        from_status:
          "STAGED",
        to_status:
          "STAGED",
        payload: {
          candidate_version:
            job.candidate_version,
          chunking_version:
            "semantic-v2",
          document_count:
            documents.length,
          total_chunk_count:
            totalChunkCount,
          repaired_documents:
            repairedDocuments,
          production_changed:
            false,
        },
      });

    if (auditError) {
      throw new Error(
        `Could not write chunk-repair audit event: ${auditError.message}`,
      );
    }

    return NextResponse.json({
      status: "success",
      jobId: id,
      jobStatus: "STAGED",
      candidateVersion:
        job.candidate_version,
      chunkingVersion:
        "semantic-v2",
      documentCount:
        documents.length,
      totalChunkCount,
      repairedDocuments,
      productionChanged: false,
      researchRerun: false,
      curationRerun: false,
      synthesisRerun: false,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Staged knowledge could not be repaired.";

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
          status:
            error.status,
        },
      );
    }

    console.error(
      "Staged-knowledge repair error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      { status: 500 },
    );
  }
}
