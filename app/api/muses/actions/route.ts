import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MuseTaskProposal } from "@/lib/muses/intelligence";

export const runtime = "nodejs";

type MuseActionRequest = {
  action?: unknown;
  messageId?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function parseProposedTask(
  structuredResult: unknown,
): MuseTaskProposal | null {
  if (!isRecord(structuredResult)) {
    return null;
  }

  const proposedTask =
    structuredResult.proposedTask;

  if (!isRecord(proposedTask)) {
    return null;
  }

  const title = cleanString(
    proposedTask.title,
    240,
  );
  const description = cleanString(
    proposedTask.description,
    4000,
  );
  const rawPriority = Number(
    proposedTask.priority,
  );
  const priority = Number.isFinite(
    rawPriority,
  )
    ? Math.min(
        5,
        Math.max(1, Math.round(rawPriority)),
      )
    : 3;

  if (!title) {
    return null;
  }

  return {
    title,
    description,
    priority,
  };
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as MuseActionRequest;

    const action = cleanString(
      body.action,
      30,
    );
    const messageId = cleanString(
      body.messageId,
      100,
    );

    if (
      action !== "create_task" &&
      action !== "dismiss_task"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Muse action must be create_task or dismiss_task.",
        },
        { status: 400 },
      );
    }

    if (!messageId) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "A Muse message ID is required.",
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
            "Please sign in to manage Muse actions.",
        },
        { status: 401 },
      );
    }

    const { data: message, error: messageError } =
      await (supabase as any)
        .from("muse_messages")
        .select(
          "id, conversation_id, owner_user_id, song_id, muse_slug, role, structured_result",
        )
        .eq("id", messageId)
        .eq("owner_user_id", user.id)
        .eq("role", "assistant")
        .maybeSingle();

    if (messageError) {
      throw new Error(messageError.message);
    }

    if (!message) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "The Muse response could not be found.",
        },
        { status: 404 },
      );
    }

    const proposedTask = parseProposedTask(
      message.structured_result,
    );

    if (!proposedTask) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "This Muse response does not contain a valid proposed task.",
        },
        { status: 400 },
      );
    }

    const { data: existingAction } = await (
      supabase as any
    )
      .from("muse_task_actions")
      .select("status, task_id")
      .eq("source_message_id", messageId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (
      action === "create_task" &&
      existingAction?.status === "created"
    ) {
      return NextResponse.json({
        status: "success",
        taskAction: {
          status: "created",
          taskId: existingAction.task_id,
        },
      });
    }

    if (action === "dismiss_task") {
      const { error } = await (
        supabase as any
      )
        .from("muse_task_actions")
        .upsert(
          {
            conversation_id:
              message.conversation_id,
            source_message_id: message.id,
            owner_user_id: user.id,
            song_id: message.song_id,
            muse_slug:
              message.muse_slug ?? "polyhymnia",
            status: "dismissed",
            proposed_task: proposedTask,
            task_id: null,
          },
          {
            onConflict: "source_message_id",
          },
        );

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        status: "success",
        taskAction: {
          status: "dismissed",
          taskId: null,
        },
      });
    }

    const { data: conversation, error: conversationError } =
      await (supabase as any)
        .from("muse_conversations")
        .select(
          "current_song_version_id, current_analysis_run_id",
        )
        .eq("id", message.conversation_id)
        .eq("owner_user_id", user.id)
        .maybeSingle();

    if (conversationError) {
      throw new Error(conversationError.message);
    }

    const { data: task, error: taskError } = await (
      supabase as any
    )
      .from("song_tasks")
      .insert({
        song_id: message.song_id,
        song_version_id:
          conversation?.current_song_version_id ?? null,
        analysis_run_id:
          conversation?.current_analysis_run_id ?? null,
        title: proposedTask.title,
        description: proposedTask.description,
        status: "open",
        priority: proposedTask.priority,
        sort_order: 0,
        created_by: user.id,
      })
      .select(
        "id, title, description, status, priority",
      )
      .single();

    if (taskError || !task) {
      throw new Error(
        taskError?.message ||
          "The proposed task could not be created.",
      );
    }

    const { error: actionError } = await (
      supabase as any
    )
      .from("muse_task_actions")
      .upsert(
        {
          conversation_id:
            message.conversation_id,
          source_message_id: message.id,
          owner_user_id: user.id,
          song_id: message.song_id,
          muse_slug:
            message.muse_slug ?? "polyhymnia",
          status: "created",
          proposed_task: proposedTask,
          task_id: task.id,
        },
        {
          onConflict: "source_message_id",
        },
      );

    if (actionError) {
      await (supabase as any)
        .from("song_tasks")
        .delete()
        .eq("id", task.id)
        .eq("created_by", user.id);

      throw new Error(actionError.message);
    }

    return NextResponse.json({
      status: "success",
      task,
      taskAction: {
        status: "created",
        taskId: task.id,
      },
    });
  } catch (error) {
    console.error(
      "Muse action route error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The Muse action could not be completed.",
      },
      { status: 500 },
    );
  }
}
