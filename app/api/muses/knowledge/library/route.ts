import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const museSlug =
      url.searchParams.get("museSlug")?.trim() ||
      "polyhymnia";

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

    const sourceResult = await (supabase as any)
      .from("muse_knowledge_sources")
      .select(
        "id, source_key, muse_slug, scope, source_type, title, author_creator, editor_translator, tradition, historical_period, publication_year, publisher, canonical_url, bibliographic_citation, source_locator, evidence_classification, rights_status, rights_note, verification_status, source_quality, provenance_notes, curation_notes, is_active, updated_at",
      )
      .eq("muse_slug", museSlug)
      .order("source_type", {
        ascending: true,
      })
      .order("title", {
        ascending: true,
      });

    if (sourceResult.error) {
      throw new Error(
        sourceResult.error.message,
      );
    }

    const sourceIds = (
      sourceResult.data ?? []
    ).map((source: any) => source.id);

    const [
      documentResult,
      chunkResult,
    ] = await Promise.all([
      sourceIds.length > 0
        ? (supabase as any)
            .from("muse_knowledge_documents")
            .select(
              "id, source_id, curation_status",
            )
            .in("source_id", sourceIds)
            .eq(
              "curation_status",
              "approved",
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),

      (supabase as any)
        .from("muse_knowledge_chunks")
        .select(
          "id, source_id, embedding_model, embedded_at",
        )
        .eq("muse_slug", museSlug),
    ]);

    if (documentResult.error) {
      throw new Error(
        documentResult.error.message,
      );
    }

    if (chunkResult.error) {
      throw new Error(
        chunkResult.error.message,
      );
    }

    const documents =
      documentResult.data ?? [];
    const chunks =
      chunkResult.data ?? [];

    const documentCount =
      new Map<string, number>();
    const chunkCount =
      new Map<string, number>();
    const embeddedCount =
      new Map<string, number>();

    for (const document of documents) {
      documentCount.set(
        document.source_id,
        (documentCount.get(
          document.source_id,
        ) ?? 0) + 1,
      );
    }

    for (const chunk of chunks) {
      chunkCount.set(
        chunk.source_id,
        (chunkCount.get(
          chunk.source_id,
        ) ?? 0) + 1,
      );

      if (
        chunk.embedding_model &&
        chunk.embedded_at
      ) {
        embeddedCount.set(
          chunk.source_id,
          (embeddedCount.get(
            chunk.source_id,
          ) ?? 0) + 1,
        );
      }
    }

    const sources =
      (sourceResult.data ?? []).map(
        (source: any) => ({
          ...source,
          document_count:
            documentCount.get(
              source.id,
            ) ?? 0,
          chunk_count:
            chunkCount.get(
              source.id,
            ) ?? 0,
          embedded_chunk_count:
            embeddedCount.get(
              source.id,
            ) ?? 0,
        }),
      );

    return NextResponse.json({
      status: "success",
      stats: {
        sourceCount:
          sources.length,
        documentCount:
          documents.length,
        chunkCount:
          chunks.length,
        embeddedChunkCount:
          chunks.filter(
            (chunk: any) =>
              chunk.embedding_model &&
              chunk.embedded_at,
          ).length,
        pendingEmbeddingCount:
          chunks.filter(
            (chunk: any) =>
              !chunk.embedding_model ||
              !chunk.embedded_at,
          ).length,
      },
      sources,
    });
  } catch (error) {
    console.error(
      "Muse knowledge library error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The knowledge library could not be loaded.",
      },
      { status: 500 },
    );
  }
}
