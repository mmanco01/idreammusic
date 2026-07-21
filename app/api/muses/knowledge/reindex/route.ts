import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  embedKnowledgeTexts,
  knowledgeEmbeddingModel,
} from "@/lib/muses/knowledge";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ReindexRequest = {
  museSlug?: unknown;
  batchSize?: unknown;
  force?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
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
      (await request.json()
        .catch(() => ({}))) as ReindexRequest;

    const museSlug =
      cleanString(
        body.museSlug,
        50,
      ) || "polyhymnia";

    const rawBatchSize =
      typeof body.batchSize === "number"
        ? body.batchSize
        : Number(
            body.batchSize ?? 20,
          );

    const batchSize =
      Number.isFinite(rawBatchSize)
        ? Math.max(
            1,
            Math.min(
              40,
              rawBatchSize,
            ),
          )
        : 20;

    const force =
      body.force === true;

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
            "Please sign in to embed the knowledge library.",
        },
        { status: 401 },
      );
    }

    let query = (supabase as any)
      .from("muse_knowledge_chunks")
      .select(
        "id, heading, content, embedding_model, embedded_at",
      )
      .eq("muse_slug", museSlug)
      .order("created_at", {
        ascending: true,
      })
      .limit(batchSize);

    if (!force) {
      query = query.is(
        "embedded_at",
        null,
      );
    }

    const { data: chunks, error } =
      await query;

    if (error) {
      throw new Error(error.message);
    }

    if (!chunks?.length) {
      return NextResponse.json({
        status: "success",
        processed: 0,
        message:
          "No pending knowledge chunks remain.",
      });
    }

    const openai = new OpenAI({
      apiKey:
        process.env.OPENAI_API_KEY,
    });

    const texts = chunks.map(
      (chunk: any) =>
        [
          chunk.heading || "",
          chunk.content,
        ]
          .filter(Boolean)
          .join("\n\n"),
    );

    const embeddings =
      await embedKnowledgeTexts({
        openai,
        texts,
      });

    const embeddedAt =
      new Date().toISOString();

    const failures: string[] = [];

    for (
      let index = 0;
      index < chunks.length;
      index += 1
    ) {
      const chunk = chunks[index];
      const embedding =
        embeddings[index];

      if (!embedding) {
        failures.push(chunk.id);
        continue;
      }

      const { error: updateError } =
        await (supabase as any)
          .from(
            "muse_knowledge_chunks",
          )
          .update({
            embedding,
            embedding_model:
              knowledgeEmbeddingModel(),
            embedded_at: embeddedAt,
          })
          .eq("id", chunk.id);

      if (updateError) {
        failures.push(chunk.id);
        console.error(
          "Knowledge chunk embedding update failed:",
          updateError.message,
        );
      }
    }

    return NextResponse.json({
      status: "success",
      processed:
        chunks.length -
        failures.length,
      failed:
        failures.length,
      failedChunkIds:
        failures,
      model:
        knowledgeEmbeddingModel(),
    });
  } catch (error) {
    console.error(
      "Muse knowledge reindex error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The knowledge chunks could not be embedded.",
      },
      { status: 500 },
    );
  }
}
