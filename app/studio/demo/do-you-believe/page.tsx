import Link from "next/link";
import { getSongBySlug } from "@/lib/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PublicProductionCredits } from "@/components/song/ProductionCredits";

export const dynamic = "force-dynamic";

const DEMO_SONG_SLUG =
  process.env.IDREAMMUSIC_DEMO_SONG_SLUG || "do-you-believe";

type MetricValue = number | string | null;

type DemoMetrics = {
  totalListens: number;
  uniqueListeners: number;
  recentListens: number;
  averageRating: number | null;
  ratingCount: number;
};

type DemoAnalysis = {
  summary: string;
  overallScore: number;
  releaseReadyScore: number;
  audienceScore: number;
  singabilityScore: number;
  primaryAnalyticalMuse: string;
  primaryAnalyticalMuseConfidence: number;
  secondaryAnalyticalMuse: string;
  secondaryAnalyticalMuseConfidence: number;
};

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readNestedValue(
  value: unknown,
  path: string[],
): unknown {
  let current: unknown = value;

  for (const key of path) {
    const record = asRecord(current);

    if (!record) {
      return null;
    }

    current = record[key];
  }

  return current;
}

function readNumber(
  value: unknown,
  paths: string[][],
  fallback: number,
): number {
  for (const path of paths) {
    const candidate = readNestedValue(value, path);

    if (
      typeof candidate === "number" &&
      Number.isFinite(candidate)
    ) {
      return candidate;
    }
  }

  return fallback;
}

function readString(
  value: unknown,
  paths: string[][],
  fallback: string,
): string {
  for (const path of paths) {
    const candidate = readNestedValue(value, path);

    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return fallback;
}

function getVersionAudio(version: any) {
  if (!version) {
    return null;
  }

  if (version.audio_url) {
    return {
      url: version.audio_url,
      mimeType: version.audio_mime_type || "audio/mpeg",
      title: version.audio_title || null,
    };
  }

  const audioAttachment =
    version.attachments?.find(
      (item: any) => item.file_type === "audio",
    ) ?? version.attachments?.[0];

  if (!audioAttachment) {
    return null;
  }

  return {
    url: audioAttachment.public_url || null,
    mimeType:
      audioAttachment.mime_type || "audio/mpeg",
    title: audioAttachment.title || null,
  };
}

function displayMetric(value: MetricValue) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return value;
}

