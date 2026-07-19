import Link from "next/link";

type JourneyStep = {
  number: string;
  symbol: string;
  title: string;
  subtitle: string;
  body: string;
  details: readonly string[];
  featured?: boolean;
};

const journeySteps: readonly JourneyStep[] = [
  {
    number: "01",
    symbol: "✦",
    title: "Catch the Song",
    subtitle: "Capture inspiration before it disappears.",
    body:
      "Save a voice memo, lyric, riff, dream, prayer, memory, or unfinished recording. Assign its Muse and begin the journey from Spark to Final.",
    details: ["Voice memos", "Lyrics and hooks", "Spark → Draft → Final"],
  },
  {
    number: "02",
    symbol: "◎",
    title: "Understand the Song",
    subtitle: "See what is working and what needs attention.",
    body:
      "Use Song Intelligence, ratings, priorities, filtering, and listener engagement to reveal strengths and identify the next meaningful move.",
    details: ["Song Intelligence", "Ratings and priorities", "Engagement insight"],
  },
  {
    number: "03",
    symbol: "↔",
    title: "Collaborate with the Muses",
    subtitle: "Develop the song through distinct creative lenses.",
    body:
      "Work with the song’s assigned Muse, then invite another Muse to offer a different perspective on story, craft, rhythm, faith, love, pain, or possibility.",
    details: ["Active Muse guidance", "Second perspectives", "Muse collaboration"],
    featured: true,
  },
  {
    number: "04",
    symbol: "◉",
    title: "Share the Song",
    subtitle: "Let the song find its listeners.",
    body:
      "Publish developing or finished songs to the iDreamMusic Jukebox. Listeners can hear them, respond, rate them, and become part of what happens next.",
    details: ["Public Jukebox", "Listener comments", "Ratings and response"],
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
              "radial-gradient(circle at top right, rgba(151, 106, 40, 0.16), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
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
              border: "1px solid rgba(220, 182, 92, 0.16)",
            }}
          />

          <div
            style={{
              position: "relative",
              display: "grid",
              gap: "0.7rem",
              maxWidth: 920,
            }}
          >
            <div className="eyebrow">
              The complete song journey
            </div>

            <h2
              id="song-journey-heading"
              className="h2"
              style={{
                marginBottom: 0,
                fontSize: "clamp(2rem, 4.4vw, 3.8rem)",
                lineHeight: 1.04,
                maxWidth: 900,
              }}
            >
              Catch it. Understand it.
              <br />
              Collaborate. Share.
            </h2>

            <p
              className="copy"
              style={{
                maxWidth: 820,
                fontSize: "clamp(1rem, 1.5vw, 1.15rem)",
                lineHeight: 1.68,
              }}
            >
              iDreamMusic accompanies a song from the first spark,
              through intelligence and development, into active
              collaboration with the Muses, and finally out to the
              listeners who help reveal what the song may become next.
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
                  minHeight: 320,
                  padding: "1.15rem",
                  borderRadius: 18,
                  border: step.featured
                    ? "1px solid rgba(220, 182, 92, 0.72)"
                    : "1px solid var(--line)",
                  background: step.featured
                    ? "linear-gradient(155deg, rgba(151, 106, 40, 0.20), rgba(255,255,255,0.035))"
                    : "rgba(255,255,255,0.025)",
                  boxShadow: step.featured
                    ? "0 18px 55px rgba(0,0,0,0.16)"
                    : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                  }}
                >
                  <div
                    className="symbol"
                    style={{
                      fontSize: "0.78rem",
                      letterSpacing: "0.12em",
                      opacity: 0.72,
                    }}
                  >
                    {step.number}
                  </div>

                  <div
                    aria-hidden="true"
                    style={{
                      width: 34,
                      height: 34,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      border: step.featured
                        ? "1px solid rgba(220, 182, 92, 0.6)"
                        : "1px solid var(--line)",
                      background: step.featured
                        ? "rgba(151, 106, 40, 0.17)"
                        : "rgba(255,255,255,0.03)",
                      fontSize: "1rem",
                    }}
                  >
                    {step.symbol}
                  </div>
                </div>

                <h3
                  className="h3"
                  style={{
                    marginTop: "0.75rem",
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
                    lineHeight: 1.58,
                    flexGrow: 1,
                  }}
                >
                  {step.body}
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.42rem",
                    marginTop: "0.65rem",
                  }}
                >
                  {step.details.map((detail) => (
                    <span
                      key={detail}
                      className="pill"
                      style={{ fontSize: "0.76rem" }}
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
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "center",
              gap: "1rem",
              marginTop: "1.5rem",
              padding: "1rem 1.1rem",
              border: "1px solid rgba(220, 182, 92, 0.3)",
              borderRadius: 18,
              background: "rgba(0,0,0,0.14)",
            }}
          >
            <div>
              <div className="eyebrow">The creative loop</div>

              <p
                className="copy"
                style={{
                  margin: "0.35rem 0 0",
                  maxWidth: 820,
                }}
              >
                Sharing is not the end. Listener comments, ratings,
                and engagement return to the songwriter as new
                intelligence—another reason to revisit, refine,
                collaborate, and share again.
              </p>
            </div>

            <div
              aria-hidden="true"
              style={{
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                opacity: 0.68,
              }}
            >
              ↻
            </div>
          </div>

          <div
            className="button-row"
            style={{
              position: "relative",
              marginTop: "1.3rem",
            }}
          >
            <Link href="/studio" className="button primary">
              Enter Songcatcher Studio
            </Link>

            <Link href="/nine-muses" className="button">
              Meet the Nine Muses
            </Link>

            <Link href="/listen" className="button">
              Open the Jukebox
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SongJourneySection;
