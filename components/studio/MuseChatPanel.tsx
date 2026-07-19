"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";

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
  museOptions: readonly MuseChatOption[];
  songId?: string;
  songTitle?: string;
  lockedMuse?: boolean;
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
};

type MuseChatResponse = {
  status?: string;
  message?: string;
  reply?: string;
  mode?: "chat" | "collaborate";
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
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MuseChatPanel({
  defaultMuseSlug,
  museOptions,
  songId,
  songTitle,
  lockedMuse = false,
}: Props) {
  const safeDefaultMuse =
    museOptions.find((option) => option.slug === defaultMuseSlug) ??
    museOptions[0];

  const [selectedMuseSlug, setSelectedMuseSlug] = useState(
    safeDefaultMuse?.slug ?? "calliope",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const [collaborationSourceId, setCollaborationSourceId] = useState<
    string | null
  >(null);
  const [collaboratorMuseSlug, setCollaboratorMuseSlug] = useState("");
  const [collaborationStatus, setCollaborationStatus] = useState<
    "idle" | "sending" | "error"
  >("idle");
  const [collaborationError, setCollaborationError] = useState("");

  const selectedMuse =
    museOptions.find((option) => option.slug === selectedMuseSlug) ??
    safeDefaultMuse;

  const isSongConversation = Boolean(songId);
  const isPrimaryMuse = selectedMuse?.slug === safeDefaultMuse?.slug;
  const isBusy =
    status === "sending" || collaborationStatus === "sending";
  const canSend = input.trim().length > 0 && !isBusy;

  const conversationContext = useMemo(
    () =>
      messages
        .slice(-8)
        .map((message) => {
          const speaker =
            message.role === "user"
              ? "Songwriter"
              : message.museName || selectedMuse?.name || "Muse";

          return `${speaker}: ${message.content}`;
        })
        .join("\n\n"),
    [messages, selectedMuse?.name],
  );

  function resetConversation(nextMuseSlug?: string) {
    if (nextMuseSlug) {
      setSelectedMuseSlug(nextMuseSlug);
    }

    setMessages([]);
    setInput("");
    setStatus("idle");
    setErrorMessage("");
    setCollaborationSourceId(null);
    setCollaboratorMuseSlug("");
    setCollaborationStatus("idle");
    setCollaborationError("");
  }

  function getFirstAvailableCollaborator(primaryMuseSlug: string) {
    return (
      museOptions.find((option) => option.slug !== primaryMuseSlug)?.slug ?? ""
    );
  }

  function openCollaboration(message: ChatMessage) {
    if (!message.museSlug) {
      return;
    }

    setCollaborationSourceId(message.id);
    setCollaboratorMuseSlug(
      getFirstAvailableCollaborator(message.museSlug),
    );
    setCollaborationStatus("idle");
    setCollaborationError("");
  }

  function closeCollaboration() {
    if (collaborationStatus === "sending") {
      return;
    }

    setCollaborationSourceId(null);
    setCollaboratorMuseSlug("");
    setCollaborationStatus("idle");
    setCollaborationError("");
  }

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();

    if (!message || isBusy || !selectedMuse) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: message,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setStatus("sending");
    setErrorMessage("");
    setCollaborationSourceId(null);
    setCollaborationError("");

    try {
      const requestMessage = conversationContext
        ? `Continue this songwriting conversation:\n\n${conversationContext}\n\nSongwriter: ${message}`
        : message;

      const response = await fetch("/api/muses/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "chat",
          museSlug: selectedMuse.slug,
          message: requestMessage,
          ...(songId ? { songId } : {}),
        }),
      });

      const result = (await response.json().catch(() => null)) as
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

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: result.reply!.trim(),
          museSlug: result.muse?.slug || selectedMuse.slug,
          museName: result.muse?.name || selectedMuse.name,
          kind: "primary",
          question: message,
        },
      ]);

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

  async function requestCollaboration(sourceMessage: ChatMessage) {
    if (
      !sourceMessage.museSlug ||
      !sourceMessage.museName ||
      !sourceMessage.question ||
      !collaboratorMuseSlug ||
      collaborationStatus === "sending"
    ) {
      return;
    }

    const collaborator = museOptions.find(
      (option) => option.slug === collaboratorMuseSlug,
    );

    if (!collaborator) {
      setCollaborationStatus("error");
      setCollaborationError("Choose a Muse to invite.");
      return;
    }

    setCollaborationStatus("sending");
    setCollaborationError("");

    try {
      const response = await fetch("/api/muses/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "collaborate",
          primaryMuseSlug: sourceMessage.museSlug,
          collaboratorMuseSlug: collaborator.slug,
          originalQuestion: sourceMessage.question,
          primaryResponse: sourceMessage.content,
          ...(songId ? { songId } : {}),
        }),
      });

      const result = (await response.json().catch(() => null)) as
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

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: result.reply!.trim(),
          museSlug: result.muse?.slug || collaborator.slug,
          museName: result.muse?.name || collaborator.name,
          kind: "collaborator",
          question: sourceMessage.question,
          comparisonWith: sourceMessage.museName,
        },
      ]);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
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
      className="card"
      style={{
        border: "1px solid rgba(220, 182, 92, 0.55)",
        background:
          "linear-gradient(145deg, rgba(137, 96, 31, 0.16), rgba(255,255,255,0.025))",
      }}
    >
      <div className="eyebrow">
        {isSongConversation
          ? isPrimaryMuse
            ? "Your song's Muse"
            : "Invited Muse specialist"
          : `Conversation with the Muse of ${selectedMuse.domain}`}
      </div>

      <h2 className="h2" style={{ marginBottom: "0.35rem" }}>
        Ask {selectedMuse.name}
      </h2>

      <p className="copy" style={{ maxWidth: 850 }}>
        <strong>{selectedMuse.name}</strong> is the Muse of{" "}
        <strong>{selectedMuse.domain}</strong>. {selectedMuse.label}.
        {isSongConversation && songTitle ? (
          <>
            {" "}
            She will work with the saved material for{" "}
            <strong>{songTitle}</strong>.
          </>
        ) : (
          " Ask about songwriting, creative direction, a new idea, or a song you are developing."
        )}
      </p>

      {!lockedMuse ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.85rem",
            border: "1px solid var(--line)",
            borderRadius: 14,
            background: "rgba(0,0,0,0.12)",
          }}
        >
          <label className="copy" htmlFor="muse-selector">
            Creative partner
          </label>

          <select
            id="muse-selector"
            className="input"
            value={selectedMuse.slug}
            disabled={isBusy}
            onChange={(event) => resetConversation(event.target.value)}
            style={{ marginTop: "0.35rem" }}
          >
            {museOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.name} — {option.domain}
                {option.slug === safeDefaultMuse?.slug
                  ? " (Primary Muse)"
                  : ""}
              </option>
            ))}
          </select>

          {!isPrimaryMuse && isSongConversation ? (
            <p
              className="copy"
              style={{ marginTop: "0.45rem", fontSize: "0.86rem" }}
            >
              {selectedMuse.name} is joining as a specialist. The song remains
              assigned to {safeDefaultMuse?.name}.
            </p>
          ) : null}
        </div>
      ) : null}

      {messages.length === 0 ? (
        <div style={{ marginTop: "1rem" }}>
          <p className="copy" style={{ fontStyle: "italic" }}>
            “{selectedMuse.greeting}”
          </p>

          <div className="eyebrow" style={{ marginTop: "0.85rem" }}>
            Start with a question
          </div>

          <div className="button-row" style={{ marginTop: "0.55rem" }}>
            {selectedMuse.starterQuestions.map((question) => (
              <button
                key={question}
                type="button"
                className="button"
                disabled={isBusy}
                onClick={() => void sendMessage(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
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
            const isAssistant = message.role === "assistant";
            const isCollaborationOpen =
              collaborationSourceId === message.id;

            return (
              <div
                key={message.id}
                style={{
                  justifySelf:
                    message.role === "user" ? "end" : "start",
                  width: "min(100%, 850px)",
                }}
              >
                <div
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: 16,
                    border:
                      isAssistant
                        ? message.kind === "collaborator"
                          ? "1px solid rgba(154, 134, 220, 0.65)"
                          : "1px solid rgba(220, 182, 92, 0.5)"
                        : "1px solid var(--line)",
                    background:
                      isAssistant
                        ? message.kind === "collaborator"
                          ? "rgba(105, 85, 170, 0.13)"
                          : "rgba(137, 96, 31, 0.14)"
                        : "rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="eyebrow">
                    {message.role === "assistant"
                      ? message.kind === "collaborator"
                        ? `${message.museName} — another Muse's perspective`
                        : message.museName
                      : "You"}
                  </div>

                  {message.kind === "collaborator" &&
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
                      A different lens from {message.comparisonWith}
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

                {message.role === "assistant" &&
                message.kind === "primary" ? (
                  <div style={{ marginTop: "0.55rem" }}>
                    {!isCollaborationOpen ? (
                      <button
                        type="button"
                        className="button"
                        disabled={isBusy}
                        onClick={() => openCollaboration(message)}
                      >
                        Invite another Muse
                      </button>
                    ) : (
                      <div
                        style={{
                          padding: "0.85rem",
                          border: "1px solid var(--line)",
                          borderRadius: 14,
                          background: "rgba(0,0,0,0.12)",
                        }}
                      >
                        <div className="eyebrow">
                          What would another Muse say?
                        </div>

                        <label
                          className="copy"
                          htmlFor={`collaborator-${message.id}`}
                          style={{ display: "block", marginTop: "0.45rem" }}
                        >
                          Invite a different perspective
                        </label>

                        <select
                          id={`collaborator-${message.id}`}
                          className="input"
                          value={collaboratorMuseSlug}
                          disabled={collaborationStatus === "sending"}
                          onChange={(event) =>
                            setCollaboratorMuseSlug(event.target.value)
                          }
                          style={{ marginTop: "0.35rem" }}
                        >
                          {museOptions
                            .filter(
                              (option) =>
                                option.slug !== message.museSlug,
                            )
                            .map((option) => (
                              <option
                                key={option.slug}
                                value={option.slug}
                              >
                                {option.name} — {option.domain}
                              </option>
                            ))}
                        </select>

                        <div
                          className="button-row"
                          style={{ marginTop: "0.65rem" }}
                        >
                          <button
                            type="button"
                            className="button primary"
                            disabled={
                              collaborationStatus === "sending" ||
                              !collaboratorMuseSlug
                            }
                            onClick={() =>
                              void requestCollaboration(message)
                            }
                          >
                            {collaborationStatus === "sending"
                              ? "Inviting Muse…"
                              : "Compare perspectives"}
                          </button>

                          <button
                            type="button"
                            className="button"
                            disabled={
                              collaborationStatus === "sending"
                            }
                            onClick={closeCollaboration}
                          >
                            Cancel
                          </button>
                        </div>

                        {collaborationError ? (
                          <div
                            role="alert"
                            className="statusMessage statusError"
                            style={{ marginTop: "0.65rem" }}
                          >
                            {collaborationError}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {status === "sending" ? (
            <div
              className="copy"
              style={{
                padding: "0.85rem 1rem",
                border: "1px solid rgba(220, 182, 92, 0.4)",
                borderRadius: 16,
                width: "fit-content",
              }}
            >
              {selectedMuse.name} is considering your question…
            </div>
          ) : null}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label className="copy" htmlFor="muse-message">
          Your question for {selectedMuse.name}
        </label>

        <textarea
          id="muse-message"
          className="textarea"
          rows={5}
          value={input}
          disabled={isBusy}
          placeholder={`Ask ${selectedMuse.name} about ${selectedMuse.domain.toLowerCase()}...`}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          style={{ marginTop: "0.4rem" }}
        />

        <div className="button-row" style={{ marginTop: "0.75rem" }}>
          <button
            type="submit"
            className="button primary"
            disabled={!canSend}
            style={{
              opacity: canSend ? 1 : 0.6,
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            {status === "sending"
              ? `Asking ${selectedMuse.name}…`
              : `Ask ${selectedMuse.name}`}
          </button>

          {messages.length > 0 ? (
            <button
              type="button"
              className="button"
              disabled={isBusy}
              onClick={() => resetConversation()}
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
          Press Ctrl+Enter or Command+Enter to send. Conversations are not yet
          saved after a page refresh.
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