async function loadLiveDemoData(songId: string) {
  const fallbackAnalysis: DemoAnalysis = {
    summary:
      "The first recording preserved a repeated question, communal three-part harmony, and the energy of an imagined outdoor performance. The strongest next step was to separate the remembered lyric from the spoken recollection and build a deliberate song around the central question.",
    overallScore: 31,
    releaseReadyScore: 12,
    audienceScore: 33,
    singabilityScore: 54,
    primaryAnalyticalMuse: "Euterpe",
    primaryAnalyticalMuseConfidence: 79,
    secondaryAnalyticalMuse: "Urania",
    secondaryAnalyticalMuseConfidence: 67,
  };

  const fallbackMetrics: DemoMetrics = {
    totalListens: 91,
    uniqueListeners: 91,
    recentListens: 6,
    averageRating: 5,
    ratingCount: 1,
  };

  const supabase =
    await createServerSupabaseClient();

  if (!supabase) {
    return {
      analysis: fallbackAnalysis,
      metrics: fallbackMetrics,
    };
  }

  const [
    analysisResult,
    engagementResult,
    ratingResult,
    playEventsResult,
  ] = await Promise.all([
    (supabase as any)
      .from("ai_analysis_runs")
      .select(
        "raw_result, completed_at, created_at",
      )
      .eq("song_id", songId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    (supabase as any)
      .from("song_engagement_summaries")
      .select(
        "audio_play_count, last_audio_play_at",
      )
      .eq("song_id", songId)
      .maybeSingle(),

    (supabase as any)
      .from("song_rating_summaries")
      .select("average_rating, rating_count")
      .eq("song_id", songId)
      .maybeSingle(),

    (supabase as any)
      .from("song_engagement_events")
      .select(
        "user_id, anonymous_session_id, occurred_at",
      )
      .eq("song_id", songId)
      .eq("event_type", "audio_play"),
  ]);

  const rawResult =
    analysisResult.data?.raw_result ?? null;

  const analysis: DemoAnalysis = {
    summary: readString(
      rawResult,
      [
        ["summary"],
        ["executive_summary"],
        ["song_summary"],
      ],
      fallbackAnalysis.summary,
    ),
    overallScore: readNumber(
      rawResult,
      [["overall_score"]],
      fallbackAnalysis.overallScore,
    ),
    releaseReadyScore: readNumber(
      rawResult,
      [["ready_for_release_score"]],
      fallbackAnalysis.releaseReadyScore,
    ),
    audienceScore: readNumber(
      rawResult,
      [
        ["audience", "audience_rank_score"],
        ["audience_score"],
      ],
      fallbackAnalysis.audienceScore,
    ),
    singabilityScore: readNumber(
      rawResult,
      [
        ["singability_score"],
        ["hook", "singability_score"],
      ],
      fallbackAnalysis.singabilityScore,
    ),
    primaryAnalyticalMuse: readString(
      rawResult,
      [
        ["primary_muse", "name"],
        ["muse_analysis", "primary", "name"],
      ],
      fallbackAnalysis.primaryAnalyticalMuse,
    ),
    primaryAnalyticalMuseConfidence: readNumber(
      rawResult,
      [
        ["primary_muse", "confidence"],
        [
          "muse_analysis",
          "primary",
          "confidence",
        ],
      ],
      fallbackAnalysis.primaryAnalyticalMuseConfidence,
    ),
    secondaryAnalyticalMuse: readString(
      rawResult,
      [
        ["secondary_muse", "name"],
        ["muse_analysis", "secondary", "name"],
      ],
      fallbackAnalysis.secondaryAnalyticalMuse,
    ),
    secondaryAnalyticalMuseConfidence:
      readNumber(
        rawResult,
        [
          ["secondary_muse", "confidence"],
          [
            "muse_analysis",
            "secondary",
            "confidence",
          ],
        ],
        fallbackAnalysis.secondaryAnalyticalMuseConfidence,
      ),
  };

  const events = playEventsResult.data ?? [];
  const listenerKeys = new Set(
    events
      .map((event: any) => {
        if (event.user_id) {
          return `user:${event.user_id}`;
        }

        if (event.anonymous_session_id) {
          return `session:${event.anonymous_session_id}`;
        }

        return null;
      })
      .filter(Boolean),
  );

  const sevenDaysAgo =
    Date.now() - 7 * 24 * 60 * 60 * 1000;

  const metrics: DemoMetrics = {
    totalListens: Number(
      engagementResult.data?.audio_play_count ??
        fallbackMetrics.totalListens,
    ),
    uniqueListeners:
      listenerKeys.size ||
      fallbackMetrics.uniqueListeners,
    recentListens:
      events.filter((event: any) => {
        const occurredAt = new Date(
          event.occurred_at,
        ).getTime();

        return (
          !Number.isNaN(occurredAt) &&
          occurredAt >= sevenDaysAgo
        );
      }).length || fallbackMetrics.recentListens,
    averageRating:
      ratingResult.data?.average_rating === null ||
      ratingResult.data?.average_rating ===
        undefined
        ? fallbackMetrics.averageRating
        : Number(
            ratingResult.data.average_rating,
          ),
    ratingCount: Number(
      ratingResult.data?.rating_count ??
        fallbackMetrics.ratingCount,
    ),
  };

  return { analysis, metrics };
}

function JourneyStep({
  number,
  label,
  active = false,
}: {
  number: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={`#step-${number}`}
      className="pill"
      style={{
        textDecoration: "none",
        borderColor: active
          ? "rgba(220, 182, 92, 0.7)"
          : undefined,
        background: active
          ? "rgba(151, 106, 40, 0.16)"
          : undefined,
      }}
    >
      {number} · {label}
    </a>
  );
}

function ScoreCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: MetricValue;
  detail: string;
}) {
  return (
    <div
      style={{
        padding: "0.95rem",
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "rgba(0,0,0,0.12)",
      }}
    >
      <div className="eyebrow">{label}</div>

      <div
        className="h3"
        style={{
          marginTop: "0.35rem",
          marginBottom: "0.1rem",
          fontSize: "1.65rem",
        }}
      >
        {displayMetric(value)}
      </div>

      <p
        className="copy"
        style={{
          margin: 0,
          fontSize: "0.82rem",
          opacity: 0.8,
        }}
      >
        {detail}
      </p>
    </div>
  );
}

