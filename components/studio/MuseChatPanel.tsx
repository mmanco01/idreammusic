"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  isMuseIntelligenceResult,
  type MuseIntelligenceResult,
} from "@/lib/muses/intelligence";
import type {
  MuseKnowledgeCitation,
} from "@/lib/muses/knowledge-types";
import {
  MuseIntelligenceDetails,
  type MuseTaskActionState,
} from "@/components/studio/MuseIntelligenceDetails";
import { MuseAudioBridgeCard } from "@/components/studio/MuseAudioBridgeCard";
import {
  MuseCouncilOverview,
  type MuseCouncilEntry,
} from "@/components/studio/MuseCouncilOverview";
import { AnalysisLoadingState, AnimatedDots } from "@/components/ui/AnalysisLoadingState";

export type MuseChatOption = {
  slug: string;
  name: string;
  domain: string;
  label: string;
  greeting: string;
  starterQuestions: readonly string[];
};

type Props = {
  defaultMuseSlug: string;
  hasAssignedMuse?: boolean;
  initialMuseSlug?: string;
  initialQuestion?: string;
  museOptions: readonly MuseChatOption[];
  songId?: string;
  songTitle?: string;
  lockedMuse?: boolean;
};

type MemoryCandidate = {
  id: string;
  memory_type: string;
  content: string;
  reason: string | null;
  importance: number;
  confidence: number | null;
  status:
    | "proposed"
    | "accepted"
    | "rejected"
    | "superseded";
  source_message_id?: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  museSlug?: string;
  museName?: string;
  kind?: "primary" | "collaborator";
  question?: string;
  comparisonWith?: string;
  memories?: MemoryCandidate[];
  intelligence?: MuseIntelligenceResult;
  taskAction?: MuseTaskActionState;
  knowledgeCitations?: MuseKnowledgeCitation[];
};

type MuseChatResponse = {
  status?: string;
  message?: string;
  reply?: string;
  mode?: "chat" | "collaborate";
  conversationId?: string | null;
  messageId?: string | null;
  muse?: {
    slug?: string;
    name?: string;
    domain?: string;
    isPrimaryMuse?: boolean;
  };
  primaryMuse?: {
    slug?: string;
    name?: string;
    domain?: string;
  } | null;
  intelligence?: unknown;
  memories?: MemoryCandidate[];
  taskAction?: MuseTaskActionState;
  knowledgeCitations?: MuseKnowledgeCitation[];
};

type MuseCouncilResponse = {
  status?: string;
  message?: string;
  councilEntries?: Array<{
    id: string;
    museSlug: string;
    museName: string;
    domain: string;
    kind: "primary" | "collaborator" | "synthesis" | "system";
    content: string;
    question?: string | null;
    comparisonWith?: string | null;
    structuredResult?: unknown;
    createdAt: string;
  }>;
};

type MuseHistoryResponse = {
  status?: string;
  message?: string;
  conversation?: {
    id: string;
    title?: string;
    museSlug?: string;
    lastMessageAt?: string;
  } | null;
  messages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    museSlug?: string | null;
    kind?: "primary" | "collaborator";
    question?: string | null;
    comparisonWith?: string | null;
    structuredResult?: unknown;
    memories?: MemoryCandidate[];
    taskAction?: MuseTaskActionState;
    knowledgeCitations?: MuseKnowledgeCitation[];
  }>;
};

function createMessageId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function memoryLabel(type: string) {
  const labels: Record<string, string> = {
    observation: "Creative observation",
    decision: "Creative decision",
    accepted_suggestion: "Accepted suggestion",
    rejected_suggestion: "Rejected idea",
    songwriter_preference: "Songwriter preference",
    muse_recommendation: "Current Muse recommendation",
    question_to_confirm: "Question to confirm",
    unresolved_question: "Unresolved question",
    next_step: "Next step",
    lyric_choice: "Lyric choice",
    form_choice: "Song form choice",
    collaboration_note: "Muse collaboration note",
  };

  return labels[type] ?? "Muse memory";
}

function memoryAcceptLabel(
  type: string,
) {
  const labels: Record<string, string> = {
    decision: "Confirm decision",
    accepted_suggestion:
      "Confirm accepted idea",
    rejected_suggestion:
      "Confirm rejection",
    songwriter_preference:
      "Confirm preference",
    muse_recommendation:
      "Accept recommendation",
    question_to_confirm:
      "Keep as open question",
    lyric_choice:
      "Confirm lyric choice",
    form_choice:
      "Confirm form choice",
  };

  return (
    labels[type] ??
    "Keep for future sessions"
  );
}

function compactResponseSummary(message: ChatMessage) {
  const source =
    message.intelligence?.primaryObservation.statement ||
    message.intelligence?.recommendations[0]?.title ||
    message.content;
  const clean = source.replace(/\s+/g, " ").trim();
  const firstSentence =
    clean.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? clean;

  if (firstSentence.length <= 145) {
    return firstSentence;
  }

  return `${firstSentence
    .slice(0, 145)
    .replace(/\s+\S*$/, "")}…`;
}

