import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  retrieveMuseKnowledge,
} from "@/lib/muses/knowledge";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SearchRequest = {
  query?: unknown;
  museSlug?: unknown;
  songId?: unknown;
  limit?: unknown;
  sourceTypes?: unknown;
  traditions?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function cleanStringArray(
  value: unknown,
  maxItems: number,
) {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .map((item) =>
      item.trim().slice(0, 100),
    )
    .filter(Boolean)
    .slice(0, maxItems);

  return items.length ? items : null;
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
      (await request.json()) as SearchRequest;

    const query = cleanString(
      body.query,
      12000,
    );

    const museSlug =
      cleanString(
        body.museSlug,
        50,
      ) || "polyhymnia";

    const songId =
      cleanString(
        body.songId,
        100,
      ) || null;

    const numericLimit =
      typeof body.limit === "number"
        ? body.limit
        : Number(body.limit ?? 8);

    if (!query) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Enter a knowledge-library search.",
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

    const openai = new OpenAI({
      apiKey:
        process.env.OPENAI_API_KEY,
    });

    const search =
      await retrieveMuseKnowledge({
        supabase,
        openai,
        query,
        museSlug,
        ownerUserId:
          user?.id ?? null,
        songId,
        queryContext:
          "Manual Polyhymnia Knowledge Library search",
        matchCount:
          Number.isFinite(numericLimit)
            ? Math.max(
                1,
                Math.min(
                  20,
                  numericLimit,
                ),
              )
            : 8,
        sourceTypes:
          cleanStringArray(
            body.sourceTypes,
            12,
          ),
        traditions:
          cleanStringArray(
            body.traditions,
            12,
          ),
      });

    return NextResponse.json({
      status: "success",
      searchId: search.searchId,
      results: search.results,
    });
  } catch (error) {
    console.error(
      "Muse knowledge search error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The knowledge library could not be searched.",
      },
      { status: 500 },
    );
  }
}
