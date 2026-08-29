"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./WorkTheSongGuidedPreview.module.css";
import type {
  CraftFocus,
  GuidedSongPreviewData,
  LifecyclePhase,
} from "@/lib/studio/guided-song";

const FOCI: Array<{ key: CraftFocus; label: string }> = [
  { key: "explore", label: "Explore" },
  { key: "shape", label: "Shape" },
  { key: "develop", label: "Develop" },
  { key: "refine", label: "Refine" },
  { key: "demo", label: "Demo" },
];

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function orientationSentence(song: GuidedSongPreviewData) {
  const maturity = song.artifactMaturity.toLowerCase();

  if (song.lifecyclePhase === "capture") {
    return "Protecting the idea before asking it to become more.";
  }

  if (song.lifecyclePhase === "release") {
    return "Listening to what comes back after the song has entered the world.";
  }

  if (song.craftFocus === "explore") {
    return "Exploring what this song wants to become.";
  }

  if (song.craftFocus === "shape") {
    return "Giving the song a clearer center and working form.";
  }

  if (song.craftFocus === "develop") {
    return "Developing the lyric, music, arrangement, or performance into a complete working song.";
  }

  if (song.craftFocus === "refine") {
    return maturity === "final"
      ? "Refining a finished song before deciding whether to release it."
      : "Refining the song by resolving the issue that matters most.";
  }

  if (song.craftFocus === "demo") {
    return "Hearing the song in representative form so listening can guide the next decision.";
  }

  return "Choosing what kind of work the song needs now.";
}

function museContext(song: GuidedSongPreviewData) {
  if (!song.hasAssignedMuse || !song.museSlug) {
    return "Choose a Muse when a particular creative perspective would help. You do not need one just to keep working.";
  }

  const byMuse: Record<string, string> = {
    calliope: "Useful when the work involves story, character, scene, or emotional progression.",
    clio: "Useful when the work depends on roots, history, memory, place, or cultural context.",
    erato: "Useful when the emotional center is love, longing, intimacy, or relationship.",
    euterpe: "Useful when melody, harmony, form, phrasing, or musical craft needs attention.",
    melpomene: "Useful when the song needs emotional weight, blues truth, loss, tension, or catharsis.",
    polyhymnia: "Useful when faith, meaning, reverence, spirit, or deeper purpose is part of the work.",
    terpsichore: "Useful when groove, movement, rhythm, pulse, or physical energy needs attention.",
    thalia: "Useful when wit, play, surprise, lightness, or comic perspective can unlock the song.",
    urania: "Useful when imagery, wonder, possibility, scale, or the song's larger horizon needs attention.",
  };

  return (
    byMuse[song.museSlug] ??
    "Useful when this Muse's creative perspective matches the work in front of you."
  );
}

