import Link from "next/link";

type JourneyStep = {
  number: string;
  title: string;
  subtitle: string;
  body: string;
  details: readonly string[];
  featured?: boolean;
};

const journeySteps: readonly JourneyStep[] = [
  {
    number: "01",
    title: "Catch the Song",
    subtitle: "Capture inspiration before it disappears.",
    body:
      "Save a voice memo, lyric, riff, dream, memory, title, or unfinished recording. Place it within the Muse that best reflects where the song came from.",
    details: [
      "Voice memos",
      "Lyrics and hooks",
      "Spark → Draft → Final",
    ],
  },
  {
    number: "02",
    title: "Understand the Song",
    subtitle: "See what is working and what needs attention.",
    body:
      "Use Song Intelligence, ratings, sorting, filtering, and listener engagement to uncover strengths, identify opportunities, and decide what deserves your focus next.",
    details: [
      "AI Song Intelligence",
      "Ratings and priorities",
      "Engagement insights",
    ],
  },
  {
    number: "03",
    title: "Collaborate with the Muses",
    subtitle:
      "Develop the song through specialized creative lenses.",
    body:
      "Work directly with the song’s assigned Muse. Then invite another Muse to offer a different perspective on story, craft, rhythm, faith, love, emotion, or possibility.",
    details: [
      "Active Muse guidance",
      "Second opinions",
      "Inter-Muse collaboration",
    ],
    featured: true,
  },
  {
    number: "04",
    title: "Share the Song",
    subtitle: "Let the song find its listeners.",
    body:
      "Publish developing or finished songs to the iDreamMusic Jukebox. Listeners can hear them, respond, rate them, and become part of the song’s continuing journey.",
    details: [
      "Public Jukebox",
      "Listener comments",
      "Ratings and response",
    ],
  },
];

export function SongJourneySection() {
  return (
    <section
      className="section"
      aria-labelledby="song-journey-heading"
    >
      <div className="container">
        <div
          className="card"
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "clamp(1.35rem, 3vw, 2.5rem)",
            border: "1px solid rgba(220, 182, 92, 0.42)",
            background:
              "radial-gradient(circle at top right, rgba(151, 106, 40, 0.20), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 280,
              height: 280,
              borderRadius: "50%",
              top: -150,
              right: -85,
              border: "1px solid rgba(220, 182, 92, 0.18)",
            }}
          />

          <div
            style={{
              position: "relative",
              display: "grid",
              gap: "0.75rem",
              maxWidth: 920,
            }}
          >
            <div>
              <span
                className="pill"
                style={{
                  display: "inline-flex",
                  borderColor: "rgba(220, 182, 92, 0.7)",
                  background: "rgba(151, 106, 40, 0.18)",
                }}
              >
                NEW — The Living Muses
              </span>
            </div>

            <div className="eyebrow">
              The complete song journey
            </div>

            <h2
              id="song-journey-heading"
              className="h2"
              style={{
                marginBottom: 0,
                fontSize: "clamp(2rem, 5vw, 4.2rem)",
                lineHeight: 1.02,
              }}
            >
              Catch it. Understand it.
              <br />
              Collaborate with it. Share it.
            </h2>

            <p
              className="copy"
              style={{
                maxWidth: 850,
                fontSize: "clamp(1rem, 1.7vw, 1.2rem)",
                lineHeight: 1.7,
              }}
            >
              iDreamMusic accompanies a song through its entire
              creative life—from the first spark, through
              intelligence and development, into active
              collaboration with the Muses, and finally out to the
              listeners who help reveal what the song may become
              next.
            </p>
          </div>

          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 245px), 1fr))",
              gap: "1rem",
              marginTop: "1.5rem",
            }}
          >
            {journeySteps.map((step) => (
              <article
                key={step.number}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 335,
                  padding: "1.15rem",
                  borderRadius: 18,
                  border: step.featured
                    ? "1px solid rgba(220, 182, 92, 0.72)"
                    : "1px solid var(--line)",
                  background: step.featured
                    ? "linear-gradient(155deg, rgba(151, 106, 40, 0.22), rgba(255,255,255,0.035))"
                    : "rgba(255,255,255,0.025)",
                  boxShadow: step.featured
                    ? "0 18px 55px rgba(0,0,0,0.18)"
                    : "none",
                }}
              >
                <div
                  className="symbol"
                  style={{
                    fontSize: "0.82rem",
                    letterSpacing: "0.12em",
                    opacity: 0.75,
                  }}
                >
                  {step.number}
                </div>

                <h3
                  className="h3"
                  style={{
                    marginTop: "0.7rem",
                    marginBottom: "0.35rem",
                  }}
                >
                  {step.title}
                </h3>

                <p
                  className="copy"
                  style={{
                    marginTop: 0,
                    fontWeight: 700,
                  }}
                >
                  {step.subtitle}
                </p>

                <p
                  className="copy"
                  style={{
                    lineHeight: 1.62,
                    flexGrow: 1,
                  }}
                >
                  {step.body}
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.45rem",
                    marginTop: "0.7rem",
                  }}
                >
                  {step.details.map((detail) => (
                    <span
                      key={detail}
                      className="pill"
                      style={{
                        fontSize: "0.78rem",
                      }}
                    >
                      {detail}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1fr) auto",
              alignItems: "center",
              gap: "1rem",
              marginTop: "1.5rem",
              padding: "1rem 1.1rem",
              border: "1px solid rgba(220, 182, 92, 0.32)",
              borderRadius: 18,
              background: "rgba(0,0,0,0.14)",
            }}
          >
            <div>
              <div className="eyebrow">
                The creative loop
              </div>

              <p
                className="copy"
                style={{
                  margin: "0.35rem 0 0",
                  maxWidth: 850,
                }}
              >
                The journey does not end when a song is shared.
                Listener comments, ratings, and engagement return
                to the songwriter as new intelligence—creating
                another reason to revisit, refine, collaborate, and
                share again.
              </p>
            </div>

            <div
              aria-hidden="true"
              style={{
                fontSize: "clamp(1.8rem, 4vw, 3.2rem)",
                opacity: 0.75,
              }}
            >
              ↻
            </div>
          </div>

          <div
            className="button-row"
            style={{
              position: "relative",
              marginTop: "1.35rem",
            }}
          >
            <Link
              href="/studio"
              className="button primary"
            >
              Enter Songcatcher Studio
            </Link>

            <Link
              href="/muses"
              className="button"
            >
              Meet the Nine Muses
            </Link>

            <Link
              href="/listen"
              className="button"
            >
              Open the Jukebox
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SongJourneySection;
