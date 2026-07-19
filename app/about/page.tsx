import Link from "next/link";

const journey = [
  {
    number: "01",
    title: "Catch",
    body:
      "Preserve the lyric, voice memo, riff, dream, prayer, memory, or unfinished recording before it disappears.",
  },
  {
    number: "02",
    title: "Understand",
    body:
      "Use Song Intelligence, ratings, priorities, and listener response to see what the song already has and what it still needs.",
  },
  {
    number: "03",
    title: "Collaborate",
    body:
      "Work with the song’s assigned Muse, then invite another Muse to offer a genuinely different creative perspective.",
  },
  {
    number: "04",
    title: "Share",
    body:
      "Release the song into the iDreamMusic Jukebox so listeners can hear it, rate it, comment, and become part of what happens next.",
  },
];

const principles = [
  {
    title: "Human authorship stays central",
    body:
      "The songwriter remains the source of judgment, meaning, memory, voice, and final choice. AI listens, organizes, questions, and assists.",
  },
  {
    title: "Inspiration comes before generation",
    body:
      "iDreamMusic begins with something human that has already arrived: a fragment, feeling, memory, melody, image, or story.",
  },
  {
    title: "Songs are allowed to become",
    body:
      "A Spark does not have to pretend to be finished. The platform honors unfinished work and helps reveal the next meaningful move.",
  },
  {
    title: "Sharing completes the loop",
    body:
      "Listener response is not merely a vanity metric. Plays, ratings, comments, and reactions can become useful creative intelligence.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div
            className="hero-card"
            style={{
              position: "relative",
              overflow: "hidden",
              border: "1px solid rgba(220, 182, 92, 0.42)",
              background:
                "radial-gradient(circle at 88% 18%, rgba(151, 106, 40, 0.17), transparent 30%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                width: 420,
                height: 420,
                borderRadius: "50%",
                right: -240,
                top: -230,
                border: "1px solid rgba(220, 182, 92, 0.16)",
              }}
            />

            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
                gap: "1.5rem",
                alignItems: "end",
              }}
            >
              <div>
                <div className="eyebrow">About iDreamMusic</div>

                <h1
                  className="display"
                  style={{
                    maxWidth: 780,
                    marginBottom: "0.9rem",
                  }}
                >
                  A human-centered home for songs in becoming
                </h1>

                <p className="lead" style={{ maxWidth: 760 }}>
                  iDreamMusic is built around a simple belief: songs are
                  often caught before they are written.
                </p>

                <p className="copy" style={{ maxWidth: 780 }}>
                  Some arrive through a dream. Some rise from heartbreak,
                  faith, rhythm, memory, place, or story. Others begin as a
                  title, a voice memo, a passing phrase, or a feeling that
                  refuses to leave.
                </p>

                <p className="copy" style={{ maxWidth: 780 }}>
                  iDreamMusic gives those beginnings a place to live, grow,
                  be understood, and eventually reach listeners—without
                  removing the human songwriter from the center.
                </p>

                <div className="button-row">
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

              <div
                className="card"
                style={{
                  border: "1px solid rgba(220, 182, 92, 0.48)",
                  background:
                    "linear-gradient(155deg, rgba(151, 106, 40, 0.16), rgba(93, 76, 150, 0.08), rgba(255,255,255,0.025))",
                }}
              >
                <div className="eyebrow">The central idea</div>

                <h2 className="h3" style={{ marginTop: "0.65rem" }}>
                  Catch the song before it disappears
                </h2>

                <p className="copy">
                  Most creative tools begin after the songwriter already
                  knows what the song is. iDreamMusic begins earlier—at the
                  fragile moment when the song is still becoming.
                </p>

                <div className="quote-panel">
                  “Honor the mystery of becoming—not only the finished
                  song.”
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div
            className="card"
            style={{
              border: "1px solid rgba(220, 182, 92, 0.34)",
              background:
                "linear-gradient(145deg, rgba(151, 106, 40, 0.10), rgba(255,255,255,0.025))",
            }}
          >
            <div className="eyebrow">What is a songcatcher?</div>

            <h2 className="h2">
              Someone who recognizes that a song may arrive before it can
              be explained
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              <p className="copy">
                A songcatcher listens for what appears in ordinary life:
                a sentence heard in passing, a melody on the road, a
                memory that returns unexpectedly, a prayer, a groove, a
                dream, or an image that carries emotional weight.
              </p>

              <p className="copy">
                The first responsibility is not to perfect it. It is to
                notice it, preserve it, and give it enough attention to
                discover what it wants to become.
              </p>

              <p className="copy">
                iDreamMusic gives that process structure without turning
                it into a formula. The mystery remains. The songwriter
                simply gains better ways to listen.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="eyebrow">The complete creative journey</div>
          <h2 className="h2">Catch it. Understand it. Collaborate. Share.</h2>

          <p className="copy" style={{ maxWidth: 880 }}>
            iDreamMusic connects the earliest moment of inspiration with
            active song development, Muse collaboration, and real listener
            response.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: "1rem",
              marginTop: "1.2rem",
            }}
          >
            {journey.map((step, index) => (
              <article
                key={step.number}
                className="card"
                style={{
                  minHeight: 245,
                  border:
                    index === 2
                      ? "1px solid rgba(156, 137, 220, 0.55)"
                      : index === 3
                        ? "1px solid rgba(220, 182, 92, 0.55)"
                        : "1px solid var(--line)",
                  background:
                    index === 2
                      ? "linear-gradient(155deg, rgba(86, 67, 145, 0.16), rgba(255,255,255,0.025))"
                      : index === 3
                        ? "linear-gradient(155deg, rgba(151, 106, 40, 0.15), rgba(255,255,255,0.025))"
                        : "rgba(255,255,255,0.025)",
                }}
              >
                <div className="eyebrow">{step.number}</div>
                <h3 className="h3">{step.title}</h3>
                <p className="copy">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div
            className="card"
            style={{
              border: "1px solid rgba(156, 137, 220, 0.48)",
              background:
                "linear-gradient(145deg, rgba(86, 67, 145, 0.15), rgba(255,255,255,0.025))",
            }}
          >
            <div className="eyebrow">The Living Muses</div>
            <h2 className="h2">Nine creative currents. Nine specialties.</h2>

            <p className="copy">
              The Nine Muses form the living map of iDreamMusic. Each one
              represents a distinct source of inspiration and a different
              way of listening to a song.
            </p>

            <p className="copy">
              Calliope listens for Story. Clio listens for Roots.
              Polyhymnia listens for Faith. Euterpe listens for Craft.
              The others bring Love, Blues, Rhythm, Play, and Dream.
            </p>

            <p className="copy">
              They are not decorative categories and they are not nine
              copies of the same assistant. Each Muse asks different
              questions, notices different strengths, and offers a
              different creative lens.
            </p>

            <div className="button-row">
              <Link href="/nine-muses" className="button primary">
                Explore the Nine Muses
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="eyebrow">Human + intelligence</div>
            <h2 className="h2">AI as listener, not replacement</h2>

            <p className="copy">
              iDreamMusic uses AI to help transcribe recordings, organize
              song material, analyze strengths and gaps, identify audience
              possibilities, create development tasks, and support
              conversations with the Muses.
            </p>

            <p className="copy">
              It does not decide what the song means. It does not own the
              memory, the belief, the pain, the melody, or the final
              creative choice.
            </p>

            <div className="quote-panel">
              The songwriter remains the songwriter.
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="eyebrow">What iDreamMusic stands for</div>
          <h2 className="h2">A framework built around creative dignity</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            {principles.map((principle) => (
              <article key={principle.title} className="card">
                <h3 className="h3">{principle.title}</h3>
                <p className="copy">{principle.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div
            className="card"
            style={{
              border: "1px solid rgba(220, 182, 92, 0.48)",
              background:
                "radial-gradient(circle at top right, rgba(151, 106, 40, 0.17), transparent 32%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                gap: "1.4rem",
                alignItems: "start",
              }}
            >
              <div>
                <div className="eyebrow">Founder</div>
                <h2 className="h2">Mike Mancour</h2>

                <p className="copy">
                  iDreamMusic grew from Mike Mancour’s life as a songwriter,
                  musician, and technology leader—and from a personal
                  archive of roughly 900 songs, fragments, voice memos,
                  recordings, and musical ideas spanning five decades.
                </p>

                <p className="copy">
                  The archive revealed a recurring truth: songs rarely
                  arrive in orderly form. They appear across years,
                  devices, notebooks, recordings, memories, and unfinished
                  moments. The challenge is not only writing more songs. It
                  is recognizing, preserving, understanding, and developing
                  what has already arrived.
                </p>
              </div>

              <div>
                <div className="eyebrow">Why build it now?</div>
                <h3 className="h3">
                  To create the home those songs never had
                </h3>

                <p className="copy">
                  iDreamMusic began as a way to bring one lifelong archive
                  into order. It has grown into a broader framework for
                  songcatchers who need a place where inspiration,
                  development, intelligence, collaboration, and sharing can
                  remain connected.
                </p>

                <p className="copy">
                  The goal is larger than preserving one person’s catalog.
                  It is to build a shared creative home where unfinished
                  songs are treated as living work rather than forgotten
                  files.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div className="card">
            <div className="eyebrow">For songcatchers</div>
            <h2 className="h2">A place to begin before you feel ready</h2>

            <p className="copy">
              Bring the voice memo, the half-remembered chorus, the dream,
              the unfinished lyric, or the song that has been waiting for
              years.
            </p>

            <div className="button-row">
              <Link href="/studio/capture" className="button primary">
                Catch a Song
              </Link>

              <Link href="/listen" className="button">
                Hear the Songs
              </Link>
            </div>
          </div>

          <div
            className="card"
            style={{
              border: "1px solid rgba(220, 182, 92, 0.42)",
              background:
                "linear-gradient(145deg, rgba(151, 106, 40, 0.12), rgba(255,255,255,0.025))",
            }}
          >
            <div className="eyebrow">For partners</div>
            <h2 className="h2">A human-centered framework for creative AI</h2>

            <p className="copy">
              iDreamMusic is currently an independent prototype seeking
              aligned partners who understand music, creative technology,
              intellectual property, artist development, or the future of
              human-centered AI.
            </p>

            <div className="button-row">
              <Link href="/contact" className="button primary">
                Start a Conversation
              </Link>

              <Link href="/studio/demo/do-you-believe" className="button">
                See the Song Journey
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "clamp(1.6rem, 4vw, 3rem)",
              border: "1px solid rgba(220, 182, 92, 0.55)",
              background:
                "radial-gradient(circle at 50% 0%, rgba(151, 106, 40, 0.19), transparent 42%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
            }}
          >
            <div className="eyebrow">
              Songs are caught, not written
            </div>

            <h2
              className="h2"
              style={{
                maxWidth: 860,
                margin: "0.65rem auto 0",
                fontSize: "clamp(2rem, 5vw, 4rem)",
                lineHeight: 1.05,
              }}
            >
              Explore the currents. Honor the process. Share what you catch.
            </h2>

            <div
              className="button-row"
              style={{
                justifyContent: "center",
                marginTop: "1.25rem",
              }}
            >
              <Link href="/studio" className="button primary">
                Enter the Studio
              </Link>

              <Link href="/nine-muses" className="button">
                Meet the Muses
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