export default function WorkTheSongGuidedPreview({
  song,
}: {
  song: GuidedSongPreviewData;
}) {
  const router = useRouter();
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const fullHref = `/studio/songs/${song.slug}/edit?view=full`;

  async function patchLifecycle(
    patch: {
      lifecycle_phase?: LifecyclePhase;
      craft_focus?: CraftFocus | null;
      ready_to_release?: boolean;
    },
    successMessage: string,
  ) {
    setSavingLifecycle(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/studio/song-lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_id: song.id, ...patch }),
      });

      const result = (await response.json().catch(() => null)) as
        | { status?: string; message?: string }
        | null;

      if (!response.ok || result?.status !== "success") {
        throw new Error(result?.message || "Could not save song state.");
      }

      setActionMessage(successMessage);
      router.refresh();
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Could not save song state.",
      );
    } finally {
      setSavingLifecycle(false);
    }
  }

  return (
    <div className={styles.stack}>

      <aside className={styles.navigationHint} aria-label="Guided view navigation help">

        <strong>How to navigate</strong>

        <span>

          The gold button under NEXT is the recommended next action. Use &#9656; to open more detail and &#9662; to close it.

        </span>

      </aside>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className="eyebrow">Work the Song</div>
            <h1 className={styles.title}>{song.title}</h1>
            <p className={styles.orientation}>{orientationSentence(song)}</p>
          </div>

          <Link className="button" href="/studio">
            Back to Studio
          </Link>
        </div>

        <div className={styles.lifecycle} aria-label="Song lifecycle">
          {(["capture", "craft", "release"] as const).map((phase) => {
            const active = song.lifecyclePhase === phase;
            const completed =
              (phase === "capture" &&
                ["craft", "release"].includes(song.lifecyclePhase)) ||
              (phase === "craft" && song.lifecyclePhase === "release");

            return (
              <div
                key={phase}
                className={`${styles.phase} ${active ? styles.phaseActive : ""}`}
              >
                <span>{titleCase(phase)}</span>
                <strong>{active ? "●" : completed ? "✓" : ""}</strong>
              </div>
            );
          })}
        </div>

        <div className="pillRow">
          {song.craftFocus ? (
            <span className="pill">{titleCase(song.craftFocus)}</span>
          ) : null}
          <span className="pill">{song.artifactMaturity}</span>
          <span className="pill">{song.visibility}</span>
          <span className="pill">
            {song.hasAssignedMuse && song.museName
              ? song.museName
              : "Muse not assigned"}
          </span>
          {song.readyToRelease ? (
            <span className="pill">Ready to Release</span>
          ) : null}
        </div>

        <div className={styles.viewSwitch}>
          <span className={`${styles.viewChoice} ${styles.viewChoiceActive}`}>
            Guided View
          </span>
          <Link className={styles.viewChoice} href={fullHref}>
            Full Song View
          </Link>
        </div>
      </header>

      <section className={styles.compass}>
        <div className={styles.compassHeader}>
          <div className="eyebrow">Song Compass</div>
          <h2 className={styles.sectionTitle}>Where · Why · When</h2>
        </div>

        <div className={styles.compassGrid}>
          <article className={styles.compassCell}>
            <div className="eyebrow">Where</div>
            <p>{song.where}</p>
          </article>

          <article className={styles.compassCell}>
            <div className="eyebrow">Why</div>
            <p>{song.why}</p>
          </article>

          <article className={styles.compassCell}>
            <div className="eyebrow">When</div>
            <p>{song.when}</p>
          </article>
        </div>
      </section>

      <section className={styles.nowCard}>
        <div className="eyebrow">What matters now</div>
        <div className={styles.nextLabel}>NEXT</div>
        <p className={styles.nextText}>{song.what}</p>

        {song.lifecyclePhase === "craft" ? (
          <div className={styles.focusChooser}>
            <label htmlFor={`craft-focus-${song.id}`}>
              <div className="eyebrow">Current focus</div>
              <select
                id={`craft-focus-${song.id}`}
                className="input"
                value={song.craftFocus || ""}
                disabled={savingLifecycle}
                onChange={(event) =>
                  void patchLifecycle(
                    {
                      craft_focus: event.target.value
                        ? (event.target.value as CraftFocus)
                        : null,
                    },
                    event.target.value
                      ? `Focus changed to ${titleCase(event.target.value)}.`
                      : "Craft focus cleared.",
                  )
                }
              >
                <option value="">Choose…</option>
                {FOCI.map((focus) => (
                  <option key={focus.key} value={focus.key}>
                    {focus.label}
                  </option>
                ))}
              </select>
            </label>
            <p className={styles.focusHint}>
              Choose the kind of work the song needs now. You can change focus at any time.
            </p>
          </div>
        ) : null}

        <div className={styles.partner}>
          <div className="eyebrow">Creative partner</div>
          <strong>
            {song.hasAssignedMuse && song.museName && song.museDomain
              ? `${song.museName} — ${song.museDomain}`
              : "No Muse assigned"}
          </strong>
          <p className={styles.partnerContext}>{museContext(song)}</p>
        </div>

        {song.tools.length ? (
          <>
            <div className="eyebrow" style={{ marginTop: "1rem" }}>
              Useful now
            </div>
            <div className="button-row" style={{ marginTop: "0.55rem" }}>
              {song.tools.map((tool) => (
                <Link key={tool.label} className="button" href={tool.href}>
                  {tool.label}
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <div className={`eyebrow ${styles.recommendedActionLabel}`}>

          Recommended next action

        </div>

        <div className="button-row" style={{ marginTop: "0.45rem" }}>
          {song.lifecyclePhase === "capture" ? (
            <button
              className="button primary"
              type="button"
              disabled={savingLifecycle}
              onClick={() =>
                void patchLifecycle(
                  { lifecycle_phase: "craft" },
                  "Moved into Craft.",
                )
              }
            >
              {savingLifecycle ? "Moving into Craft…" : "Bring into Craft →"}
            </button>
          ) : song.lifecyclePhase === "release" ? (
            <Link className="button primary" href={`${fullHref}#share`}>
              Review Reception →
            </Link>
          ) : (
            <Link className="button primary" href={fullHref}>
              Work the Song →
            </Link>
          )}
        </div>

        {actionMessage ? (
          <p className={styles.actionMessage} role="status">
            {actionMessage}
          </p>
        ) : null}

        {song.lifecyclePhase === "craft" &&
        song.artifactMaturity.toLowerCase() === "final" ? (
          <div className={styles.readyGate}>
            <div>
              <div className="eyebrow">Final version</div>
              <p>Is this the song you are ready to let into the world?</p>
            </div>
            <Link className="button" href="/studio">
              {song.readyToRelease ? "Ready to Release" : "Ready to Release?"}
            </Link>
          </div>
        ) : null}
      </section>

      <details className={styles.glance}>
        <summary>At a Glance</summary>
        <div className={styles.metrics}>
          {[
            ["Muse", song.museName || "Not assigned"],
            ["Origin", song.origin || "Not recorded"],
            ["Version", song.artifactMaturity],
            ["Versions", song.versionCount],
            ["Recordings", song.recordingCount],
            ["Transcripts", song.transcriptCount],
            ["Active tasks", song.activeTaskCount],
            ["AI overall", song.aiOverall ?? "—"],
            ["Release readiness", song.releaseReadiness ?? "—"],
            ["Plays", song.plays],
            [
              "Listener response",
              song.listenerRating === null
                ? "—"
                : `${song.listenerRating.toFixed(1)} / 5 · ${song.listenerRatingCount} ${
                    song.listenerRatingCount === 1 ? "response" : "responses"
                  }`,
            ],
            ["Visibility", song.visibility],
          ].map(([label, value]) => (
            <div key={String(label)} className={styles.metric}>
              <div className="eyebrow">{label}</div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