function messageRecommendedMove(message: ChatMessage) {
  const recommendation =
    message.intelligence?.recommendations.find(
      (item) => item.priority === "now",
    ) ?? message.intelligence?.recommendations[0];

  return recommendation?.title ?? null;
}

export function MuseChatPanel({
  defaultMuseSlug,
  hasAssignedMuse = true,
  initialMuseSlug,
  initialQuestion,
  museOptions,
  songId,
  songTitle,
  lockedMuse = false,
}: Props) {
  const safeDefaultMuse =
    museOptions.find(
      (option) => option.slug === defaultMuseSlug,
    ) ?? museOptions[0];

  const safeInitialMuse =
    museOptions.find((option) => option.slug === initialMuseSlug) ??
    safeDefaultMuse;

  const [selectedMuseSlug, setSelectedMuseSlug] =
    useState(
      safeInitialMuse?.slug ?? "calliope",
    );
  const [hasExplicitMuseSelection, setHasExplicitMuseSelection] = useState(
    Boolean(hasAssignedMuse || initialMuseSlug),
  );
  const [conversationId, setConversationId] =
    useState<string | null>(null);
  const [messages, setMessages] =
    useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialQuestion ?? "");
  const [status, setStatus] = useState<
    "idle" | "sending" | "error"
  >("idle");
  const [historyStatus, setHistoryStatus] =
    useState<
      "idle" | "loading" | "error"
    >("idle");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [memoryActionIds, setMemoryActionIds] =
    useState<string[]>([]);
  const [taskActionMessageIds, setTaskActionMessageIds] =
    useState<string[]>([]);
  const [collaborationSourceId, setCollaborationSourceId] =
    useState<string | null>(null);
  const [collaboratorMuseSlug, setCollaboratorMuseSlug] =
    useState("");
  const [collaborationStatus, setCollaborationStatus] =
    useState<
      "idle" | "sending" | "error"
    >("idle");
  const [collaborationError, setCollaborationError] =
    useState("");
  const [councilEntries, setCouncilEntries] =
    useState<MuseCouncilEntry[]>([]);
  const [councilStatus, setCouncilStatus] =
    useState<"idle" | "loading" | "error">("idle");
  const [councilRefreshKey, setCouncilRefreshKey] =
    useState(0);

  useEffect(() => {
    if (!initialMuseSlug) return;

    const nextMuse = museOptions.find(
      (option) => option.slug === initialMuseSlug,
    );

    if (!nextMuse) return;

    setHasExplicitMuseSelection(true);

    if (nextMuse.slug === selectedMuseSlug) return;

    setSelectedMuseSlug(nextMuse.slug);
    setMessages([]);
    setConversationId(null);
    setStatus("idle");
    setErrorMessage("");
  }, [initialMuseSlug, museOptions, selectedMuseSlug]);

  useEffect(() => {
    if (initialQuestion?.trim()) {
      setInput(initialQuestion.trim());
    }
  }, [initialQuestion]);

  const selectedMuse =
    museOptions.find(
      (option) => option.slug === selectedMuseSlug,
    ) ?? safeDefaultMuse;

  const isInitialRecommendedMuse = Boolean(
    initialMuseSlug && selectedMuse?.slug === initialMuseSlug,
  );

  const museNameBySlug = useMemo(
    () =>
      new Map(
        museOptions.map((option) => [
          option.slug,
          option.name,
        ]),
      ),
    [museOptions],
  );

  const isSongConversation = Boolean(songId);
  const needsMuseChoice = Boolean(
    isSongConversation && !hasAssignedMuse && !hasExplicitMuseSelection,
  );
  const isPrimaryMuse =
    selectedMuse?.slug === safeDefaultMuse?.slug;
  const isBusy =
    status === "sending" ||
    collaborationStatus === "sending" ||
    historyStatus === "loading";
  const canSend =
    input.trim().length > 0 && !isBusy;
  const latestAssistantMessageId =
    [...messages]
      .reverse()
      .find((message) => message.role === "assistant")?.id ?? null;

  const conversationContext = useMemo(
    () =>
      messages
        .slice(-8)
        .map((message) => {
          const speaker =
            message.role === "user"
              ? "Songwriter"
              : message.museName ||
                selectedMuse?.name ||
                "Muse";

          return `${speaker}: ${message.content}`;
        })
        .join("\n\n"),
    [messages, selectedMuse?.name],
  );

  useEffect(() => {
    if (!songId || !selectedMuseSlug) {
      return;
    }

    const activeSongId = songId;
    let cancelled = false;

    async function loadHistory() {
      setHistoryStatus("loading");
      setErrorMessage("");
      setMessages([]);
      setConversationId(null);

      try {
        const params = new URLSearchParams({
          songId: activeSongId,
          museSlug: selectedMuseSlug,
        });

        const response = await fetch(
          `/api/muses/chat?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | MuseHistoryResponse
            | null;

        if (
          !response.ok ||
          result?.status !== "success"
        ) {
          throw new Error(
            result?.message ||
              "The saved Muse conversation could not be loaded.",
          );
        }

        if (cancelled) {
          return;
        }

        setConversationId(
          result.conversation?.id ?? null,
        );

        setMessages(
          (result.messages ?? []).map(
            (message) => {
              const intelligence =
                isMuseIntelligenceResult(
                  message.structuredResult,
                )
                  ? message.structuredResult
                  : undefined;

              return {
                id: message.id,
                role: message.role,
                content: message.content,
                museSlug:
                  message.museSlug ?? undefined,
                museName: message.museSlug
                  ? museNameBySlug.get(
                      message.museSlug,
                    )
                  : undefined,
                kind: message.kind,
                question:
                  message.question ?? undefined,
                comparisonWith:
                  message.comparisonWith ?? undefined,
                memories: message.memories ?? [],
                intelligence,
                taskAction:
                  message.taskAction ?? null,
                knowledgeCitations:
                  message.knowledgeCitations ?? [],
              };
            },
          ),
        );

        setHistoryStatus("idle");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setHistoryStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The saved Muse conversation could not be loaded.",
        );
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [
    songId,
    selectedMuseSlug,
    museNameBySlug,
  ]);

  useEffect(() => {
    if (!songId) {
      setCouncilEntries([]);
      setCouncilStatus("idle");
      return;
    }

    const activeSongId = songId;
    let cancelled = false;

    async function loadCouncil() {
      setCouncilStatus("loading");

      try {
        const params = new URLSearchParams({
          songId: activeSongId,
          scope: "council",
        });

        const response = await fetch(
          `/api/muses/chat?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | MuseCouncilResponse
            | null;

        if (
          !response.ok ||
          result?.status !== "success"
        ) {
          throw new Error(
            result?.message ||
              "The Muse Council summary could not be loaded.",
          );
        }

        if (cancelled) {
          return;
        }

        setCouncilEntries(
          (result.councilEntries ?? []).map((entry) => ({
            id: entry.id,
            museSlug: entry.museSlug,
            museName: entry.museName,
            domain: entry.domain,
            kind: entry.kind,
            content: entry.content,
            question: entry.question ?? undefined,
            comparisonWith:
              entry.comparisonWith ?? undefined,
            createdAt: entry.createdAt,
            intelligence: isMuseIntelligenceResult(
              entry.structuredResult,
            )
              ? entry.structuredResult
              : undefined,
          })),
        );
        setCouncilStatus("idle");
      } catch {
        if (cancelled) {
          return;
        }

        setCouncilStatus("error");
      }
    }

    void loadCouncil();

    return () => {
      cancelled = true;
    };
  }, [songId, councilRefreshKey]);

  function clearInteractionState() {
    setInput("");
    setStatus("idle");
    setErrorMessage("");
    setCollaborationSourceId(null);
    setCollaboratorMuseSlug("");
    setCollaborationStatus("idle");
    setCollaborationError("");
  }

  function changeMuse(nextMuseSlug: string) {
    clearInteractionState();
    setHasExplicitMuseSelection(true);
    setSelectedMuseSlug(nextMuseSlug);
    setMessages([]);
    setConversationId(null);
  }

  function openMuseFromCouncil(nextMuseSlug: string) {
    if (nextMuseSlug !== selectedMuseSlug) {
      changeMuse(nextMuseSlug);
    }

    window.setTimeout(() => {
      const questionField = document.getElementById(
        "muse-message",
      ) as HTMLTextAreaElement | null;

      questionField?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      questionField?.focus({ preventScroll: true });
    }, nextMuseSlug === selectedMuseSlug ? 0 : 180);
  }


  function prepareQuestion(question: string) {
    setInput(question);

    window.setTimeout(() => {
      const questionField = document.getElementById(
        "muse-message",
      ) as HTMLTextAreaElement | null;

      questionField?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      questionField?.focus({ preventScroll: true });
    }, 0);
  }

  async function startNewConversation() {
    if (isBusy) {
      return;
    }

    if (songId && conversationId) {
      try {
        const params = new URLSearchParams({
          conversationId,
        });

        const response = await fetch(
          `/api/muses/chat?${params.toString()}`,
          { method: "DELETE" },
        );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | {
                status?: string;
                message?: string;
              }
            | null;

        if (
          !response.ok ||
          result?.status !== "success"
        ) {
          throw new Error(
            result?.message ||
              "The previous conversation could not be archived.",
          );
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The previous conversation could not be archived.",
        );

        return;
      }
    }

    clearInteractionState();
    setConversationId(null);
    setMessages([]);
    setCouncilRefreshKey((current) => current + 1);
  }

  function getFirstAvailableCollaborator(
    primaryMuseSlug: string,
  ) {
    return (
      museOptions.find(
        (option) =>
          option.slug !== primaryMuseSlug,
      )?.slug ?? ""
    );
  }

  function openCollaboration(
    message: ChatMessage,
  ) {
    if (!message.museSlug) {
      return;
    }

    setCollaborationSourceId(message.id);
    setCollaboratorMuseSlug(
      getFirstAvailableCollaborator(
        message.museSlug,
      ),
    );
    setCollaborationStatus("idle");
    setCollaborationError("");
  }

  function closeCollaboration() {
    if (
      collaborationStatus === "sending"
    ) {
      return;
    }

    setCollaborationSourceId(null);
    setCollaboratorMuseSlug("");
    setCollaborationStatus("idle");
    setCollaborationError("");
  }

  async function sendMessage(
    rawMessage: string,
  ) {
    const message = rawMessage.trim();

    if (
      !message ||
      isBusy ||
      !selectedMuse
    ) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: message,
      question: message,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);
    setInput("");
    setStatus("sending");
    setErrorMessage("");
    setCollaborationSourceId(null);
    setCollaborationError("");

    try {
      const requestMessage =
        !songId && conversationContext
          ? `Continue this songwriting conversation:\n\n${conversationContext}\n\nSongwriter: ${message}`
          : message;

      const response = await fetch(
        "/api/muses/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            mode: "chat",
            museSlug: selectedMuse.slug,
            message: requestMessage,
            ...(songId ? { songId } : {}),
            ...(conversationId
              ? { conversationId }
              : {}),
          }),
        },
      );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | MuseChatResponse
          | null;

      if (
        !response.ok ||
        result?.status !== "success" ||
        !result.reply?.trim()
      ) {
        throw new Error(
          result?.message ||
            `${selectedMuse.name} could not respond. Request failed with status ${response.status}.`,
        );
      }

      const intelligence =
        isMuseIntelligenceResult(
          result.intelligence,
        )
          ? result.intelligence
          : undefined;

      setConversationId(
        result.conversationId ??
          conversationId,
      );

      setMessages((current) => [
        ...current,
        {
          id:
            result.messageId ||
            createMessageId(),
          role: "assistant",
          content: result.reply!.trim(),
          museSlug:
            result.muse?.slug ||
            selectedMuse.slug,
          museName:
            result.muse?.name ||
            selectedMuse.name,
          kind: "primary",
          question: message,
          memories: result.memories ?? [],
          intelligence,
          taskAction:
            result.taskAction ?? null,
          knowledgeCitations:
            result.knowledgeCitations ?? [],
        },
      ]);

      setCouncilRefreshKey((current) => current + 1);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : `${selectedMuse.name} could not respond.`,
      );
    }
  }

  async function requestCollaboration(
    sourceMessage: ChatMessage,
    requestedMuseSlug?: string,
  ) {
    const targetMuseSlug =
      requestedMuseSlug ||
      collaboratorMuseSlug;

    if (
      !sourceMessage.museSlug ||
      !sourceMessage.museName ||
      !sourceMessage.question ||
      !targetMuseSlug ||
      collaborationStatus === "sending"
    ) {
      return;
    }

    const collaborator =
      museOptions.find(
        (option) =>
          option.slug === targetMuseSlug,
      );

    if (!collaborator) {
      setCollaborationStatus("error");
      setCollaborationError(
        "Choose a Muse to invite.",
      );
      return;
    }

    setCollaborationSourceId(
      sourceMessage.id,
    );
    setCollaboratorMuseSlug(
      collaborator.slug,
    );
    setCollaborationStatus("sending");
    setCollaborationError("");

    try {
      const response = await fetch(
        "/api/muses/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            mode: "collaborate",
            primaryMuseSlug:
              sourceMessage.museSlug,
            collaboratorMuseSlug:
              collaborator.slug,
            originalQuestion:
              sourceMessage.question,
            primaryResponse:
              sourceMessage.content,
            ...(songId ? { songId } : {}),
            ...(conversationId
              ? { conversationId }
              : {}),
          }),
        },
      );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | MuseChatResponse
          | null;

      if (
        !response.ok ||
        result?.status !== "success" ||
        !result.reply?.trim()
      ) {
        throw new Error(
          result?.message ||
            `${collaborator.name} could not join the conversation. Request failed with status ${response.status}.`,
        );
      }

      const intelligence =
        isMuseIntelligenceResult(
          result.intelligence,
        )
          ? result.intelligence
          : undefined;

      setConversationId(
        result.conversationId ??
          conversationId,
      );

      setMessages((current) => [
        ...current,
        {
          id:
            result.messageId ||
            createMessageId(),
          role: "assistant",
          content: result.reply!.trim(),
          museSlug:
            result.muse?.slug ||
            collaborator.slug,
          museName:
            result.muse?.name ||
            collaborator.name,
          kind: "collaborator",
          question:
            sourceMessage.question,
          comparisonWith:
            sourceMessage.museName,
          memories: result.memories ?? [],
          intelligence,
          taskAction:
            result.taskAction ?? null,
          knowledgeCitations:
            result.knowledgeCitations ?? [],
        },
      ]);

      setCouncilRefreshKey((current) => current + 1);
      setCollaborationStatus("idle");
      setCollaborationSourceId(null);
      setCollaboratorMuseSlug("");
    } catch (error) {
      setCollaborationStatus("error");
      setCollaborationError(
        error instanceof Error
          ? error.message
          : `${collaborator.name} could not join the conversation.`,
      );
    }
  }

  async function updateMemory(
    memoryId: string,
    nextStatus: "accepted" | "rejected",
  ) {
    if (
      memoryActionIds.includes(memoryId)
    ) {
      return;
    }

    setMemoryActionIds((current) => [
      ...current,
      memoryId,
    ]);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/muses/chat",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            memoryId,
            status: nextStatus,
          }),
        },
      );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              status?: string;
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        result?.status !== "success"
      ) {
        throw new Error(
          result?.message ||
            `The Muse memory update failed with status ${response.status}.`,
        );
      }

      setMessages((current) =>
        current.map((message) => ({
          ...message,
          memories:
            message.memories?.map(
              (memory) =>
                memory.id === memoryId
                  ? {
                      ...memory,
                      status: nextStatus,
                    }
                  : memory,
            ) ?? [],
        })),
      );
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Muse memory could not be updated.",
      );
    } finally {
      setMemoryActionIds((current) =>
        current.filter(
          (id) => id !== memoryId,
        ),
      );
    }
  }

  async function handleTaskAction(
    messageId: string,
    action:
      | "create_task"
      | "dismiss_task",
  ) {
    if (
      taskActionMessageIds.includes(
        messageId,
      )
    ) {
      return;
    }

    setTaskActionMessageIds((current) => [
      ...current,
      messageId,
    ]);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/muses/actions",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action,
            messageId,
          }),
        },
      );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              status?: string;
              message?: string;
              taskAction?: MuseTaskActionState;
            }
          | null;

      if (
        !response.ok ||
        result?.status !== "success" ||
        !result.taskAction
      ) {
        throw new Error(
          result?.message ||
            `The Muse task action failed with status ${response.status}.`,
        );
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                taskAction:
                  result.taskAction ?? null,
              }
            : message,
        ),
      );
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Muse task action could not be completed.",
      );
    } finally {
      setTaskActionMessageIds((current) =>
        current.filter(
          (id) => id !== messageId,
        ),
      );
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();

      if (canSend) {
        void sendMessage(input);
      }
    }
  }

  if (!selectedMuse) {
    return null;
  }

  return (
    <section
      id="muse-conversation"
      className="card muse-council-panel"
      style={{
        border:
          "1px solid rgba(220, 182, 92, 0.55)",
        background:
          "linear-gradient(145deg, rgba(137, 96, 31, 0.16), rgba(255,255,255,0.025))",
      }}
    >
      <div className="muse-council-panel__intro">
        <div>
          <div className="eyebrow">
            {isSongConversation
              ? !hasAssignedMuse
                ? isInitialRecommendedMuse
                  ? "Recommended Muse perspective"
                  : "Muse perspective"
                : isPrimaryMuse
                  ? "Lead Muse conversation"
                  : "Invited Muse perspective"
              : `Conversation with the Muse of ${selectedMuse.domain}`}
          </div>
          <h2 className="h2" style={{ marginBottom: "0.35rem" }}>
            {needsMuseChoice ? "Choose a Muse perspective" : <>Ask {selectedMuse.name}</>}
          </h2>
          <p className="copy" style={{ maxWidth: 760, marginBottom: 0 }}>
            {needsMuseChoice ? (
              <>
                No lead Muse is assigned yet. Choose a Muse when a particular creative
                perspective would help; choosing one here does not assign it as the
                song&apos;s lead Muse.
              </>
            ) : isSongConversation ? (
              <>
                <strong>{selectedMuse.name}</strong> listens through the lens of{" "}
                <strong>{selectedMuse.domain}</strong>. Ask one focused question; the
                Council will surface the clearest insight and next move first.
              </>
            ) : (
              <>
                <strong>{selectedMuse.name}</strong> is the Muse of{" "}
                <strong>{selectedMuse.domain}</strong>. {selectedMuse.label}.
              </>
            )}
          </p>
        </div>

        {isSongConversation ? (
          <span className="info-badge">
            {!hasAssignedMuse
              ? isInitialRecommendedMuse
                ? `${selectedMuse.name} is the current recommended creative partner`
                : "No lead Muse assigned"
              : isPrimaryMuse
                ? `${selectedMuse.name} is the lead Muse`
                : `${selectedMuse.name} is joining as a specialist`}
          </span>
        ) : null}
      </div>

      {isSongConversation && songId ? (
        <MuseCouncilOverview
          leadMuse={
            hasAssignedMuse ? (safeDefaultMuse ?? selectedMuse) : selectedMuse
          }
          activeMuse={selectedMuse}
          hasAssignedMuse={hasAssignedMuse}
          hasRecommendedMuse={isInitialRecommendedMuse}
          entries={councilEntries}
          status={councilStatus}
          onOpenMuse={openMuseFromCouncil}
        />
      ) : null}

      {isSongConversation && songId ? (
        <details className="council-disclosure council-tool-disclosure">
          <summary>Audio evidence available to the Muses</summary>
          <MuseAudioBridgeCard songId={songId} />
        </details>
      ) : null}

      {!lockedMuse ? (
        <details
          className="council-disclosure council-tool-disclosure"
          open={needsMuseChoice || undefined}
        >
          <summary>
            {needsMuseChoice ? "Choose a Muse perspective" : "Switch or invite a different Muse"}
          </summary>
          <div className="council-selector-panel">
            <label className="copy" htmlFor="muse-selector">
              Creative partner
            </label>
            <select
              id="muse-selector"
              className="input"
              value={needsMuseChoice ? "" : selectedMuse.slug}
              disabled={isBusy}
              onChange={(event) => {
                if (event.target.value) changeMuse(event.target.value);
              }}
              style={{ marginTop: "0.35rem" }}
            >
              {needsMuseChoice ? (
                <option value="" disabled>
                  Choose a Muse...
                </option>
              ) : null}
              {museOptions.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name} — {option.domain}
                  {hasAssignedMuse && option.slug === safeDefaultMuse?.slug
                    ? " (Lead Muse)"
                    : ""}
                </option>
              ))}
            </select>

            {hasAssignedMuse && !isPrimaryMuse && isSongConversation ? (
              <p className="copy" style={{ margin: "0.45rem 0 0", fontSize: "0.86rem" }}>
                {selectedMuse.name} is joining as a specialist. The song remains assigned
                to {safeDefaultMuse?.name}.
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      {historyStatus === "loading" ? (
        <AnalysisLoadingState
          compact
          title={`Restoring ${selectedMuse.name}'s conversation`}
          messages={["Bringing the saved questions, responses, and Muse guidance back into view."]}
        />
      ) : messages.length === 0 ? (
        needsMuseChoice ? (
          <div className="muse-first-question">
            <div className="recommended-action">
              <div className="recommended-action__eyebrow">Choose a creative perspective</div>
              <h3 className="recommended-action__title">Select a Muse to begin</h3>
              <div className="recommended-action__description">
                <p>
                  Use the Muse selector above. Once you choose a perspective, the
                  focused starter question for that Muse will appear here.
                </p>
              </div>
            </div>
          </div>
        ) : (
        <div className="muse-first-question">
          <p className="copy" style={{ fontStyle: "italic", marginBottom: 0 }}>
            “{selectedMuse.greeting}”
          </p>

          <div className="recommended-action">
            <div className="recommended-action__eyebrow">Recommended first question</div>
            <h3 className="recommended-action__title">
              {input.trim() || selectedMuse.starterQuestions[0]}
            </h3>
            <div className="recommended-action__description">
              <p>
                Start here, or write your own focused question in the box below.
              </p>
            </div>
            <div className="recommended-action__controls">
              <button
                type="button"
                className="button primary"
                disabled={isBusy}
                onClick={() =>
                  void sendMessage(input.trim() || selectedMuse.starterQuestions[0])
                }
              >
                Ask {selectedMuse.name}
              </button>
            </div>
          </div>

          {selectedMuse.starterQuestions.length > 1 ? (
            <details className="council-disclosure">
              <summary>Other useful questions</summary>
              <div className="button-row council-question-options">
                {selectedMuse.starterQuestions.slice(1).map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="button secondary"
                    disabled={isBusy}
                    onClick={() => prepareQuestion(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </div>
        )
      ) : (
        <div
          aria-live="polite"
          style={{
            display: "grid",
            gap: "0.75rem",
            marginTop: "1rem",
          }}
        >
          {messages.map((message) => {
            const isAssistant =
              message.role === "assistant";
            const isCollaborationOpen =
              collaborationSourceId ===
              message.id;

            return (
              <div
                key={message.id}
                style={{
                  justifySelf:
                    message.role === "user"
                      ? "end"
                      : "start",
                  width: "min(100%, 900px)",
                }}
              >
                <details
                  open={!isAssistant}
                  style={
                    isAssistant
                      ? { width: "100%" }
                      : { display: "contents" }
                  }
                >
                  <summary
                    className="copy"
                    style={
                      isAssistant
                        ? {
                            cursor: "pointer",
                            padding: "0.75rem 0.9rem",
                            borderRadius: 14,
                            border:
                              message.kind === "collaborator"
                                ? "1px solid rgba(154, 134, 220, 0.55)"
                                : "1px solid rgba(220, 182, 92, 0.45)",
                            background:
                              message.kind === "collaborator"
                                ? "rgba(105, 85, 170, 0.11)"
                                : "rgba(137, 96, 31, 0.1)",
                          }
                        : { display: "none" }
                    }
                  >
                    <span className="eyebrow">
                      {message.kind === "collaborator"
                        ? `${message.museName} — another Muse's perspective`
                        : `${message.museName || "Muse"} — guidance`}
                      {message.id === latestAssistantMessageId ? " · Latest" : ""}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: "0.3rem",
                        fontWeight: 700,
                      }}
                    >
                      {compactResponseSummary(message)}
                    </span>
                    {messageRecommendedMove(message) ? (
                      <span className="council-message-next-move">
                        Recommended now: {messageRecommendedMove(message)}
                      </span>
                    ) : null}
                    <span className="council-message-expand-hint">
                      Open full response, reasoning, and actions
                    </span>
                  </summary>

                  <div
                    style={{
                    padding: "0.9rem 1rem",
                    marginTop: isAssistant ? "0.55rem" : undefined,
                    borderRadius: 16,
                    border: isAssistant
                      ? message.kind ===
                        "collaborator"
                        ? "1px solid rgba(154, 134, 220, 0.65)"
                        : "1px solid rgba(220, 182, 92, 0.5)"
                      : "1px solid var(--line)",
                    background: isAssistant
                      ? message.kind ===
                        "collaborator"
                        ? "rgba(105, 85, 170, 0.13)"
                        : "rgba(137, 96, 31, 0.14)"
                      : "rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="eyebrow">
                    {message.role === "assistant"
                      ? message.kind ===
                        "collaborator"
                        ? `${message.museName} — another Muse's perspective`
                        : message.museName
                      : "You"}
                  </div>

                  {message.kind ===
                    "collaborator" &&
                  message.comparisonWith ? (
                    <p
                      className="copy"
                      style={{
                        marginTop: "0.25rem",
                        marginBottom: 0,
                        fontSize: "0.82rem",
                        opacity: 0.8,
                      }}
                    >
                      A different lens from{" "}
                      {message.comparisonWith}
                    </p>
                  ) : null}

                  <div
                    className="copy"
                    style={{
                      marginTop: "0.35rem",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.65,
                    }}
                  >
                    {message.content}
                  </div>
                </div>

                {isAssistant &&
                message.intelligence ? (
                  <MuseIntelligenceDetails
                    intelligence={
                      message.intelligence
                    }
                    messageId={message.id}
                    museName={
                      message.museName || "Muse"
                    }
                    museOptions={museOptions}
                    taskAction={
                      message.taskAction ?? null
                    }
                    knowledgeCitations={
                      message.knowledgeCitations ?? []
                    }
                    taskBusy={
                      taskActionMessageIds.includes(
                        message.id,
                      )
                    }
                    collaborationBusy={
                      collaborationStatus ===
                        "sending" &&
                      collaborationSourceId ===
                        message.id
                    }
                    onTaskAction={(action) =>
                      void handleTaskAction(
                        message.id,
                        action,
                      )
                    }
                    onInviteMuse={(museSlug) =>
                      void requestCollaboration(
                        message,
                        museSlug,
                      )
                    }
                  />
                ) : null}

                {message.memories?.length ? (
                  <div
                    style={{
                      marginTop: "0.65rem",
                      padding: "0.9rem",
                      border:
                        "1px solid rgba(220, 182, 92, 0.34)",
                      borderRadius: 15,
                      background:
                        "rgba(0,0,0,0.12)",
                    }}
                  >
                    <div className="eyebrow">
                      What {message.museName || "the Muse"}{" "}
                      proposes remembering
                    </div>
                    <p
                      className="copy"
                      style={{
                        margin: "0.35rem 0 0",
                        fontSize: "0.86rem",
                        opacity: 0.82,
                      }}
                    >
                      The full conversation and
                      structured intelligence are
                      already saved. These are only
                      distilled takeaways that may
                      guide future sessions.
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gap: "0.65rem",
                        marginTop: "0.75rem",
                      }}
                    >
                      {[...message.memories]
                        .sort(
                          (a, b) =>
                            Number(
                              b.importance ?? 0,
                            ) -
                            Number(
                              a.importance ?? 0,
                            ),
                        )
                        .map((memory, index) => {
                          const isUpdating =
                            memoryActionIds.includes(
                              memory.id,
                            );

                          return (
                            <div
                              key={memory.id}
                              style={{
                                padding:
                                  "0.8rem 0.85rem",
                                border:
                                  "1px solid rgba(220, 182, 92, 0.28)",
                                borderRadius: 13,
                                background:
                                  "rgba(255,255,255,0.025)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "0.45rem",
                                  alignItems:
                                    "center",
                                }}
                              >
                                <span className="pill">
                                  Proposed memory{" "}
                                  {index + 1}
                                </span>
                                <span className="eyebrow">
                                  {memoryLabel(
                                    memory.memory_type,
                                  )}
                                </span>
                              </div>

                              <p
                                className="copy"
                                style={{
                                  margin:
                                    "0.45rem 0 0",
                                  fontSize: "1rem",
                                }}
                              >
                                {memory.content}
                              </p>

                              {memory.reason ? (
                                <p
                                  className="copy"
                                  style={{
                                    margin:
                                      "0.3rem 0 0",
                                    fontSize:
                                      "0.82rem",
                                    opacity: 0.76,
                                  }}
                                >
                                  Why it may help later:{" "}
                                  {memory.reason}
                                </p>
                              ) : null}

                              {memory.status ===
                              "proposed" ? (
                                <div
                                  className="button-row"
                                  style={{
                                    marginTop:
                                      "0.65rem",
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="button primary"
                                    disabled={isUpdating}
                                    onClick={() =>
                                      void updateMemory(
                                        memory.id,
                                        "accepted",
                                      )
                                    }
                                  >
                                    {isUpdating
                                      ? "Saving…"
                                      : memoryAcceptLabel(
                                          memory.memory_type,
                                        )}
                                  </button>
                                  <button
                                    type="button"
                                    className="button"
                                    disabled={isUpdating}
                                    onClick={() =>
                                      void updateMemory(
                                        memory.id,
                                        "rejected",
                                      )
                                    }
                                  >
                                    Skip
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className="pill"
                                  style={{
                                    display:
                                      "inline-flex",
                                    marginTop:
                                      "0.65rem",
                                  }}
                                >
                                  {memory.status ===
                                  "accepted"
                                    ? "Kept for future sessions"
                                    : "Skipped"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : null}

                {message.role === "assistant" &&
                message.kind === "primary" ? (
                  <div
                    style={{ marginTop: "0.55rem" }}
                  >
                    {!isCollaborationOpen ? (
                      <button
                        type="button"
                        className="button"
                        disabled={isBusy}
                        onClick={() =>
                          openCollaboration(message)
                        }
                      >
                        Invite another Muse
                      </button>
                    ) : (
                      <div
                        style={{
                          padding: "0.85rem",
                          border:
                            "1px solid var(--line)",
                          borderRadius: 14,
                          background:
                            "rgba(0,0,0,0.12)",
                        }}
                      >
                        <div className="eyebrow">
                          What would another Muse say?
                        </div>
                        <label
                          className="copy"
                          htmlFor={`collaborator-${message.id}`}
                          style={{
                            display: "block",
                            marginTop: "0.45rem",
                          }}
                        >
                          Invite a different perspective
                        </label>
                        <select
                          id={`collaborator-${message.id}`}
                          className="input"
                          value={collaboratorMuseSlug}
                          disabled={
                            collaborationStatus ===
                            "sending"
                          }
                          onChange={(event) =>
                            setCollaboratorMuseSlug(
                              event.target.value,
                            )
                          }
                          style={{
                            marginTop: "0.35rem",
                          }}
                        >
                          {museOptions
                            .filter(
                              (option) =>
                                option.slug !==
                                message.museSlug,
                            )
                            .map((option) => (
                              <option
                                key={option.slug}
                                value={option.slug}
                              >
                                {option.name} —{" "}
                                {option.domain}
                              </option>
                            ))}
                        </select>

                        <div
                          className="button-row"
                          style={{
                            marginTop: "0.65rem",
                          }}
                        >
                          <button
                            type="button"
                            className="button primary"
                            disabled={
                              collaborationStatus ===
                                "sending" ||
                              !collaboratorMuseSlug
                            }
                            aria-busy={collaborationStatus === "sending"}
                            onClick={() =>
                              void requestCollaboration(
                                message,
                              )
                            }
                          >
                            {collaborationStatus === "sending" ? (
                              <>
                                Inviting Muse
                                <AnimatedDots label="Inviting Muse" />
                              </>
                            ) : (
                              "Compare perspectives"
                            )}
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            disabled={
                              collaborationStatus ===
                              "sending"
                            }
                            onClick={
                              closeCollaboration
                            }
                          >
                            Cancel
                          </button>
                        </div>

                        {collaborationStatus === "sending" ? (
                          <AnalysisLoadingState
                            compact
                            title="A second Muse is considering the song"
                            messages={[
                              "Comparing creative priorities and preparing a distinct perspective.",
                            ]}
                          />
                        ) : null}

                        {collaborationError ? (
                          <div
                            role="alert"
                            className="statusMessage statusError"
                            style={{
                              marginTop: "0.65rem",
                            }}
                          >
                            {collaborationError}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
                </details>
              </div>
            );
          })}

          {status === "sending" ? (
            <AnalysisLoadingState
              title={`${selectedMuse.name} is considering your question`}
              messages={[
                `Reading your question alongside the saved material for ${songTitle || "this song"}.`,
                `Considering the song through ${selectedMuse.name}'s complete creative lenses.`,
                "Shaping practical guidance and a clear next creative move.",
                "Still thinking—the response will appear here as soon as it is ready.",
              ]}
            />
          ) : null}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: "1rem" }}
      >
        <label
          className="copy"
          htmlFor="muse-message"
        >
          Your question for {selectedMuse.name}
        </label>
        <textarea
          id="muse-message"
          className="textarea"
          rows={5}
          value={input}
          disabled={isBusy}
          placeholder={`Ask ${selectedMuse.name} about ${selectedMuse.domain.toLowerCase()}...`}
          onChange={(event) =>
            setInput(event.target.value)
          }
          onKeyDown={handleKeyDown}
          style={{ marginTop: "0.4rem" }}
        />

        <div
          className="button-row"
          style={{ marginTop: "0.75rem" }}
        >
          <button
            type="submit"
            className="button primary"
            disabled={!canSend}
            aria-busy={status === "sending"}
            style={{
              opacity: canSend ? 1 : 0.6,
              cursor: canSend
                ? "pointer"
                : "not-allowed",
            }}
          >
            {status === "sending" ? (
              <>
                Asking {selectedMuse.name}
                <AnimatedDots label={`Asking ${selectedMuse.name}`} />
              </>
            ) : (
              `Ask ${selectedMuse.name}`
            )}
          </button>

          {messages.length > 0 ? (
            <button
              type="button"
              className="button secondary"
              disabled={isBusy}
              onClick={() =>
                void startNewConversation()
              }
            >
              Start new conversation
            </button>
          ) : null}
        </div>

        <p
          className="copy"
          style={{
            marginTop: "0.5rem",
            fontSize: "0.84rem",
            opacity: 0.8,
          }}
        >
          Press Ctrl+Enter or Command+Enter to
          send. The conversation and structured
          intelligence are saved automatically.
          Only memories you keep become durable
          guidance. Proposed tasks require your
          approval before they enter Songcatcher
          Studio.
        </p>
      </form>

      {errorMessage ? (
        <div
          role="alert"
          className="statusMessage statusError"
          style={{ marginTop: "0.85rem" }}
        >
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}
