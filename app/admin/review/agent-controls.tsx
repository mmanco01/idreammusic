"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AgentAction =
  | "research"
  | "curate"
  | "stage-knowledge"
  | "validate"
  | "prepare-release"
  | "approve-release"
  | "return-for-work"
  | "release";

export default function AgentControls({
  jobId,
  action,
  label,
  confirmMessage,
  requireNotes = false,
  tone = "primary",
}: {
  jobId: string;
  action: AgentAction;
  label: string;
  confirmMessage?: string;
  requireNotes?: boolean;
  tone?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    if (busy) return;

    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    let decisionNotes: string | undefined;
    if (requireNotes) {
      const notes = window.prompt("Add a short note explaining what needs attention:");
      if (notes === null) return;
      if (!notes.trim()) {
        setMessage("A return-for-work note is required.");
        return;
      }
      decisionNotes = notes.trim();
    } else if (action === "approve-release") {
      const notes = window.prompt(
        "Optional approval note (Cancel leaves approval untouched; blank uses the standard approval note):",
        "",
      );
      if (notes === null) return;
      decisionNotes = notes.trim() || undefined;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/agent/jobs/${jobId}/${action}`, {
        method: "POST",
        headers:
          decisionNotes !== undefined
            ? { "content-type": "application/json" }
            : undefined,
        body:
          decisionNotes !== undefined
            ? JSON.stringify({ decisionNotes })
            : undefined,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      setMessage("Completed. Refreshing…");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className={tone === "primary" ? "button primary" : "button"}
        type="button"
        onClick={run}
        disabled={busy}
      >
        {busy ? "Working…" : label}
      </button>
      {message ? (
        <div className="copy" style={{ marginTop: ".45rem", maxWidth: 520 }}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
