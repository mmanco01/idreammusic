import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getMuseBySlug, MUSE_OPTIONS } from "@/lib/muses";
import {
  MUSE_INTELLIGENCE_TEXT_FORMAT,
  parseMuseIntelligenceOutput,
  type MuseIntelligenceResult,
} from "@/lib/muses/intelligence";
import {
  buildMuseContext,
  saveMuseContextSnapshot,
} from "@/lib/muses/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MuseChatMode = "chat" | "collaborate";

type MuseChatRequest = {
  mode?: unknown;
  museSlug?: unknown;
  message?: unknown;
  songId?: unknown;
  conversationId?: unknown;
  originalQuestion?: unknown;
  primaryMuseSlug?: unknown;
  collaboratorMuseSlug?: unknown;
  primaryResponse?: unknown;
};

type MuseMemoryActionRequest = {
  memoryId?: unknown;
  status?: unknown;
};

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function getOwnedSong(supabase: any, songId: string, userId: string) {
  const { data, error } = await supabase
    .from("songs")
    .select("id, slug, title_working, title_final, owner_user_id")
    .eq("id", songId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the song: ${error.message}`);
  }

  return data;
}

async function findConversation({
  supabase,
  userId,
  songId,
  museSlug,
  conversationId,
}: {
  supabase: any;
  userId: string;
  songId: string;
  museSlug: string;
  conversationId?: string;
}) {
  if (conversationId) {
    const { data, error } = await supabase
      .from("muse_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("owner_user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data;
  }

  const { data, error } = await supabase
    .from("muse_conversations")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("song_id", songId)
    .eq("primary_muse_slug", museSlug)
    .eq("status", "active")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function ensureConversation({
  supabase,
  userId,
  song,
  museSlug,
  conversationId,
}: {
  supabase: any;
  userId: string;
  song: any;
  museSlug: string;
  conversationId?: string;
}) {
  const existing = await findConversation({
    supabase,
    userId,
    songId: song.id,
    museSlug,
    conversationId,
  });

  if (existing) return existing;

  const title = song.title_final || song.title_working || "Untitled song";
  const muse = getMuseBySlug(museSlug);

  const { data, error } = await supabase
    .from("muse_conversations")
    .insert({
      owner_user_id: userId,
      song_id: song.id,
      primary_muse_slug: museSlug,
      title: `${title} with ${muse?.name ?? museSlug}`,
      status: "active",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not create the Muse conversation.");
  }

  return data;
}

async function insertMessage({
  supabase,
  conversationId,
  ownerUserId,
  songId,
  museSlug,
  role,
  kind,
  content,
  questionText,
  comparisonWith,
  structuredResult,
  modelName,
}: {
  supabase: any;
  conversationId: string;
  ownerUserId: string;
  songId: string;
  museSlug?: string | null;
  role: "user" | "assistant" | "system";
  kind: "primary" | "collaborator" | "synthesis" | "system";
  content: string;
  questionText?: string | null;
  comparisonWith?: string | null;
  structuredResult?: Record<string, unknown>;
  modelName?: string | null;
}) {
  const { data, error } = await supabase
    .from("muse_messages")
    .insert({
      conversation_id: conversationId,
      owner_user_id: ownerUserId,
      song_id: songId,
      muse_slug: museSlug ?? null,
      role,
      kind,
      content,
      question_text: questionText ?? null,
      comparison_with: comparisonWith ?? null,
      structured_result: structuredResult ?? {},
      model_name: modelName ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not save the Muse message.");
  }

  return data;
}

async function saveMemoryCandidates({
  supabase,
  result,
  conversationId,
  userId,
  songId,
  museSlug,
  sourceMessageId,
}: {
  supabase: any;
  result: MuseIntelligenceResult;
  conversationId: string;
  userId: string;
  songId: string;
  museSlug: string;
  sourceMessageId: string;
}) {
  if (!result.memoryCandidates.length) return [];

  const rows = result.memoryCandidates.map((memory) => ({
    conversation_id: conversationId,
    owner_user_id: userId,
    song_id: songId,
    muse_slug: museSlug,
    memory_type: memory.type,
    content: memory.content,
    reason: memory.reason,
    importance: memory.importance,
    confidence: memory.confidence,
    status: "proposed",
    source_message_id: sourceMessageId,
  }));

  const { data, error } = await supabase
    .from("muse_memories")
    .insert(rows)
    .select(
      "id, memory_type, content, reason, importance, confidence, status, source_message_id",
    );

  if (error) {
    console.error("Unable to save Muse memory candidates:", error.message);
    return [];
  }

  return data ?? [];
}

async function saveUnresolvedQuestions({
  supabase,
  result,
  conversationId,
  userId,
  songId,
  songVersionId,
  museSlug,
  sourceMessageId,
}: {
  supabase: any;
  result: MuseIntelligenceResult;
  conversationId: string;
  userId: string;
  songId: string;
  songVersionId?: string | null;
  museSlug: string;
  sourceMessageId: string;
}) {
  if (!result.unresolvedQuestions.length) return;

  const { data: existing } = await supabase
    .from("muse_unresolved_questions")
    .select("question")
    .eq("owner_user_id", userId)
    .eq("song_id", songId)
    .eq("muse_slug", museSlug)
    .eq("status", "open");

  const existingQuestions = new Set(
    (existing ?? []).map((row: any) =>
      String(row.question).trim().toLowerCase(),
    ),
  );

  const rows = result.unresolvedQuestions
    .filter(
      (question) => !existingQuestions.has(question.trim().toLowerCase()),
    )
    .map((question) => ({
      conversation_id: conversationId,
      owner_user_id: userId,
      song_id: songId,
      song_version_id: songVersionId ?? null,
      muse_slug: museSlug,
      question,
      priority: 3,
      status: "open",
      source_message_id: sourceMessageId,
    }));

  if (!rows.length) return;

  const { error } = await supabase
    .from("muse_unresolved_questions")
    .insert(rows);

  if (error) {
    console.error("Unable to save unresolved Muse questions:", error.message);
  }
}

async function updateConversationState({
  supabase,
  conversationId,
  context,
}: {
  supabase: any;
  conversationId: string;
  context: any;
}) {
  const { error } = await supabase
    .from("muse_conversations")
    .update({
      current_song_version_id: context.currentVersion?.id ?? null,
      current_transcript_id: context.latestTranscript?.id ?? null,
      current_analysis_run_id: context.latestAnalysis?.id ?? null,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) {
    console.error("Unable to update Muse conversation state:", error.message);
  }
}

function makeStructuredPrompt({
  context,
  question,
  museName,
  museDomain,
  mode,
  primaryMuseName,
  primaryMuseDomain,
  primaryResponse,
}: {
  context: unknown;
  question: string;
  museName: string;
  museDomain: string;
  mode: MuseChatMode;
  primaryMuseName?: string;
  primaryMuseDomain?: string;
  primaryResponse?: string;
}) {
  const collaborationSection =
    mode === "collaborate"
      ? `
The songwriter originally asked:

${question}

${primaryMuseName}, Muse of ${primaryMuseDomain}, responded:

${primaryResponse}

You are joining as ${museName}, Muse of ${museDomain}.
Give a genuinely different second perspective. Do not merely agree,
summarize, or restate the first Muse. Explain what your specialty notices
that the first Muse may not emphasize.

In the reply field, end with the exact heading:
"How my perspective differs from ${primaryMuseName}"
and explain the distinction in two to four sentences.
`
      : `
The songwriter says:

${question}

Respond as ${museName}, Muse of ${museDomain}.
`;

  return `
Here is the current private iDreamMusic context:

${JSON.stringify(context, null, 2)}

${collaborationSection}

Return the required structured Muse intelligence result.

Guidance for the structured fields:
- reply: the complete graceful response shown to the songwriter.
- primaryObservation: the single most important grounded observation.
- recommendations: no more than three focused recommendations.
- unresolvedQuestions: questions worth carrying into a future session.
- memoryCandidates: return no more than two. Include only a durable
  decision, preference, lyric/form choice, unresolved issue, or next step
  that would genuinely improve a future session. Do not save casual wording,
  repeated observations, or speculative claims.
- proposedTask: include only when one concrete task would clearly help.
- suggestedCollaborator: include only when another Muse has a specific,
  distinct contribution.
- lyricWork: include only when the songwriter asks about lyrics,
  transcription, reconstruction, or lyric alternatives. Clearly mark
  newly proposed language as muse_suggestion.
- formWork: include only when the songwriter asks about structure or
  when form is central to the recommendation.
- Ground evidence in the provided context. Never invent audio evidence.
- Distinguish the original transcript, existing lyrics, writer notes,
  analysis, prior decisions, and new Muse suggestions.
  `.trim();
}

function mapHistoryMessages(messages: any[], memories: any[]) {
  const memoriesByMessage = new Map<string, any[]>();

  for (const memory of memories) {
    if (!memory.source_message_id) continue;
    const current = memoriesByMessage.get(memory.source_message_id) ?? [];
    current.push(memory);
    memoriesByMessage.set(memory.source_message_id, current);
  }

  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    museSlug: message.muse_slug,
    kind: message.kind,
    question: message.question_text,
    comparisonWith: message.comparison_with,
    createdAt: message.created_at,
    structuredResult: message.structured_result,
    memories: memoriesByMessage.get(message.id) ?? [],
  }));
}

async function createMuseResponse({
  openai,
  model,
  muse,
  prompt,
}: {
  openai: OpenAI;
  model: string;
  muse: NonNullable<ReturnType<typeof getMuseBySlug>>;
  prompt: string;
}) {
  const response = await openai.responses.create({
    model,
    instructions: muse.systemPrompt,
    input: prompt,
    text: {
      format: MUSE_INTELLIGENCE_TEXT_FORMAT as any,
    },
    max_output_tokens: 2400,
    store: false,
  });

  const outputText = response.output_text?.trim();

  if (!outputText) {
    throw new Error(`${muse.name} did not return a response.`);
  }

  return parseMuseIntelligenceOutput(outputText);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const songId = cleanString(url.searchParams.get("songId"), 100);
    const museSlug = cleanString(url.searchParams.get("museSlug"), 50);

    if (!songId || !museSlug) {
      return NextResponse.json({
        status: "success",
        conversation: null,
        messages: [],
      });
    }

    const muse = getMuseBySlug(museSlug);

    if (!muse) {
      return NextResponse.json(
        { status: "error", message: "Unsupported Muse." },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { status: "error", message: "Supabase is not available." },
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
          message: "Please sign in to load this Muse conversation.",
        },
        { status: 401 },
      );
    }

    const song = await getOwnedSong(supabase, songId, user.id);

    if (!song) {
      return NextResponse.json(
        {
          status: "error",
          message: "The song was not found or does not belong to you.",
        },
        { status: 404 },
      );
    }

    const conversation = await findConversation({
      supabase,
      userId: user.id,
      songId,
      museSlug: muse.slug,
    });

    if (!conversation) {
      return NextResponse.json({
        status: "success",
        conversation: null,
        messages: [],
      });
    }

    const [messageResult, memoryResult] = await Promise.all([
      (supabase as any)
        .from("muse_messages")
        .select(
          "id, role, kind, muse_slug, content, question_text, comparison_with, structured_result, created_at",
        )
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true }),

      (supabase as any)
        .from("muse_memories")
        .select(
          "id, memory_type, content, reason, importance, confidence, status, source_message_id",
        )
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true }),
    ]);

    if (messageResult.error) throw new Error(messageResult.error.message);
    if (memoryResult.error) throw new Error(memoryResult.error.message);

    return NextResponse.json({
      status: "success",
      conversation: {
        id: conversation.id,
        title: conversation.title,
        museSlug: conversation.primary_muse_slug,
        lastMessageAt: conversation.last_message_at,
      },
      messages: mapHistoryMessages(
        messageResult.data ?? [],
        memoryResult.data ?? [],
      ),
    });
  } catch (error) {
    console.error("Muse chat history error:", error);

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The Muse conversation could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const conversationId = cleanString(
      url.searchParams.get("conversationId"),
      100,
    );

    if (!conversationId) {
      return NextResponse.json(
        { status: "error", message: "A conversation ID is required." },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { status: "error", message: "Supabase is not available." },
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
          message: "Please sign in to archive this Muse conversation.",
        },
        { status: 401 },
      );
    }

    const { error } = await (supabase as any)
      .from("muse_conversations")
      .update({ status: "archived" })
      .eq("id", conversationId)
      .eq("owner_user_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Muse conversation archive error:", error);

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The Muse conversation could not be archived.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body =
      (await request.json()) as MuseMemoryActionRequest;

    const memoryId = cleanString(
      body.memoryId,
      100,
    );

    const nextStatus = cleanString(
      body.status,
      30,
    );

    if (!memoryId) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "A Muse memory ID is required.",
        },
        { status: 400 },
      );
    }

    if (
      nextStatus !== "accepted" &&
      nextStatus !== "rejected"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Memory status must be accepted or rejected.",
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
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "Muse memory authentication error:",
        authError,
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Please sign in to manage Muse memory.",
        },
        { status: 401 },
      );
    }

    const {
      data: existingMemory,
      error: lookupError,
    } = await (supabase as any)
      .from("muse_memories")
      .select(
        "id, owner_user_id, memory_type, content, reason, importance, confidence, status",
      )
      .eq("id", memoryId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        `Could not load the proposed memory: ${lookupError.message}`,
      );
    }

    if (!existingMemory) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "This proposed memory could not be found. Refresh the page and try again.",
        },
        { status: 404 },
      );
    }

    const { data, error } = await (
      supabase as any
    )
      .from("muse_memories")
      .update({
        status: nextStatus,
        last_referenced_at:
          nextStatus === "accepted"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", memoryId)
      .eq("owner_user_id", user.id)
      .select(
        "id, memory_type, content, reason, importance, confidence, status",
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not update the proposed memory: ${error.message}`,
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "The proposed memory was not updated. Refresh the page and try again.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      status: "success",
      memory: data,
    });
  } catch (error) {
    console.error(
      "Muse memory update error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The Muse memory could not be updated.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { status: "error", message: "OPENAI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as MuseChatRequest;
    const mode: MuseChatMode =
      body.mode === "collaborate" ? "collaborate" : "chat";
    const songId = cleanString(body.songId, 100);
    const conversationId = cleanString(body.conversationId, 100);
    const message = cleanString(body.message, 16000);
    const originalQuestion = cleanString(body.originalQuestion, 8000);
    const primaryResponse = cleanString(body.primaryResponse, 24000);
    const primaryMuseSlug = cleanString(body.primaryMuseSlug, 50);
    const requestedMuseSlug =
      mode === "collaborate"
        ? cleanString(body.collaboratorMuseSlug, 50)
        : cleanString(body.museSlug, 50);

    const muse = getMuseBySlug(requestedMuseSlug);

    if (!muse) {
      return NextResponse.json(
        {
          status: "error",
          message: `Unsupported Muse. Available Muses: ${MUSE_OPTIONS.map(
            (option) => option.name,
          ).join(", ")}.`,
        },
        { status: 400 },
      );
    }

    let primaryMuse: ReturnType<typeof getMuseBySlug> = null;

    if (mode === "collaborate") {
      primaryMuse = getMuseBySlug(primaryMuseSlug);

      if (!primaryMuse) {
        return NextResponse.json(
          {
            status: "error",
            message: "The primary Muse could not be identified.",
          },
          { status: 400 },
        );
      }

      if (primaryMuse.slug === muse.slug) {
        return NextResponse.json(
          {
            status: "error",
            message: "Choose a different Muse for collaboration.",
          },
          { status: 400 },
        );
      }

      if (!originalQuestion || !primaryResponse) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "The original question and first Muse response are required for collaboration.",
          },
          { status: 400 },
        );
      }
    } else if (!message) {
      return NextResponse.json(
        { status: "error", message: `Please enter a message for ${muse.name}.` },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { status: "error", message: "Supabase is not available." },
        { status: 500 },
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Muse chat authentication error:", authError);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model =
      process.env.OPENAI_MUSE_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-5-mini";
    const question = mode === "collaborate" ? originalQuestion : message;

    /* General Muse chat remains stateless. */
    if (!songId) {
      const context = {
        selectedMuse: {
          slug: muse.slug,
          name: muse.name,
          domain: muse.domain,
          role: mode === "collaborate" ? "collaborator" : "primary",
        },
        song: null,
        acceptedMemories: [],
        recordedDecisions: [],
        unresolvedQuestions: [],
        changesSinceLastSession: [],
        knowledge: [],
      };

      const prompt = makeStructuredPrompt({
        context,
        question,
        museName: muse.name,
        museDomain: muse.domain,
        mode,
        primaryMuseName: primaryMuse?.name,
        primaryMuseDomain: primaryMuse?.domain,
        primaryResponse,
      });

      const result = await createMuseResponse({
        openai,
        model,
        muse,
        prompt,
      });

      return NextResponse.json({
        status: "success",
        mode,
        conversationId: null,
        muse: {
          slug: muse.slug,
          name: muse.name,
          domain: muse.domain,
          isPrimaryMuse: false,
        },
        primaryMuse: primaryMuse
          ? {
              slug: primaryMuse.slug,
              name: primaryMuse.name,
              domain: primaryMuse.domain,
            }
          : null,
        song: null,
        reply: result.reply,
        intelligence: result,
        memories: [],
      });
    }

    if (!user) {
      return NextResponse.json(
        {
          status: "error",
          message: "Please sign in before discussing a saved song.",
        },
        { status: 401 },
      );
    }

    const song = await getOwnedSong(supabase, songId, user.id);

    if (!song) {
      return NextResponse.json(
        {
          status: "error",
          message: "The song was not found or does not belong to you.",
        },
        { status: 404 },
      );
    }

    const conversationMuseSlug =
      mode === "collaborate" && primaryMuse ? primaryMuse.slug : muse.slug;

    const conversation = await ensureConversation({
      supabase,
      userId: user.id,
      song,
      museSlug: conversationMuseSlug,
      conversationId: conversationId || undefined,
    });

    const isPrimaryMuse = conversation.primary_muse_slug === muse.slug;
    const role =
      mode === "collaborate"
        ? "collaborator"
        : isPrimaryMuse
          ? "primary"
          : "specialist";

    const context = await buildMuseContext({
      supabase,
      userId: user.id,
      songId,
      conversationId: conversation.id,
      muse,
      role,
    });

    if (!context) {
      return NextResponse.json(
        { status: "error", message: "The song context could not be loaded." },
        { status: 404 },
      );
    }

    if (mode === "chat") {
      await insertMessage({
        supabase,
        conversationId: conversation.id,
        ownerUserId: user.id,
        songId,
        museSlug: null,
        role: "user",
        kind: "primary",
        content: message,
        questionText: message,
      });
    }

    const prompt = makeStructuredPrompt({
      context,
      question,
      museName: muse.name,
      museDomain: muse.domain,
      mode,
      primaryMuseName: primaryMuse?.name,
      primaryMuseDomain: primaryMuse?.domain,
      primaryResponse,
    });

    const result = await createMuseResponse({
      openai,
      model,
      muse,
      prompt,
    });

    const assistantMessage = await insertMessage({
      supabase,
      conversationId: conversation.id,
      ownerUserId: user.id,
      songId,
      museSlug: muse.slug,
      role: "assistant",
      kind: mode === "collaborate" ? "collaborator" : "primary",
      content: result.reply,
      questionText: question,
      comparisonWith: mode === "collaborate" ? primaryMuse?.name ?? null : null,
      structuredResult: result as unknown as Record<string, unknown>,
      modelName: model,
    });

    const memories = await saveMemoryCandidates({
      supabase,
      result,
      conversationId: conversation.id,
      userId: user.id,
      songId,
      museSlug: muse.slug,
      sourceMessageId: assistantMessage.id,
    });

    await saveUnresolvedQuestions({
      supabase,
      result,
      conversationId: conversation.id,
      userId: user.id,
      songId,
      songVersionId: context.currentVersion?.id ?? null,
      museSlug: muse.slug,
      sourceMessageId: assistantMessage.id,
    });

    await updateConversationState({
      supabase,
      conversationId: conversation.id,
      context,
    });

    await saveMuseContextSnapshot({
      supabase,
      userId: user.id,
      conversationId: conversation.id,
      museSlug: muse.slug,
      context,
    });

    return NextResponse.json({
      status: "success",
      mode,
      conversationId: conversation.id,
      muse: {
        slug: muse.slug,
        name: muse.name,
        domain: muse.domain,
        isPrimaryMuse,
      },
      primaryMuse: primaryMuse
        ? {
            slug: primaryMuse.slug,
            name: primaryMuse.name,
            domain: primaryMuse.domain,
          }
        : null,
      song: {
        id: song.id,
        slug: song.slug,
        title: song.title_final || song.title_working || "Untitled song",
      },
      reply: result.reply,
      intelligence: result,
      memories,
    });
  } catch (error) {
    console.error("Muse chat route error:", error);

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "The Muse could not respond.",
      },
      { status: 500 },
    );
  }
}
