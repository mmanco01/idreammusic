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
  songId: string;
  songTitle: string;
  defaultMuseSlug: string;
  museOptions: readonly MuseChatOption[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type MuseChatResponse = {
  status?: string;
  message?: string;
  reply?: string;
  muse?: {
    slug?: string;
    name?: string;
    domain?: string;
    isPrimaryMuse?: boolean;
  };
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MuseChatPanel({
  songId,
  songTitle,
  defaultMuseSlug,
  museOptions,
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

  const selectedMuse =
    museOptions.find((option) => option.slug === selectedMuseSlug) ??
    safeDefaultMuse;

  const isPrimaryMuse = selectedMuse?.slug === safeDefaultMuse?.slug;
  const canSend = input.trim().length > 0 && status !== "sending";

  const conversationContext = useMemo(
    () =>
      messages
        .slice(-8)
        .map((message) =>
          `${message.role === "user" ? "Songwriter" : selectedMuse?.name ?? "Muse"}: ${
            message.content
          }`,
        )
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
  }

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();

    if (!message || status === "sending" || !selectedMuse) {
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
          museSlug: selectedMuse.slug,
          songId,
          message: requestMessage,
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
        {isPrimaryMuse ? "Your song's Muse" : "Invited Muse specialist"}
      </div>

      <h2 className="h2" style={{ marginBottom: "0.35rem" }}>
        Ask {selectedMuse.name}
      </h2>

      <p className="copy" style={{ maxWidth: 850 }}>
        <strong>{selectedMuse.name}</strong> is the Muse of{" "}
        <strong>{selectedMuse.domain}</strong>. {selectedMuse.label}. She will
        work with the saved material for <strong>{songTitle}</strong>.
      </p>

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
          disabled={status === "sending"}
          onChange={(event) => resetConversation(event.target.value)}
          style={{ marginTop: "0.35rem" }}
        >
          {museOptions.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.name} — {option.domain}
              {option.slug === safeDefaultMuse?.slug ? " (Primary Muse)" : ""}
            </option>
          ))}
        </select>

        {!isPrimaryMuse ? (
          <p className="copy" style={{ marginTop: "0.45rem", fontSize: "0.86rem" }}>
            {selectedMuse.name} is joining as a specialist. The song remains
            assigned to {safeDefaultMuse?.name}.
          </p>
        ) : null}
      </div>

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
                disabled={status === "sending"}
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
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                justifySelf:
                  message.role === "user" ? "end" : "start",
                width: "min(100%, 850px)",
                padding: "0.9rem 1rem",
                borderRadius: 16,
                border:
                  message.role === "assistant"
                    ? "1px solid rgba(220, 182, 92, 0.5)"
                    : "1px solid var(--line)",
                background:
                  message.role === "assistant"
                    ? "rgba(137, 96, 31, 0.14)"
                    : "rgba(255,255,255,0.04)",
              }}
            >
              <div className="eyebrow">
                {message.role === "assistant"
                  ? selectedMuse.name
                  : "You"}
              </div>

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
          ))}

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
              {selectedMuse.name} is considering the song…
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
          disabled={status === "sending"}
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
              disabled={status === "sending"}
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
