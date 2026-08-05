"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  songId: string;
  songTitle: string;
  currentStage: string | null;
};

type TrashResponse = {
  status?: "success" | "error";
  message?: string;
};

export function SongDangerZone({
  songId,
  songTitle,
  currentStage,
}: Props) {
  const router = useRouter();
  const [isMoving, setIsMoving] = useState(false);
  const [message, setMessage] = useState("");

  async function moveToTrash() {
    const itemLabel = currentStage === "spark" ? "Spark" : "Song";
    const confirmed = window.confirm(
      `Move “${songTitle}” to Trash? The ${itemLabel.toLowerCase()} will disappear from Studio and public pages.`,
    );

    if (!confirmed) return;

    setIsMoving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/studio/songs/${songId}/trash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = (await response.json()) as TrashResponse;

      if (!response.ok || result.status !== "success") {
        throw new Error(result.message || "The item could not be moved to Trash.");
      }

      router.push("/studio?trashed=1");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The item could not be moved to Trash.",
      );
      setIsMoving(false);
    }
  }

  return (
    <section
      className="card"
      style={{
        border: "1px solid rgba(211, 102, 102, 0.45)",
        background:
          "linear-gradient(145deg, rgba(160,79,79,0.14), rgba(255,255,255,0.025))",
      }}
    >
      <div className="eyebrow">Start over</div>
      <h2 className="h2">
        Move this {currentStage === "spark" ? "Spark" : "Song"} to Trash
      </h2>
      <p className="copy" style={{ maxWidth: 820 }}>
        This is a soft delete. The song, versions, notes, and files stay together,
        but the item is hidden from Studio and public pages.
      </p>

      <div className="button-row">
        <button
          type="button"
          className="button danger"
          onClick={() => void moveToTrash()}
          disabled={isMoving}
          style={{ borderColor: "rgba(211, 102, 102, 0.6)" }}
        >
          {isMoving ? "Moving to Trash…" : "Move to Trash"}
        </button>
      </div>

      {message ? (
        <div className="statusMessage statusError" aria-live="polite">
          {message}
        </div>
      ) : null}
    </section>
  );
}
