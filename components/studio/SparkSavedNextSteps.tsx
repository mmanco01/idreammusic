"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";
import { RecommendedNextAction } from "@/components/ui/RecommendedNextAction";

type Props = {
  songId: string;
  slug: string;
  songTitle: string;
  museLabel: string;
  firstAudioAttachmentId?: string | null;
  hasTranscript: boolean;
  hasReviewedTranscript: boolean;
  hasCapturedText: boolean;
};

type RunState = "idle" | "transcribing" | "analyzing" | "success" | "error";
type PrimaryMode = "transcribe" | "review" | "analyze";

export function SparkSavedNextSteps({
  songId,
  slug,
  songTitle,
  museLabel,
  firstAudioAttachmentId,
  hasTranscript,
  hasReviewedTranscript,
  hasCapturedText,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<RunState>("idle");
  const [message, setMessage] = useState("");
  const hasAudio = Boolean(firstAudioAttachmentId);
  const primaryMode: PrimaryMode =
    hasAudio && !hasTranscript
      ? "transcribe"
      : hasAudio && !hasReviewedTranscript
        ? "review"
        : "analyze";
  const isBusy = state === "transcribing" || state === "analyzing";

  const heading =
    primaryMode === "transcribe"
      ? "Transcribe what you caught"
      : primaryMode === "review"
        ? "Review the words first"
        : "Understand what you caught";

  const description =
    primaryMode === "transcribe"
      ? hasCapturedText
        ? "Song Intelligence can use your saved words now, but the recording may contain more. Transcribe it first, review what was heard, and then combine all of the material in one stronger analysis."
        : "Song Intelligence needs the words in your recording. Transcribe it first, then review what was heard before the song is analyzed."
      : primaryMode === "review"
        ? "The recording has been transcribed. Check the words against what you actually sang or said, correct anything that was misheard, and mark the transcript reviewed before analysis."
        : hasAudio
          ? "Your reviewed transcript is ready. Song Intelligence can now combine it with the title, words, notes, and other material saved with this Spark."
          : "Song Intelligence can analyze the title, words, notes, lyrics, and document context already saved with this Spark. No recording or transcript is required.";

  const buttonLabel =
    state === "transcribing"
      ? "Transcribing your recording…"
      : state === "analyzing"
        ? "Understanding your Spark…"
        : state === "success"
          ? "Song Intelligence ready"
          : primaryMode === "transcribe"
            ? hasCapturedText
              ? "Transcribe and Strengthen Analysis"
              : "Transcribe My Recording"
            : primaryMode === "review"
              ? "Review Transcript"
              : "Run Song Intelligence";

  async function runSongIntelligence() {
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
  }

  async function handlePrimaryAction() {
    if (isBusy) return;

    try {
      setMessage("");

      if (primaryMode === "review") {
        router.push(
          `/studio/songs/${slug}/edit?workspace=open&transcript=review#intelligence`,
        );
        return;
      }

      if (primaryMode === "transcribe") {
        if (!firstAudioAttachmentId) {
          throw new Error("No audio recording was found for this Spark.");
        }

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
          throw new Error(
            transcriptResult?.message ||
              `The recording could not be transcribed (status ${transcriptResponse.status}).`,
          );
        }

        setMessage("Transcript created. Review the words before Song Intelligence runs.");
        router.replace(
          `/studio/songs/${slug}/edit?workspace=open&transcript=review#intelligence`,
        );
        router.refresh();
        return;
      }

      await runSongIntelligence();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The next step could not be completed.",
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
        {hasAudio ? <span className="pill">Recording captured</span> : null}
      </div>

      <RecommendedNextAction
        title={heading}
        description={<p>{description}</p>}
      >
        <button
          type="button"
          className="button primary"
          onClick={handlePrimaryAction}
          disabled={isBusy}
          aria-busy={isBusy}
        >
          {buttonLabel}
        </button>
      </RecommendedNextAction>

      {state === "transcribing" ? (
        <AnalysisLoadingState
          title="Transcribing your recording"
          messages={[
            "Listening for the words, phrases, and repeated lines in your Spark.",
            "Preparing a transcript you can review and correct.",
            "Still working—longer recordings can take a little more time.",
          ]}
        />
      ) : state === "analyzing" ? (
        <AnalysisLoadingState
          title="Song Intelligence is working"
          messages={[
            "Reading the material you captured.",
            "Identifying strengths, possibilities, and the most useful Muse direction.",
            "Saving your provisional ratings and recommended next move.",
          ]}
        />
      ) : null}

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
          className="button secondary"
        >
          Add more to this Spark
        </Link>
        <Link href="/studio" className="button secondary">
          Save and return to Studio
        </Link>
        <Link
          href={`/studio/songs/${slug}/edit?workspace=open#overview`}
          className="button tertiary"
          style={{ alignSelf: "center" }}
        >
          Open the full Song Workbench
        </Link>
      </div>
    </section>
  );
}