export default async function DoYouBelieveDemoPage() {
  const song =
    await getSongBySlug(DEMO_SONG_SLUG);

  if (!song) {
    return (
      <section className="section">
        <div className="container">
          <div className="card">
            <div className="eyebrow">
              Partner demonstration
            </div>

            <h1 className="h2">
              Demo song not found
            </h1>

            <p className="copy">
              Set{" "}
              <code>
                IDREAMMUSIC_DEMO_SONG_SLUG
              </code>{" "}
              to the public slug for “Do You
              Believe?” or confirm that its slug is{" "}
              <code>do-you-believe</code>.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const versions = [...(song.versions ?? [])].sort(
    (a: any, b: any) =>
      a.version_number - b.version_number,
  );

  const earliestVersion = versions[0] ?? null;

  const finalVersion =
    [...versions]
      .reverse()
      .find(
        (version: any) =>
          version.stage === "final",
      ) ??
    versions.at(-1) ??
    null;

  const primaryVersion =
    versions.find(
      (version: any) =>
        version.is_stage_primary,
    ) ??
    finalVersion ??
    earliestVersion;

  const earliestAudio =
    getVersionAudio(earliestVersion);

  const finalAudio = getVersionAudio(finalVersion);

  const { analysis, metrics } =
    await loadLiveDemoData(song.id);

  const listenerRatingText =
    metrics.averageRating === null
      ? "—"
      : `${metrics.averageRating.toFixed(1)} / 5`;

  const developmentMoves = [
    {
      title: "Separate memory from lyric",
      body:
        "The first transcript mixed remembered phrases with a spoken account of the dream. The development task was to preserve the origin story while identifying the actual lyric.",
    },
    {
      title: "Protect the repeated question",
      body:
        "“Do you believe?” was recognized as concise, singable, and naturally suited to a communal call-and-response chorus.",
    },
    {
      title: "Give the dream one concrete anchor",
      body:
        "The Muses recommended one vivid place, object, or sensory detail so the half-remembered dream could feel emotionally real without being overexplained.",
    },
  ];

  return (
    <main>
      <section className="hero">
        <div className="container">
          <div
            className="hero-card"
            style={{
              position: "relative",
              overflow: "hidden",
              border:
                "1px solid rgba(220, 182, 92, 0.5)",
              background:
                "radial-gradient(circle at 88% 16%, rgba(151, 106, 40, 0.18), transparent 30%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
            }}
          >
            <div className="eyebrow">
              Partner demonstration · One real song
            </div>

            <h1
              className="display"
              style={{
                marginTop: "0.5rem",
                marginBottom: "0.85rem",
                maxWidth: 980,
              }}
            >
              The Journey of “Do You Believe?”
            </h1>

            <p
              className="lead"
              style={{ maxWidth: 900 }}
            >
              From a dream fragment to a living
              song—caught, understood, developed with
              the Muses, and shared with listeners.
            </p>

            <p
              className="copy"
              style={{ maxWidth: 900 }}
            >
              This is not a simulated workflow. It is
              one song moving through the actual
              iDreamMusic system, with the human
              songwriter remaining at the center of
              every decision.
            </p>

            <div className="button-row">
              <a
                href="#step-1"
                className="button primary"
              >
                Begin the Journey
              </a>

              <Link
                href={`/songs/${song.slug}`}
                className="button"
              >
                Open the Public Song
              </Link>

              <Link
                href="/contact"
                className="button"
              >
                Discuss Partnership
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        className="section"
        style={{ paddingTop: 0 }}
      >
        <div className="container">
          <nav
            aria-label="Demo journey sections"
            className="card"
            style={{
              position: "sticky",
              top: 72,
              zIndex: 20,
              padding: "0.7rem",
              background:
                "rgba(9, 19, 35, 0.94)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <JourneyStep
                number="1"
                label="Arrival"
                active
              />
              <JourneyStep
                number="2"
                label="Capture"
              />
              <JourneyStep
                number="3"
                label="Intelligence"
              />
              <JourneyStep
                number="4"
                label="Muse Council"
              />
              <JourneyStep
                number="5"
                label="Development"
              />
              <JourneyStep
                number="6"
                label="Final Song"
              />
              <JourneyStep
                number="7"
                label="Listener Response"
              />
              <JourneyStep
                number="8"
                label="Credits"
              />
            </div>
          </nav>
        </div>
      </section>

      <section
        id="step-1"
        className="section"
      >
        <div className="container two-col">
          <div className="card">
            <div className="eyebrow">
              01 · How the song arrived
            </div>

            <h2 className="h2">
              The song began in a dream
            </h2>

            <p className="copy">
              Mike woke with the memory of an outdoor
              performance, one repeated question, and
              three voices joining in harmony as the
              crowd began to sing and clap.
            </p>

            <div className="quote-panel">
              “Just a riff from a dream, followed by
              what I remember of it.”
            </div>
          </div>

          <div
            className="card"
            style={{
              border:
                "1px solid rgba(220, 182, 92, 0.48)",
              background:
                "linear-gradient(145deg, rgba(151, 106, 40, 0.13), rgba(255,255,255,0.025))",
            }}
          >
            <div className="eyebrow">
              What iDreamMusic preserves
            </div>

            <h3 className="h3">
              The fragile moment before a song has a
              finished form
            </h3>

            <p className="copy">
              The platform does not require a polished
              lyric or production before the song can
              enter the system. The dream, memory,
              voice memo, and emotional impression are
              already meaningful source material.
            </p>
          </div>
        </div>
      </section>

      <section
        id="step-2"
        className="section"
      >
        <div className="container">
          <div className="eyebrow">
            02 · The first capture
          </div>

          <h2 className="h2">
            Preserve the source before interpreting it
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            <div className="card">
              <div className="eyebrow">
                Earliest surviving version
              </div>

              <h3 className="h3">
                {earliestVersion?.title ||
                  song.title ||
                  "Do You Believe?"}
              </h3>

              <div
                className="pillRow"
                style={{ marginBottom: "0.8rem" }}
              >
                {earliestVersion ? (
                  <>
                    <span className="pill">
                      Version{" "}
                      {
                        earliestVersion.version_number
                      }
                    </span>
                    <span className="pill">
                      {earliestVersion.stage}
                    </span>
                  </>
                ) : null}

                <span className="pill">
                  Dreamborn
                </span>
              </div>

              {earliestAudio?.url ? (
                <audio
                  controls
                  preload="none"
                  className="audioPlayer"
                >
                  <source
                    src={earliestAudio.url}
                    type={earliestAudio.mimeType}
                  />
                  Your browser does not support this
                  audio file.
                </audio>
              ) : (
                <p className="copy">
                  The earliest public audio is not
                  available on this version.
                </p>
              )}
            </div>

            <div className="card">
              <div className="eyebrow">
                What the first capture contained
              </div>

              <ul className="list">
                <li className="pill">
                  A repeated question: “Do you
                  believe?”
                </li>
                <li className="pill">
                  Three-part communal harmony
                </li>
                <li className="pill">
                  The remembered energy of a crowd
                </li>
                <li className="pill">
                  Spoken recollection mixed with
                  possible lyric
                </li>
              </ul>

              <p className="copy">
                At this stage, the goal was not to
                declare the song finished. It was to
                keep the source alive long enough to
                understand it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="step-3"
        className="section"
      >
        <div className="container">
          <div className="eyebrow">
            03 · Song Intelligence
          </div>

          <h2 className="h2">
            The system listens before it recommends
          </h2>

          <p
            className="copy"
            style={{ maxWidth: 900 }}
          >
            Song Intelligence combines the source
            recording, transcript, song metadata,
            creative signals, and listener data to
            explain what is strong, what remains
            unclear, and what deserves attention next.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "0.8rem",
              marginTop: "1rem",
            }}
          >
            <ScoreCard
              label="Overall song strength"
              value={`${analysis.overallScore} / 100`}
              detail="Current creative baseline"
            />
            <ScoreCard
              label="Ready for release"
              value={`${analysis.releaseReadyScore} / 100`}
              detail="Release readiness"
            />
            <ScoreCard
              label="Audience fit"
              value={`${analysis.audienceScore} / 100`}
              detail="Likely listener alignment"
            />
            <ScoreCard
              label="Singability"
              value={`${analysis.singabilityScore} / 100`}
              detail="Chorus and participation potential"
            />
          </div>

          <div
            className="card"
            style={{
              marginTop: "1rem",
              border:
                "1px solid rgba(220, 182, 92, 0.38)",
              background:
                "linear-gradient(145deg, rgba(151, 106, 40, 0.10), rgba(255,255,255,0.025))",
            }}
          >
            <div className="eyebrow">
              What the system heard
            </div>

            <p
              className="copy"
              style={{
                marginBottom: 0,
                maxWidth: 1000,
              }}
            >
              {analysis.summary}
            </p>
          </div>
        </div>
      </section>

      <section
        id="step-4"
        className="section"
      >
        <div className="container">
          <div className="eyebrow">
            04 · The Creative Council
          </div>

          <h2 className="h2">
            Different Muses reveal different truths
          </h2>

          <p
            className="copy"
            style={{ maxWidth: 900 }}
          >
            The assigned Muse defines the song’s
            primary creative home. Song Intelligence
            may detect additional strengths, and the
            songwriter can invite another Muse to
            compare perspectives.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 270px), 1fr))",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            <div
              className="card"
              style={{
                border:
                  "1px solid rgba(220, 182, 92, 0.55)",
                background:
                  "linear-gradient(155deg, rgba(151, 106, 40, 0.18), rgba(255,255,255,0.025))",
              }}
            >
              <div className="eyebrow">
                Assigned Muse
              </div>

              <h3 className="h3">
                Polyhymnia — Faith
              </h3>

              <p className="copy">
                She listens for what the song
                believes, what it questions, and
                whether its spiritual language feels
                lived and earned.
              </p>

              <div className="quote-panel">
                “The faith center is not the answer
                alone. It is the tension between
                belief, doubt, testimony, and the
                desire to belong.”
              </div>
            </div>

            <div className="card">
              <div className="eyebrow">
                Analytical strengths detected
              </div>

              <h3 className="h3">
                {
                  analysis.primaryAnalyticalMuse
                }{" "}
                (
                {
                  analysis.primaryAnalyticalMuseConfidence
                }
                %)
              </h3>

              <p className="copy">
                The repeated refrain, communal
                harmony, call-and-response energy, and
                audience participation suggested
                strong craft and musical-development
                potential.
              </p>

              <div className="pillRow">
                <span className="pill">
                  Secondary:{" "}
                  {
                    analysis.secondaryAnalyticalMuse
                  }{" "}
                  (
                  {
                    analysis.secondaryAnalyticalMuseConfidence
                  }
                  %)
                </span>
              </div>
            </div>

            <div
              className="card"
              style={{
                border:
                  "1px solid rgba(156, 137, 220, 0.55)",
                background:
                  "linear-gradient(155deg, rgba(86, 67, 145, 0.17), rgba(255,255,255,0.025))",
              }}
            >
              <div className="eyebrow">
                Invited perspective
              </div>

              <h3 className="h3">
                Calliope — Story
              </h3>

              <p className="copy">
                She asks what changes between the
                beginning and the end, what the
                narrator wants, and what event makes
                the final declaration feel earned.
              </p>

              <div className="quote-panel">
                “The missing element is not more
                explanation. It is a turning point.”
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              marginTop: "1rem",
              textAlign: "center",
            }}
          >
            <div className="eyebrow">
              Same song · Same songwriter · Distinct
              creative lenses
            </div>

            <h3 className="h3">
              The human chooses what belongs
            </h3>
          </div>
        </div>
      </section>

      <section
        id="step-5"
        className="section"
      >
        <div className="container">
          <div className="eyebrow">
            05 · Development
          </div>

          <h2 className="h2">
            Intelligence becomes practical work
          </h2>

          <p
            className="copy"
            style={{ maxWidth: 900 }}
          >
            Recommendations are converted into
            concrete song tasks so the songwriter can
            choose one meaningful move, work it, and
            measure the next version again.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            {developmentMoves.map(
              (move, index) => (
                <article
                  key={move.title}
                  className="card"
                >
                  <div className="eyebrow">
                    Development move 0{index + 1}
                  </div>

                  <h3 className="h3">
                    {move.title}
                  </h3>

                  <p className="copy">
                    {move.body}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section
        id="step-6"
        className="section"
      >
        <div className="container two-col">
          <div
            className="card"
            style={{
              border:
                "1px solid rgba(220, 182, 92, 0.52)",
              background:
                "linear-gradient(145deg, rgba(151, 106, 40, 0.15), rgba(255,255,255,0.025))",
            }}
          >
            <div className="eyebrow">
              06 · The final song
            </div>

            <h2 className="h2">
              The song reaches a finished recording
            </h2>

            <div
              className="pillRow"
              style={{ marginBottom: "1rem" }}
            >
              {finalVersion ? (
                <>
                  <span className="pill">
                    Version{" "}
                    {finalVersion.version_number}
                  </span>
                  <span className="pill">
                    {finalVersion.stage}
                  </span>
                </>
              ) : null}

              <span className="pill">
                Polyhymnia — Faith
              </span>
            </div>

            {finalAudio?.url ? (
              <audio
                controls
                preload="none"
                className="audioPlayer"
              >
                <source
                  src={finalAudio.url}
                  type={finalAudio.mimeType}
                />
                Your browser does not support this
                audio file.
              </audio>
            ) : song.audio_url ? (
              <audio
                controls
                preload="none"
                className="audioPlayer"
              >
                <source
                  src={song.audio_url}
                  type="audio/mpeg"
                />
                Your browser does not support this
                audio file.
              </audio>
            ) : (
              <p className="copy">
                No public final audio is attached yet.
              </p>
            )}
          </div>

          <div className="card">
            <div className="eyebrow">
              What remained human
            </div>

            <h3 className="h3">
              Meaning, judgment, voice, and final
              choice
            </h3>

            <p className="copy">
              iDreamMusic helped preserve the source,
              organize the material, analyze the song,
              invite Muse perspectives, and convert
              recommendations into work.
            </p>

            <p className="copy">
              The songwriter decided which ideas were
              true, which lyrics belonged, how the
              performance should feel, and when the
              song was ready to be shared.
            </p>

            <div className="quote-panel">
              The system assists. The songwriter
              authors.
            </div>
          </div>
        </div>
      </section>

      <section
        id="step-7"
        className="section"
      >
        <div className="container">
          <div className="eyebrow">
            07 · Listener response
          </div>

          <h2 className="h2">
            Sharing returns new intelligence
          </h2>

          <p
            className="copy"
            style={{ maxWidth: 900 }}
          >
            The song’s journey does not end at release.
            Plays, ratings, comments, and engagement
            return to the songwriter as evidence of
            connection and possible direction.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "0.8rem",
              marginTop: "1rem",
            }}
          >
            <ScoreCard
              label="Total listens"
              value={metrics.totalListens}
              detail="Recorded audio plays"
            />
            <ScoreCard
              label="Unique listeners"
              value={metrics.uniqueListeners}
              detail="Distinct listener identities or sessions"
            />
            <ScoreCard
              label="Last 7 days"
              value={metrics.recentListens}
              detail="Recent listening activity"
            />
            <ScoreCard
              label="Listener rating"
              value={listenerRatingText}
              detail={`${metrics.ratingCount} ${
                metrics.ratingCount === 1
                  ? "rating"
                  : "ratings"
              }`}
            />
          </div>

          <div
            className="card"
            style={{
              marginTop: "1rem",
              border:
                "1px solid rgba(220, 182, 92, 0.38)",
            }}
          >
            <div className="eyebrow">
              The creative loop
            </div>

            <p
              className="copy"
              style={{ marginBottom: 0 }}
            >
              Capture → Understand → Collaborate →
              Develop → Share → Listen → Return
            </p>
          </div>
        </div>
      </section>

      <section
        id="step-8"
        className="section"
      >
        <div className="container">
          <div className="eyebrow">
            08 · Transparent production record
          </div>

          <h2 className="h2">
            Credit the people and tools that helped
            bring the version to life
          </h2>

          <p
            className="copy"
            style={{ maxWidth: 900 }}
          >
            iDreamMusic preserves human authorship
            while documenting music generation, voice
            technology, video production, editing, and
            other creative tools at the version level.
          </p>

          <div style={{ marginTop: "1rem" }}>
            <PublicProductionCredits
              songId={song.id}
              songVersionId={
                primaryVersion?.id ?? null
              }
              versionNumber={
                primaryVersion?.version_number ??
                null
              }
              defaultOpen
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div
            className="card"
            style={{
              textAlign: "center",
              padding:
                "clamp(1.7rem, 4vw, 3.2rem)",
              border:
                "1px solid rgba(220, 182, 92, 0.58)",
              background:
                "radial-gradient(circle at 50% 0%, rgba(151, 106, 40, 0.20), transparent 42%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
            }}
          >
            <div className="eyebrow">
              What this demonstration proves
            </div>

            <h2
              className="h2"
              style={{
                maxWidth: 950,
                margin: "0.65rem auto 0",
                fontSize:
                  "clamp(2rem, 4.5vw, 3.8rem)",
                lineHeight: 1.05,
              }}
            >
              Human inspiration can remain central
              while intelligence, collaboration, and
              technology strengthen the journey.
            </h2>

            <p
              className="copy"
              style={{
                maxWidth: 850,
                margin: "1rem auto 0",
              }}
            >
              iDreamMusic connects the moment a song
              arrives with the decisions, development,
              production history, and listener response
              that follow.
            </p>

            <div
              className="button-row"
              style={{
                justifyContent: "center",
                marginTop: "1.25rem",
              }}
            >
              <Link
                href="/contact"
                className="button primary"
              >
                Discuss Partnership
              </Link>

              <Link
                href="/studio"
                className="button"
              >
                Explore Songcatcher Studio
              </Link>

              <Link
                href="/nine-muses"
                className="button"
              >
                Meet the Living Muses
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
