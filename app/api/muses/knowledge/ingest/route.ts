import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  chunkKnowledgeDocument,
  contentHash,
} from "@/lib/muses/knowledge-chunking";
import {
  embedKnowledgeTexts,
  knowledgeEmbeddingModel,
} from "@/lib/muses/knowledge";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type IngestRequest = {
  title?: unknown;
  authorCreator?: unknown;
  tradition?: unknown;
  sourceType?: unknown;
  canonicalUrl?: unknown;
  bibliographicCitation?: unknown;
  sourceLocator?: unknown;
  evidenceClassification?: unknown;
  rightsStatus?: unknown;
  rightsNote?: unknown;
  provenanceNotes?: unknown;
  text?: unknown;
  scope?: unknown;
  museSlug?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
) {
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

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "OPENAI_API_KEY is not configured.",
        },
        { status: 500 },
      );
    }

    const body =
      (await request.json()) as IngestRequest;

    const title = cleanString(
      body.title,
      300,
    );

    const text = cleanString(
      body.text,
      120000,
    );

    const scope =
      cleanString(
        body.scope,
        20,
      ) === "global"
        ? "global"
        : "personal";

    const museSlug =
      cleanString(
        body.museSlug,
        50,
      ) || "polyhymnia";

    if (!title || !text) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "A source title and source text or curated notes are required.",
        },
        { status: 400 },
      );
    }

    const supabase =
      await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Supabase is not available.",
        },
        { status: 500 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Please sign in to add a knowledge source.",
        },
        { status: 401 },
      );
    }

    const citation =
      cleanString(
        body.bibliographicCitation,
        1200,
      ) ||
      `${cleanString(
        body.authorCreator,
        300,
      ) || "Unknown creator"}. ${title}.`;

    const sourceRow = {
      source_key:
        sourceKey(title),
      muse_slug: museSlug,
      owner_user_id:
        scope === "personal"
          ? user.id
          : null,
      scope,
      source_type:
        cleanString(
          body.sourceType,
          80,
        ) ||
        (scope === "personal"
          ? "personal_archive"
          : "editorial_framework"),
      title,
      author_creator:
        cleanString(
          body.authorCreator,
          300,
        ) || null,
      tradition:
        cleanString(
          body.tradition,
          200,
        ) || null,
      canonical_url:
        cleanString(
          body.canonicalUrl,
          1200,
        ) || null,
      bibliographic_citation:
        citation,
      source_locator:
        cleanString(
          body.sourceLocator,
          500,
        ) || null,
      evidence_classification:
        cleanString(
          body.evidenceClassification,
          80,
        ) ||
        (scope === "personal"
          ? "personal_source"
          : "editorial_synthesis"),
      rights_status:
        cleanString(
          body.rightsStatus,
          80,
        ) ||
        (scope === "personal"
          ? "user_owned"
          : "idreammusic_original"),
      rights_note:
        cleanString(
          body.rightsNote,
          1000,
        ) || null,
      verification_status:
        scope === "global"
          ? "provisional"
          : "verified",
      source_quality:
        scope === "global"
          ? 3
          : 5,
      provenance_notes:
        cleanString(
          body.provenanceNotes,
          2000,
        ) ||
        (scope === "personal"
          ? "Added by the authenticated songwriter as private personal source material."
          : "Added through the iDreamMusic knowledge ingestion interface."),
      provenance_json: {
        ingested_at:
          new Date().toISOString(),
        ingested_by: user.id,
        ingestion_version: "1.2",
      },
      is_active: true,
      created_by: user.id,
      approved_by:
        scope === "personal"
          ? user.id
          : null,
      approved_at:
        scope === "personal"
          ? new Date().toISOString()
          : null,
    };

    const {
      data: source,
      error: sourceError,
    } = await (supabase as any)
      .from(
        "muse_knowledge_sources",
      )
      .insert(sourceRow)
      .select("*")
      .single();

    if (sourceError || !source) {
      throw new Error(
        sourceError?.message ||
          "The knowledge source could not be created.",
      );
    }

    const documentHash =
      contentHash(text);

    const {
      data: document,
      error: documentError,
    } = await (supabase as any)
      .from(
        "muse_knowledge_documents",
      )
      .insert({
        source_id: source.id,
        owner_user_id:
          scope === "personal"
            ? user.id
            : null,
        document_key:
          "ingested-v1-2",
        title,
        section_label:
          sourceRow.source_locator,
        language_code: "en",
        content_kind:
          scope === "personal"
            ? "personal_text"
            : "curated_note",
        document_text: text,
        content_hash:
          documentHash,
        metadata: {
          ingestion_version: "1.2",
        },
        curation_status:
          scope === "personal"
            ? "approved"
            : "draft",
        approved_by:
          scope === "personal"
            ? user.id
            : null,
        approved_at:
          scope === "personal"
            ? new Date().toISOString()
            : null,
      })
      .select("*")
      .single();

    if (
      documentError ||
      !document
    ) {
      await (supabase as any)
        .from(
          "muse_knowledge_sources",
        )
        .delete()
        .eq("id", source.id);

      throw new Error(
        documentError?.message ||
          "The knowledge document could not be created.",
      );
    }

    const drafts =
      chunkKnowledgeDocument({
        text,
        citationText: citation,
        sourceLocator:
          sourceRow.source_locator,
      });

    const openai = new OpenAI({
      apiKey:
        process.env.OPENAI_API_KEY,
    });

    const embeddings =
      await embedKnowledgeTexts({
        openai,
        texts: drafts.map(
          (draft) =>
            [
              draft.heading || "",
              draft.content,
            ]
              .filter(Boolean)
              .join("\n\n"),
        ),
      });

    const now =
      new Date().toISOString();

    const rows = drafts.map(
      (draft, index) => ({
        source_id: source.id,
        document_id: document.id,
        owner_user_id:
          scope === "personal"
            ? user.id
            : null,
        muse_slug: museSlug,
        chunk_index:
          draft.chunkIndex,
        heading: draft.heading,
        content: draft.content,
        content_origin:
          scope === "personal"
            ? "personal_text"
            : "curated_paraphrase",
        source_locator:
          draft.sourceLocator,
        citation_text:
          draft.citationText,
        token_estimate:
          draft.tokenEstimate,
        content_hash:
          draft.contentHash,
        metadata: {
          ingestion_version: "1.2",
        },
        embedding:
          embeddings[index],
        embedding_model:
          knowledgeEmbeddingModel(),
        embedded_at: now,
      }),
    );

    const { error: chunkError } =
      await (supabase as any)
        .from(
          "muse_knowledge_chunks",
        )
        .insert(rows);

    if (chunkError) {
      await (supabase as any)
        .from(
          "muse_knowledge_sources",
        )
        .delete()
        .eq("id", source.id);

      throw new Error(
        chunkError.message,
      );
    }

    return NextResponse.json({
      status: "success",
      sourceId: source.id,
      documentId: document.id,
      chunkCount: rows.length,
      scope,
      curationStatus:
        scope === "personal"
          ? "approved"
          : "draft",
    });
  } catch (error) {
    console.error(
      "Muse knowledge ingestion error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The knowledge source could not be ingested.",
      },
      { status: 500 },
    );
  }
}
