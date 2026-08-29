"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./StudioLifecycleV1.module.css";
import type {
  CraftFocus,
  LifecyclePhase,
  StudioLifecycleSong,
} from "@/lib/studio/lifecycle-types";

type Props = {
  initialSongs: StudioLifecycleSong[];
};

const PHASES: Array<{
  key: LifecyclePhase;
  label: string;
  helper: string;
}> = [
  { key: "capture", label: "Capture", helper: "Ideas worth keeping." },
  { key: "craft", label: "Craft", helper: "Songs being brought to life." },
  { key: "release", label: "Release", helper: "Songs living in the world." },
];

const FOCI: Array<{ key: CraftFocus; label: string }> = [
  { key: "explore", label: "Explore" },
  { key: "shape", label: "Shape" },
  { key: "develop", label: "Develop" },
  { key: "refine", label: "Refine" },
  { key: "demo", label: "Demo" },
];

function label(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function visibilityLabel(status: string) {
  if (status === "published") return "Public";
  return label(status);
}

function formatScore(value: number | null) {
  return value === null ? "—" : String(Math.round(value));
}

function nextMove(song: StudioLifecycleSong) {
  if (song.next_action?.trim()) return song.next_action.trim();

  if (song.in_progress_task_count > 0) {
    return song.in_progress_task_count === 1
      ? "Finish the active task, then listen again."
      : `Finish one of the ${song.in_progress_task_count} active tasks, then listen again.`;
  }

  if (song.open_task_count > 0) {
    return "Choose the highest-value open task and work only that next.";
  }

  if (song.lifecycle_phase === "capture") {
    return "Spend a few minutes with this Spark. If it keeps pulling at you, bring it into Craft.";
  }

  if (song.lifecycle_phase === "release") {
    if (song.audio_play_count > 0 || song.listener_rating_count > 0) {
      return "Listen to what Reception is telling you. Change nothing unless it serves the song.";
    }
    return "Let the song live in the world. Reception will become the next signal.";
  }

  switch (song.craft_focus) {
    case "explore":
      return "Follow the strongest thread and discover what this song wants to become.";
    case "shape":
      return "Clarify the song's center, direction, and structure.";
    case "develop":
      return "Develop the next missing or weakest part of the song.";
    case "refine":
      return "Resolve the highest-value issue you can hear or name.";
    case "demo":
      return "Make or choose a representative version, then listen back as a listener.";
    default:
      return "Choose what the song needs now: Explore, Shape, Develop, Refine, or Demo.";
  }
}

function attentionNeeded(song: StudioLifecycleSong) {
  return Boolean(
    song.next_action?.trim() ||
      song.in_progress_task_count > 0 ||
      song.open_task_count > 0 ||
      (song.lifecycle_phase === "craft" && !song.craft_focus),
  );
}

function receptionSummary(song: StudioLifecycleSong) {
  const parts: string[] = [];

  if (song.audio_play_count > 0) {
    parts.push(`${song.audio_play_count.toLocaleString()} ${song.audio_play_count === 1 ? "play" : "plays"}`);
  }

  if (song.listener_rating_average !== null && song.listener_rating_count > 0) {
    parts.push(`${song.listener_rating_average.toFixed(1)} listener rating`);
    parts.push(`${song.listener_rating_count} ${song.listener_rating_count === 1 ? "response" : "responses"}`);
  }

  return parts.length ? parts.join(" · ") : "No listener signals yet.";
}

function StudioSongCard({
  song,
  onSaved,
}: {
  song: StudioLifecycleSong;
  onSaved: (songId: string, patch: Partial<StudioLifecycleSong>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function patchLifecycle(
    patch: {
      lifecycle_phase?: LifecyclePhase;
      craft_focus?: CraftFocus | null;
      ready_to_release?: boolean;
    },
  ) {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/studio/song-lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_id: song.id, ...patch }),
      });

      const result = (await response.json().catch(() => null)) as
        | {
            status?: string;
            message?: string;
            lifecycle?: {
              lifecycle_phase: LifecyclePhase;
              craft_focus: CraftFocus | null;
              lifecycle_source: "inferred" | "manual" | "system";
              ready_to_release_at: string | null;
            };
          }
        | null;

      if (!response.ok || result?.status !== "success" || !result.lifecycle) {
        throw new Error(result?.message || "Could not save song state.");
      }

      onSaved(song.id, {
        lifecycle_phase: result.lifecycle.lifecycle_phase,
        craft_focus: result.lifecycle.craft_focus,
        lifecycle_source: result.lifecycle.lifecycle_source,
        ready_to_release_at: result.lifecycle.ready_to_release_at,
      });
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const isReady = Boolean(song.ready_to_release_at);

  return (
    <article className={`card ${styles.songCard}`}>
      <div className={styles.songHeader}>
        <div className={styles.songIdentity}>
          <div className="eyebrow">
            {song.lifecycle_phase === "craft"
              ? song.craft_focus
                ? label(song.craft_focus)
                : "Craft · choose a focus"
              : label(song.lifecycle_phase)}
          </div>
          <h3 className={`h3 ${styles.songTitle}`}>{song.title}</h3>
          <div className={`copy ${styles.museLine}`}>
            {song.muse_slug ? label(song.muse_slug) : "Muse not assigned"}
          </div>
        </div>

        <div className={`pillRow ${styles.songPills}`}>
          <span className="pill">{visibilityLabel(song.status)}</span>
          <span className="pill">{label(song.current_stage)}</span>
          <span className="pill">
            {song.version_count} {song.version_count === 1 ? "version" : "versions"}
          </span>
          {isReady && song.lifecycle_phase === "craft" ? (
            <span className="pill">Ready to Release</span>
          ) : null}
        </div>
      </div>

      {song.lifecycle_phase === "release" ? (
        <div className={styles.receptionStrip}>
          <div className="eyebrow">Reception</div>
          <div className="copy">{receptionSummary(song)}</div>
        </div>
      ) : null}

      <div className={styles.nextBlock}>
        <div className="eyebrow">NEXT</div>
        <div className={`copy ${styles.nextCopy}`}>{nextMove(song)}</div>
      </div>

      {song.lifecycle_phase === "craft" ? (
        <div className={styles.craftControls}>
          <label className={`copy ${styles.focusControl}`}>
            <span>Current focus</span>
            <select
              className="input"
              value={song.craft_focus || ""}
              disabled={saving}
              onChange={(event) =>
                void patchLifecycle({
                  craft_focus: event.target.value
                    ? (event.target.value as CraftFocus)
                    : null,
                })
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

          {String(song.current_stage).toLowerCase() === "final" ? (
            <div className={styles.releaseGate}>
              <div>
                <div className="eyebrow">Final version</div>
                <div className="copy">
                  {isReady
                    ? "Marked ready. The songwriter still decides when to release."
                    : "Is this the song you are ready to let into the world?"}
                </div>
              </div>
              <button
                className="button"
                type="button"
                disabled={saving}
                onClick={() => void patchLifecycle({ ready_to_release: !isReady })}
              >
                {isReady ? "Clear Ready status" : "Ready to Release?"}
              </button>
            </div>
          ) : null}

          {song.status === "published" ? (
            <button
              className="button"
              type="button"
              disabled={saving}
              onClick={() => void patchLifecycle({ lifecycle_phase: "release" })}
            >
              Return to Release
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div className={`copy ${styles.saveMessage}`}>
          {saving ? "Saving…" : message}
        </div>
      ) : null}

      <details className={styles.atAGlance}>
        <summary className="copy">At a glance</summary>
        <div className={styles.metricGrid}>
          {[
            ["AI overall", formatScore(song.ai_overall_score)],
            ["Release readiness", formatScore(song.ai_ready_for_release_score)],
            ["Audience", formatScore(song.ai_audience_score)],
            ["My rating", formatScore(song.personal_rating)],
            ["Plays", song.audio_play_count.toLocaleString()],
            ["Tasks", String(song.open_task_count + song.in_progress_task_count)],
          ].map(([metric, value]) => (
            <div key={metric} className={styles.metricCard}>
              <div className="eyebrow">{metric}</div>
              <div className="copy">{value}</div>
            </div>
          ))}
        </div>
      </details>

      <div className={`eyebrow ${styles.recommendedActionLabel}`}>

        Recommended next action

      </div>

      <div className={`button-row ${styles.cardActions}`}>
        {song.lifecycle_phase === "capture" ? (
          <>
            <Link className="button primary" href={`/studio/songs/${song.slug}/edit`}>
              Work this Spark →
            </Link>
            <button
              className="button"
              type="button"
              disabled={saving}
              onClick={() => void patchLifecycle({ lifecycle_phase: "craft" })}
            >
              Bring into Craft
            </button>
          </>
        ) : null}

        {song.lifecycle_phase === "craft" ? (
          <Link className="button primary" href={`/studio/songs/${song.slug}/edit`}>
            Work the Song →
          </Link>
        ) : null}

        {song.lifecycle_phase === "release" ? (
          <>
            <Link className="button primary" href={`/songs/${song.slug}`}>
              View song →
            </Link>
            <button
              className="button"
              type="button"
              disabled={saving}
              onClick={() => void patchLifecycle({ lifecycle_phase: "craft" })}
            >
              Rework in Craft ↺
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export default function StudioLifecycleV1({ initialSongs }: Props) {
  const [songs, setSongs] = useState(initialSongs);
  const [phase, setPhase] = useState<LifecyclePhase>(
    initialSongs.some((song) => song.lifecycle_phase === "craft")
      ? "craft"
      : initialSongs.some((song) => song.lifecycle_phase === "capture")
        ? "capture"
        : "release",
  );
  const [focus, setFocus] = useState<CraftFocus | "all" | "unfocused">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "title" | "attention">("recent");

  const phaseCounts = useMemo(() => {
    return {
      capture: songs.filter((song) => song.lifecycle_phase === "capture").length,
      craft: songs.filter((song) => song.lifecycle_phase === "craft").length,
      release: songs.filter((song) => song.lifecycle_phase === "release").length,
    };
  }, [songs]);

  const focusCounts = useMemo(() => {
    const craftSongs = songs.filter((song) => song.lifecycle_phase === "craft");
    return {
      all: craftSongs.length,
      unfocused: craftSongs.filter((song) => !song.craft_focus).length,
      explore: craftSongs.filter((song) => song.craft_focus === "explore").length,
      shape: craftSongs.filter((song) => song.craft_focus === "shape").length,
      develop: craftSongs.filter((song) => song.craft_focus === "develop").length,
      refine: craftSongs.filter((song) => song.craft_focus === "refine").length,
      demo: craftSongs.filter((song) => song.craft_focus === "demo").length,
    };
  }, [songs]);

  const attentionCount = useMemo(
    () => songs.filter(attentionNeeded).length,
    [songs],
  );

  const visibleSongs = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = songs.filter((song) => {
      if (song.lifecycle_phase !== phase) return false;
      if (phase === "craft" && focus !== "all") {
        if (focus === "unfocused" && song.craft_focus) return false;
        if (focus !== "unfocused" && song.craft_focus !== focus) return false;
      }
      if (
        q &&
        !song.title.toLowerCase().includes(q) &&
        !(song.muse_slug || "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "attention") {
        const delta = Number(attentionNeeded(b)) - Number(attentionNeeded(a));
        if (delta) return delta;
      }
      return Date.parse(b.updated_at) - Date.parse(a.updated_at);
    });
  }, [songs, phase, focus, search, sort]);

  function updateSong(songId: string, patch: Partial<StudioLifecycleSong>) {
    setSongs((current) =>
      current.map((song) => (song.id === songId ? { ...song, ...patch } : song)),
    );
  }

  return (
    <div className="pageStack" style={{ marginTop: "1rem" }}>

      <aside className={styles.navigationHint} aria-label="Studio navigation help">

        <strong>How to navigate</strong>

        <span>

          In each song card, the gold button is the recommended next action. Use &#9656; to open more detail and &#9662; to close it.

        </span>

      </aside>
      <section className="card" style={{ padding: "1rem" }}>
        <div className={styles.lifecycleHeading}>
          <div className="eyebrow">Your song lifecycle</div>
        </div>

        <div className={styles.lifecycleGrid}>
          {PHASES.map((item) => {
            const active = phase === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setPhase(item.key);
                  setFocus("all");
                }}
                className={styles.lifecycleButton}
                data-active={active ? "true" : "false"}
              >
                <div className="eyebrow">{item.label}</div>
                <div className="h2" style={{ margin: "0.15rem 0 0" }}>
                  {phaseCounts[item.key]}
                </div>
                <div className={`copy ${styles.lifecycleHelper}`}>
                  {item.helper}
                </div>
              </button>
            );
          })}
        </div>

        <div className="copy" style={{ marginTop: "0.8rem" }}>
          <strong>{attentionCount}</strong>{" "}
          {attentionCount === 1 ? "song needs" : "songs need"} your attention.
        </div>
      </section>

      {phase === "craft" ? (
        <section className="card" style={{ padding: "0.85rem" }}>
          <div className="eyebrow">Crafting now</div>
          <div className="copy" style={{ marginTop: "0.2rem", opacity: 0.82 }}>
            What kind of work do these songs need right now?
          </div>
          <div className={styles.focusScroller} style={{ marginTop: "0.55rem" }}>
            {[
              ["all", `All ${focusCounts.all}`],
              ["explore", `Explore ${focusCounts.explore}`],
              ["shape", `Shape ${focusCounts.shape}`],
              ["develop", `Develop ${focusCounts.develop}`],
              ["refine", `Refine ${focusCounts.refine}`],
              ["demo", `Demo ${focusCounts.demo}`],
              ["unfocused", `Choose focus ${focusCounts.unfocused}`],
            ].map(([key, text]) => (
              <button
                key={key}
                type="button"
                className="pill"
                onClick={() => setFocus(key as typeof focus)}
                style={{
                  cursor: "pointer",
                  opacity: focus === key ? 1 : 0.68,
                  borderColor:
                    focus === key ? "rgba(255, 211, 106, 0.8)" : undefined,
                }}
              >
                {text}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.controls}>
        <input
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search songs or Muses…"
          style={{ maxWidth: 420 }}
        />
        <select
          className="input"
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
          style={{ width: "auto", minWidth: 170 }}
        >
          <option value="recent">Recently active</option>
          <option value="attention">Needs attention</option>
          <option value="title">Title</option>
        </select>
      </section>

      <section>
        <div className="eyebrow">{label(phase)}</div>
        <h2 className="h3" style={{ marginTop: "0.2rem" }}>
          {visibleSongs.length} {visibleSongs.length === 1 ? "song" : "songs"}
        </h2>

        <div className={styles.songList}>
          {visibleSongs.length ? (
            visibleSongs.map((song) => (
              <StudioSongCard key={song.id} song={song} onSaved={updateSong} />
            ))
          ) : (
            <div className="card">
              <p className="copy">No songs match this view yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
