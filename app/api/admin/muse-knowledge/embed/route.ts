import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import {
  embedKnowledgeTexts,
  knowledgeEmbeddingModel,
} from "@/lib/muses/knowledge";

export const runtime = "nodejs";
export const maxDuration = 300;

type EmbedRequest = {
  museSlug?: unknown;
  batch?: unknown;
  limit?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function cleanLimit(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.max(
    1,
    Math.min(100, Math.floor(parsed)),
  );
}

function allowedAdminEmails(): Set<string> {
  return new Set(
    (process.env.MUSE_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function POST(request: Request) {
  const supabase =
    await createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        status: "error",
        message: "Supabase is not available.",
      },
      { status: 500 },
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error(
      "Muse knowledge embedding authentication error:",
      authError,
    );
  }

  if (!user) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "Please sign in to embed Muse knowledge.",
      },
      { status: 401 },
    );
  }

  // This endpoint writes shared knowledge vectors, so it is stricter
  // than the temporary Muse IQ runner's any-signed-in-user rule.
  const adminEmails = allowedAdminEmails();
  const userEmail =
    user.email?.trim().toLowerCase() ?? "";

  if (
    !adminEmails.size ||
    !userEmail ||
    !adminEmails.has(userEmail)
  ) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "You are not authorized to embed Muse knowledge.",
      },
      { status: 403 },
    );
  }

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

  try {
    const body =
      (await request.json()) as EmbedRequest;

    const museSlug = cleanString(
      body.museSlug,
      50,
    );
    const batch = cleanString(
      body.batch,
      100,
    );
    const limit = cleanLimit(body.limit);

    if (!museSlug || !batch) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Both museSlug and batch are required.",
        },
        { status: 400 },
      );
    }

    let chunkQuery = (supabase as any)
      .from("muse_knowledge_chunks")
      .select(
        "id, content, muse_slug, metadata, created_at",
      )
      .eq("muse_slug", museSlug)
      .contains("metadata", {
        batch,
      })
      .is("embedding", null)
      .order("created_at", {
        ascending: true,
      })
      .limit(limit);

    const {
      data: chunkRows,
      error: chunkError,
    } = await chunkQuery;

    if (chunkError) {
      throw new Error(
        `Could not load unembedded knowledge chunks: ${chunkError.message}`,
      );
    }

    const chunks = chunkRows ?? [];

    if (!chunks.length) {
      return NextResponse.json({
        status: "success",
        museSlug,
        batch,
        requested: 0,
        embedded: 0,
        failed: 0,
        remaining: 0,
        embeddingModel:
          knowledgeEmbeddingModel(),
        message:
          "No unembedded chunks matched this Muse and batch.",
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const embeddingModel =
      knowledgeEmbeddingModel();
    const embeddedAt =
      new Date().toISOString();

    const failures: Array<{
      chunkId: string;
      message: string;
    }> = [];

    let embeddedCount = 0;
    const embeddingBatchSize = 20;

    for (
      let start = 0;
      start < chunks.length;
      start += embeddingBatchSize
    ) {
      const slice = chunks.slice(
        start,
        start + embeddingBatchSize,
      );

      const vectors =
        await embedKnowledgeTexts({
          openai,
          texts: slice.map(
            (chunk: any) =>
              String(chunk.content),
          ),
        });

      if (vectors.length !== slice.length) {
        throw new Error(
          `Embedding count mismatch: expected ${slice.length}, received ${vectors.length}.`,
        );
      }

      for (
        let index = 0;
        index < slice.length;
        index += 1
      ) {
        const chunk = slice[index];
        const embedding = vectors[index];

        try {
          const {
            data: updated,
            error: updateError,
          } = await (supabase as any)
            .from("muse_knowledge_chunks")
            .update({
              embedding,
              embedding_model:
                embeddingModel,
              embedded_at: embeddedAt,
            })
            .eq("id", chunk.id)
            .eq("muse_slug", museSlug)
            .contains("metadata", {
              batch,
            })
            .is("embedding", null)
            .select("id")
            .maybeSingle();

          if (updateError) {
            throw new Error(
              updateError.message,
            );
          }

          if (!updated) {
            throw new Error(
              "The chunk was not updated. It may already have been embedded or may be blocked by row-level security.",
            );
          }

          embeddedCount += 1;
        } catch (error) {
          failures.push({
            chunkId: String(chunk.id),
            message:
              error instanceof Error
                ? error.message
                : "Unknown chunk update error.",
          });
        }
      }
    }

    const {
      count: remaining,
      error: remainingError,
    } = await (supabase as any)
      .from("muse_knowledge_chunks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("muse_slug", museSlug)
      .contains("metadata", {
        batch,
      })
      .is("embedding", null);

    if (remainingError) {
      console.error(
        "Unable to count remaining unembedded chunks:",
        remainingError.message,
      );
    }

    return NextResponse.json({
      status:
        failures.length
          ? "partial"
          : "success",
      museSlug,
      batch,
      requested: chunks.length,
      embedded: embeddedCount,
      failed: failures.length,
      remaining:
        remaining ?? null,
      embeddingModel,
      failures,
    });
  } catch (error) {
    console.error(
      "Muse knowledge embedding error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Muse knowledge could not be embedded.",
      },
      { status: 500 },
    );
  }
}
