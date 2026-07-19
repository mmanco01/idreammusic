"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";

type Props = {
  songId: string;
  songTitle: string;
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
  };
};

const STARTER_QUESTIONS = [
  "What is the strongest story element in this song?",
  "Where does the story become unclear or lose momentum?",
  "What should I improve next without losing my voice?",
];

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MuseChatPanel({ songId, songTitle }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const canSend = input.trim().length > 0 && status !== "sending";

  const conversationContext = useMemo(
    () =>
      messages
        .slice(-8)
        .map((message) =>
          `${message.role === "user" ? "Songwriter" : "Calliope"}: ${
            message.content
          }`,
        )
        .join("\n\n"),
    [messages],
  );

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();

    if (!message || status === "sending") {
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
          museSlug: "calliope",
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
            `Calliope could not respond. Request failed with status ${response.status}.`,
        );
      }

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: result.reply.trim(),
      };

      setMessages((current) => [...current, assistantMessage]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Calliope could not respond.",
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

  return (
    <section
      className="card"
      style={{
        border: "1px solid rgba(220, 182, 92, 0.55)",
        background:
          "linear-gradient(145deg, rgba(137, 96, 31, 0.16), rgba(255,255,255,0.025))",
      }}
    >
      <div className="eyebrow">Muse conversation</div>

      <h2 className="h2" style={{ marginBottom: "0.35rem" }}>
        Ask Calliope
      </h2>

      <p className="copy" style={{ maxWidth: 820 }}>
        Calliope is the Muse of Story. Ask her about narrative, character,
        point of view, imagery, emotional movement, or the strongest next step
        for <strong>{songTitle}</strong>.
      </p>

      {messages.length === 0 ? (
        <div style={{ marginTop: "1rem" }}>
          <div className="eyebrow">Start with a question</div>

          <div
            className="button-row"
            style={{ marginTop: "0.55rem" }}
          >
            {STARTER_QUESTIONS.map((question) => (
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
                  ? "Calliope"
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
              Calliope is considering the song…
            </div>
          ) : null}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label className="copy" htmlFor="calliope-message">
          Your question for Calliope
        </label>

        <textarea
          id="calliope-message"
          className="textarea"
          rows={5}
          value={input}
          disabled={status === "sending"}
          placeholder="What is the strongest story element in this song, and what should I improve next?"
          onChange={(event) => setInput(event.target.value)}
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
            style={{
              opacity: canSend ? 1 : 0.6,
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            {status === "sending"
              ? "Asking Calliope…"
              : "Ask Calliope"}
          </button>

          {messages.length > 0 ? (
            <button
              type="button"
              className="button"
              disabled={status === "sending"}
              onClick={() => {
                setMessages([]);
                setInput("");
                setStatus("idle");
                setErrorMessage("");
              }}
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
          Press Ctrl+Enter or Command+Enter to send.
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
