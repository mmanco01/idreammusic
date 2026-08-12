import OpenAI from "openai";
import { randomUUID } from "node:crypto";

import {
  chunkKnowledgeDocument,
  contentHash,
} from "@/lib/muses/knowledge-chunking";

import {
  embedKnowledgeTexts,
  knowledgeEmbeddingModel,
} from "@/lib/muses/knowledge";

function cleanText(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function sourceKey(
  title: string,
) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return `${slug || "source"}-${randomUUID().slice(0, 8)}`;
}

export type StageCandidateKnowledgeInput = {
  supabase: any;
  openai: OpenAI;

  agentJobId: string;
  sourceCandidateId: string;

  curatedText: string;

  createdByUserId: string;
};

export type StageCandidateKnowledgeResult = {
  sourceId: string;
  documentId: string;
  sourceCandidateId: string;
  agentJobId: string;
  museSlug: string;
  candidateVersion: string;
  chunkCount: number;
  alreadyStaged: boolean;
};

export async function stageCandidateKnowledge({
  supabase,
  openai,
  agentJobId,
  sourceCandidateId,
  curatedText,
  createdByUserId,
}: StageCandidateKnowledgeInput): Promise<StageCandidateKnowledgeResult> {
  const text =
    cleanText(
      curatedText,
      120000,
    );

  if (!text) {
    throw new Error(
      "Candidate staging requires curated source notes.",
    );
  }

  /*
   * Governance check #1:
   * This job must really exist and must currently
   * be in a state where candidate ingestion is allowed.
   */
  const {
    data: job,
    error: jobError,
  } = await supabase
    .from("agent_jobs")
    .select(
      "id,muse_key,candidate_version,status",
    )
    .eq("id", agentJobId)
    .single();

  if (jobError || !job) {
    throw new Error(
      jobError?.message ||
        "The Agent job could not be found.",
    );
  }

  if (
    ![
      "CURATED",
      "STAGING",
    ].includes(job.status)
  ) {
    throw new Error(
      `Agent job ${agentJobId} is ${job.status}; candidate knowledge may only be staged from CURATED or STAGING.`,
    );
  }

  /*
   * Governance check #2:
   * The source must have passed Curation.
   */
  const {
    data: sourceCandidate,
    error: sourceCandidateError,
  } = await supabase
    .from("source_candidates")
    .select("*")
    .eq("id", sourceCandidateId)
    .eq("job_id", agentJobId)
    .single();

  if (
    sourceCandidateError ||
    !sourceCandidate
  ) {
    throw new Error(
      sourceCandidateError?.message ||
        "The source candidate could not be found for this Agent job.",
    );
  }

  const {
    data: curationDecision,
    error: curationError,
  } = await supabase
    .from("curation_decisions")
    .select(
      "id,decision,rationale,created_at",
    )
    .eq(
      "source_candidate_id",
      sourceCandidateId,
    )
    .eq(
      "job_id",
      agentJobId,
    )
    .eq(
      "decision",
      "ACCEPT",
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (
    curationError ||
    !curationDecision
  ) {
    throw new Error(
      curationError?.message ||
        "This source has not been accepted by the Curation Agent.",
    );
  }

  /*
   * Idempotency:
   * Agent retries must not create duplicate candidate
   * documents for the same source candidate.
   */
  const {
    data: existingDocument,
    error: existingError,
  } = await supabase
    .from(
      "muse_knowledge_documents",
    )
    .select(
      "id,source_id,metadata",
    )
    .eq(
      "agent_job_id",
      agentJobId,
    )
    .contains(
      "metadata",
      {
        source_candidate_id:
          sourceCandidateId,
      },
    )
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Could not check existing candidate knowledge: ${existingError.message}`,
    );
  }

  if (existingDocument) {
    const {
      count,
      error: countError,
    } = await supabase
      .from(
        "muse_knowledge_chunks",
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq(
        "document_id",
        existingDocument.id,
      );

    if (countError) {
      throw new Error(
        countError.message,
      );
    }

    return {
      sourceId:
        String(
          existingDocument.source_id,
        ),
      documentId:
        String(
          existingDocument.id,
        ),
      sourceCandidateId,
      agentJobId,
      museSlug:
        String(job.muse_key),
      candidateVersion:
        String(
          job.candidate_version,
        ),
      chunkCount:
        count ?? 0,
      alreadyStaged: true,
    };
  }

  const metadata =
    sourceCandidate.metadata &&
    typeof sourceCandidate.metadata ===
      "object"
      ? sourceCandidate.metadata
      : {};

  const title =
    cleanText(
      sourceCandidate.title,
      300,
    );

  if (!title) {
    throw new Error(
      "The curated source has no title.",
    );
  }

  const author =
    cleanText(
      sourceCandidate.author,
      300,
    );

  const publisher =
    cleanText(
      sourceCandidate.publisher,
      300,
    );

  const publicationDate =
    cleanText(
      sourceCandidate.publication_date,
      40,
    );

  const citation =
    cleanText(
      (metadata as any)
        .bibliographic_citation,
      1200,
    ) ||
    [
      author || "Unknown creator",
      title,
      publisher,
      publicationDate,
    ]
      .filter(Boolean)
      .join(". ");

  const now =
    new Date().toISOString();

  /*
   * Candidate sources remain provisional.
   * The DOCUMENT approval gate controls production retrieval.
   */
  const sourceRow = {
    source_key:
      sourceKey(title),

    muse_slug:
      job.muse_key,

    owner_user_id:
      null,

    scope:
      "global",

    source_type:
      cleanText(
        sourceCandidate.source_type,
        80,
      ) ||
      "agent_research",

    title,

    author_creator:
      author || null,

    tradition:
      cleanText(
        (metadata as any).tradition,
        200,
      ) || null,

    canonical_url:
      cleanText(
        sourceCandidate.source_url,
        1200,
      ) || null,

    bibliographic_citation:
      citation,

    source_locator:
      cleanText(
        (metadata as any)
          .source_locator,
        500,
      ) || null,

    evidence_classification:
      cleanText(
        (metadata as any)
          .evidence_classification,
        80,
      ) ||
      "agent_curated_evidence",

    rights_status:
      cleanText(
        sourceCandidate.rights_status,
        80,
      ) ||
      "UNKNOWN",

    rights_note:
      cleanText(
        (metadata as any)
          .rights_note,
        1000,
      ) || null,

    verification_status:
      "provisional",

    source_quality:
      3,

    provenance_notes:
      cleanText(
        (metadata as any)
          .provenance_notes,
        2000,
      ) ||
      "Researched and accepted through the governed iDreamMusic Agent pipeline.",

    provenance_json: {
      ingestion_version:
        "agent-v1",

      ingested_at:
        now,

      ingested_by:
        createdByUserId,

      agent_job_id:
        agentJobId,

      source_candidate_id:
        sourceCandidateId,

      curation_decision_id:
        curationDecision.id,

      candidate_version:
        job.candidate_version,
    },

    is_active:
      true,

    created_by:
      createdByUserId,

    approved_by:
      null,

    approved_at:
      null,
  };

  const {
    data: source,
    error: sourceError,
  } = await supabase
    .from(
      "muse_knowledge_sources",
    )
    .insert(
      sourceRow,
    )
    .select("*")
    .single();

  if (
    sourceError ||
    !source
  ) {
    throw new Error(
      sourceError?.message ||
        "The Agent candidate source could not be created.",
    );
  }

  try {
    const documentHash =
      contentHash(text);

    const {
      data: document,
      error: documentError,
    } = await supabase
      .from(
        "muse_knowledge_documents",
      )
      .insert({
        source_id:
          source.id,

        owner_user_id:
          null,

        document_key:
          `agent-${sourceCandidateId}`,

        title,

        section_label:
          sourceRow.source_locator,

        language_code:
          "en",

        content_kind:
          "curated_note",

        document_text:
          text,

        content_hash:
          documentHash,

        metadata: {
          ingestion_version:
            "agent-v1",

          agent_job_id:
            agentJobId,

          source_candidate_id:
            sourceCandidateId,

          candidate_version:
            job.candidate_version,
        },

        /*
         * THIS is the safety boundary.
         * Production search sees approved documents only.
         */
        curation_status:
          "draft",

        approved_by:
          null,

        approved_at:
          null,

        agent_job_id:
          agentJobId,

        candidate_version:
          job.candidate_version,
      })
      .select("*")
      .single();

    if (
      documentError ||
      !document
    ) {
      throw new Error(
        documentError?.message ||
          "The Agent candidate document could not be created.",
      );
    }

    const drafts =
      chunkKnowledgeDocument({
        text,
        citationText:
          citation,
        sourceLocator:
          sourceRow.source_locator,
      });

    if (!drafts.length) {
      throw new Error(
        "Candidate knowledge produced no chunks.",
      );
    }

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
        "Candidate embedding count did not match the chunk count.",
      );
    }

    const embeddedAt =
      new Date().toISOString();

    const chunkRows =
      drafts.map(
        (
          draft,
          index,
        ) => ({
          source_id:
            source.id,

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

          metadata: {
            ingestion_version:
              "agent-v1",

            agent_job_id:
              agentJobId,

            source_candidate_id:
              sourceCandidateId,

            candidate_version:
              job.candidate_version,
          },

          embedding:
            embeddings[index],

          embedding_model:
            knowledgeEmbeddingModel(),

          embedded_at:
            embeddedAt,
        }),
      );

    const {
      error: chunkError,
    } = await supabase
      .from(
        "muse_knowledge_chunks",
      )
      .insert(
        chunkRows,
      );

    if (chunkError) {
      throw new Error(
        chunkError.message,
      );
    }

    return {
      sourceId:
        String(source.id),

      documentId:
        String(document.id),

      sourceCandidateId,

      agentJobId,

      museSlug:
        String(job.muse_key),

      candidateVersion:
        String(
          job.candidate_version,
        ),

      chunkCount:
        chunkRows.length,

      alreadyStaged:
        false,
    };
  } catch (error) {
    /*
     * Existing ingestion already relies on deleting the source
     * to clean up dependent candidate material.
     */
    await supabase
      .from(
        "muse_knowledge_sources",
      )
      .delete()
      .eq(
        "id",
        source.id,
      );

    throw error;
  }
}
