"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  songId: string;
  slug: string;
  songTitle: string;
  museLabel: string;
  firstAudioAttachmentId?: string | null;
  hasTranscript: boolean;
  hasCapturedText: boolean;
};

type RunState = "idle" | "transcribing" | "analyzing" | "success" | "error";

export function SparkSavedNextSteps({
  songId,
  slug,
  songTitle,
  museLabel,
  firstAudioAttachmentId,
  hasTranscript,
  hasCapturedText,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<RunState>("idle");
  const [message, setMessage] = useState("");
  const [transcriptReady, setTranscriptReady] = useState(hasTranscript);
  const isBusy = state === "transcribing" || state === "analyzing";

  async function runSongIntelligence() {
    if (isBusy) return;

    try {
      setMessage("");

      if (firstAudioAttachmentId && !transcriptReady) {
        setState("transcribing");
        const transcriptBody = new FormData();
        transcriptBody.append("song_id", songId);
        transcriptBody.append("slug", slug);
        transcriptBody.append("attachment_id", firstAudioAttachmentId);

        const transcriptResponse = await fetch("/api/song-transcript/generate", {
          method: "POST",
          body: transcriptBody,
        });
        const transcriptResult = (await transcriptResponse
          .json()
          .catch(() => null)) as { status?: string; message?: string } | null;

        if (!transcriptResponse.ok || transcriptResult?.status !== "success") {
          if (!hasCapturedText) {
            throw new Error(
              transcriptResult?.message ||
                `The recording could not be transcribed (status ${transcriptResponse.status}).`,
            );
          }

          setMessage(
            "The recording could not be transcribed, so Song Intelligence is continuing with the words and notes already saved.",
          );
        } else {
          setTranscriptReady(true);
        }
      }

      setState("analyzing");
      const analysisBody = new FormData();
      analysisBody.append("song_id", songId);

      const analysisResponse = await fetch("/api/song-analytics/generate", {
        method: "POST",
        body: analysisBody,
      });
      const analysisResult = (await analysisResponse
        .json()
        .catch(() => null)) as { status?: string; message?: string } | null;

      if (!analysisResponse.ok || analysisResult?.status !== "success") {
        throw new Error(
          analysisResult?.message ||
            `Song Intelligence could not finish (status ${analysisResponse.status}).`,
        );
      }

      setState("success");
      setMessage("Song Intelligence is ready. Opening your results…");
      router.replace(`/studio/songs/${slug}/edit?analysis=ready#intelligence`);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Song Intelligence could not be completed.",
      );
    }
  }

  return (
    <section
      id="spark-saved"
      className="card"
      style={{
        border: "1px solid rgba(220, 182, 92, 0.62)",
        background:
          "radial-gradient(circle at top right, rgba(220, 182, 92, 0.18), transparent 38%), linear-gradient(145deg, rgba(151, 106, 40, 0.16), rgba(255,255,255,0.03))",
        padding: "clamp(1.2rem, 4vw, 2.1rem)",
      }}
    >
      <div className="eyebrow">Spark saved</div>
      <h1 className="h2" style={{ marginTop: "0.35rem" }}>
        Your Spark is safe.
      </h1>
      <p className="copy" style={{ maxWidth: 820, fontSize: "1.05rem" }}>
        You caught <strong>{songTitle}</strong>. It does not need to be complete
        yet.
      </p>

      <div className="pillRow" style={{ marginTop: "0.8rem" }}>
        <span className="pill">Private Spark</span>
        <span className="pill">{museLabel}</span>
      </div>

      <div
        style={{
          marginTop: "1.25rem",
          padding: "1.1rem",
          borderRadius: 16,
          border: "1px solid rgba(220, 182, 92, 0.42)",
          background: "rgba(0,0,0,0.14)",
        }}
      >
        <div className="eyebrow">Recommended next move</div>
        <h2 className="h3" style={{ marginTop: "0.45rem" }}>
          Understand what you caught
        </h2>
        <p className="copy" style={{ maxWidth: 780 }}>
          Song Intelligence can analyze the title, words, notes, and available
          recording evidence already saved with this Spark. Attached documents
          remain safely with the Spark as supporting material. A recording is
          helpful, but typed words are enough.
        </p>

        <button
          type="button"
          className="button primary"
          onClick={runSongIntelligence}
          disabled={isBusy}
          style={{ cursor: isBusy ? "wait" : "pointer" }}
        >
          {state === "transcribing"
            ? "Listening to your recording…"
            : state === "analyzing"
              ? "Understanding your Spark…"
              : state === "success"
                ? "Song Intelligence ready"
                : "Run Song Intelligence"}
        </button>
      </div>

      {message ? (
        <div
          role="status"
          className={`statusMessage ${state === "error" ? "statusError" : "statusSuccess"}`}
          style={{ marginTop: "1rem" }}
        >
          {message}
        </div>
      ) : null}

      <div className="button-row" style={{ marginTop: "1rem" }}>
        <Link
          href={`/studio/songs/${slug}/edit?workspace=open#song-details`}
          className="button"
        >
          Add more words or notes
        </Link>
        <Link href="/studio" className="button">
          Save and return to Studio
        </Link>
        <Link
          href={`/studio/songs/${slug}/edit?workspace=open#overview`}
          className="textLink"
          style={{ alignSelf: "center" }}
        >
          Open the full Song Workbench
        </Link>
      </div>
    </section>
  );
}
