import Image from "next/image";
import Link from "next/link";
import { muses } from "@/content/site";
import MuseCard from "@/components/MuseCard";
import { SectionIntro } from "@/components/SectionIntro";
import { SongJourneySection } from "@/components/home/SongJourneySection";
import { getMyMuseRepresentationTheme } from "@/lib/profile";
import { resolveMuseImage } from "@/lib/muse-representation";

const YOUTUBE_CHANNEL_URL =
  "https://www.youtube.com/channel/UCR1rEksaVIVKrIdUf8qKRsw";

type LifecycleStep = {
  number: string;
  title: string;
  description: string;
  emphasis?: "gold" | "violet";
};

const lifecycleSteps: readonly LifecycleStep[] = [
  {
    number: "01",
    title: "Catch",
    description:
      "Preserve the phrase, voice memo, riff, dream, prayer, memory, or melody before it disappears.",
  },
  {
    number: "02",
    title: "Shape",
    description:
      "Develop lyrics, recordings, notes, versions, structure, and the movement from Spark to Draft to Final.",
  },
  {
    number: "03",
    title: "Understand",
    description:
      "Use Song Intelligence, ratings, priorities, filtering, and engagement to reveal what deserves attention.",
    emphasis: "gold",
  },
  {
    number: "04",
    title: "Collaborate",
    description:
      "Work with the song’s primary Muse, then invite another Muse to reveal what a different creative lens sees.",
    emphasis: "violet",
  },
  {
    number: "05",
    title: "Share",
    description:
      "Publish a developing or finished song to the Jukebox so listeners can hear it, rate it, and respond.",
    emphasis: "gold",
  },
  {
    number: "06",
    title: "Return",
    description:
      "Bring listener comments, ratings, plays, and new insight back into the next creative decision.",
  },
];

export default async function HomePage() {
  const theme = await getMyMuseRepresentationTheme();
  const configuredBookUrl = process.env.NEXT_PUBLIC_BOOK_PURCHASE_URL?.trim() || "https://www.amazon.com/dp/B0HF1Q4QZC";
  const bookPurchaseUrl =
    configuredBookUrl && /^https?:\/\//i.test(configuredBookUrl)
      ? configuredBookUrl
      : null;

  return (
    <>
      <section className="hero">
        <div className="container">
          <div
            className="hero-card"
            style={{
              position: "relative",
              overflow: "hidden",
              border: "1px solid rgba(220, 182, 92, 0.32)",
              background:
                "radial-gradient(circle at 88% 18%, rgba(214, 170, 77, 0.12), transparent 28%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
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

            <div className="hero-grid" style={{ position: "relative" }}>
              <div>
                <div className="eyebrow">
                  Shared home for songcatchers
                </div>

                <h1 className="display">
                  Songs Are Caught, Not Written
                </h1>

                <p className="lead">
                  iDreamMusic is a human-centered creative home for
                  people who discover songs in the flow of life,
                  dream, memory, faith, rhythm, love, pain, and
                  wonder.
                </p>

                <p className="copy">
                  A song may arrive as a phrase, a voice memo, a
                  prayer, a riff, a memory, or something that cannot
                  yet be explained. iDreamMusic helps you catch it,
                  understand what it needs, develop it with the Muses,
                  and share it when it is ready.
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
                  border: "1px solid rgba(220, 182, 92, 0.5)",
                  background:
                    "linear-gradient(155deg, rgba(151, 106, 40, 0.16), rgba(93, 76, 150, 0.09), rgba(255,255,255,0.025))",
                }}
              >
                <div className="eyebrow">The Living Muses</div>

                <h2 className="h3" style={{ marginTop: "0.65rem" }}>
                  Your song has an active creative council
                </h2>

                <p className="copy">
                  Begin with the Muse assigned to the song. Then
                  invite another Muse to offer a genuinely different
                  perspective.
                </p>

                <div
                  style={{
                    display: "grid",
                    gap: "0.7rem",
                    marginTop: "1rem",
                  }}
                >
                  <div
                    style={{
                      padding: "0.85rem",
                      borderRadius: 14,
                      border:
                        "1px solid rgba(220, 182, 92, 0.38)",
                      background: "rgba(0,0,0,0.14)",
                    }}
                  >
                    <div className="eyebrow">
                      Polyhymnia — Faith
                    </div>

                    <p
                      className="copy"
                      style={{
                        margin: "0.4rem 0 0",
                        fontStyle: "italic",
                      }}
                    >
                      “The spiritual center feels honest, but the
                      hope may arrive before the struggle has fully
                      earned it.”
                    </p>
                  </div>

                  <div
                    style={{
                      padding: "0.85rem",
                      borderRadius: 14,
                      border:
                        "1px solid rgba(156, 137, 220, 0.5)",
                      background: "rgba(86, 67, 145, 0.13)",
                    }}
                  >
                    <div className="eyebrow">
                      Calliope — Story
                    </div>

                    <p
                      className="copy"
                      style={{
                        margin: "0.4rem 0 0",
                        fontStyle: "italic",
                      }}
                    >
                      “From the story perspective, the missing
                      element is not more explanation—it is a turning
                      point.”
                    </p>
                  </div>
                </div>

                <div
                  className="button-row"
                  style={{ marginTop: "1rem" }}
                >
                  <Link
                    href="/nine-muses"
                    className="button primary"
                  >
                    Talk with a Muse
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="book-home-card">
            <div className="book-home-cover">
              <Image
                src="/books/idreammusic-book-cover.webp"
                alt="iDreamMusic book cover"
                width={1024}
                height={1536}
                sizes="(max-width: 980px) 58vw, 220px"
              />
            </div>

            <div>
              <div className="eyebrow">
                {bookPurchaseUrl
                  ? "Now available on Amazon"
                  : "Coming soon in paperback"}
              </div>
              <h2 className="h2">The iDreamMusic Book</h2>
              <p className="lead">
                Songwriting in the Modality of the Muses
              </p>
              <p className="copy">
                A songwriter’s companion for finding better ideas, writing better
                songs, and becoming a better songwriter—through nine distinct
                creative perspectives.
              </p>
              <div className="button-row">
                <Link href="/book" className="button primary">
                  Explore the Book
                </Link>
                {bookPurchaseUrl ? (
                  <a
                    href={bookPurchaseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button"
                  >
                    Buy on Amazon
                  </a>
                ) : (
                  <Link href="/book#release-updates" className="button">
                    Get Release Updates
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SongJourneySection />

      <section className="section">
        <div className="container">
          <SectionIntro
            eyebrow="See it happen"
            title="One song. More than one way of seeing it."
            text="Each Muse brings a defined specialty, asks different questions, and helps the songwriter notice something the others may not emphasize."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 270px), 1fr))",
              gap: "1rem",
            }}
          >
            <div
              className="card"
              style={{
                border: "1px solid var(--line)",
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="eyebrow">
                The songwriter asks
              </div>

              <h3 className="h3">
                “Does this chorus carry the heart of the song?”
              </h3>

              <p className="copy">
                One question can reveal different opportunities,
                depending on which Muse is listening.
              </p>
            </div>

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
                Polyhymnia — Faith
              </div>

              <h3 className="h3">
                She listens for spiritual truth
              </h3>

              <p className="copy">
                Is the chorus prayer, testimony, praise, lament,
                surrender, or a question? Does its hope feel lived
                and earned?
              </p>
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
                Calliope — Story
              </div>

              <h3 className="h3">
                She listens for narrative movement
              </h3>

              <p className="copy">
                Does the chorus reveal what the narrator wants? Do
                the verses move toward it? Has the ending earned the
                final declaration?
              </p>
            </div>
          </div>

          <div
            className="card"
            style={{
              marginTop: "1rem",
              textAlign: "center",
              border:
                "1px solid rgba(220, 182, 92, 0.34)",
              background: "rgba(0,0,0,0.12)",
            }}
          >
            <div className="eyebrow">
              Same song · Same songwriter · Distinct creative lenses
            </div>

            <h3
              className="h3"
              style={{ marginBottom: "0.4rem" }}
            >
              The human remains the songwriter
            </h3>

            <p
              className="copy"
              style={{ maxWidth: 800, margin: "0 auto" }}
            >
              The Muses do not replace authorship. They listen,
              question, compare perspectives, and help the songwriter
              choose the next meaningful move.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div
            className="card"
            style={{
              marginBottom: "1.25rem",
              border:
                "1px solid rgba(220, 182, 92, 0.34)",
              background:
                "linear-gradient(145deg, rgba(151, 106, 40, 0.12), rgba(255,255,255,0.025))",
            }}
          >
            <div className="eyebrow">
              Nine active creative partners
            </div>

            <h2 className="h2">Meet the Living Muses</h2>

            <p className="copy" style={{ maxWidth: 900 }}>
              Each Muse represents a creative current and an active
              specialty. Open any Muse page to explore her world, ask
              a question, and invite another Muse to compare
              perspectives.
            </p>

            <div className="button-row">
              <Link
                href="/nine-muses"
                className="button primary"
              >
                Start a Muse conversation
              </Link>
            </div>
          </div>

          <div className="muse-grid">
            {muses.map((muse) => (
              <MuseCard
                key={muse.slug}
                muse={muse}
                imageOverride={resolveMuseImage(
                  muse.slug,
                  muse.image,
                  theme,
                )}
              />
            ))}
          </div>

          <div className="button-row">
            <Link href="/nine-muses" className="button">
              View all Muse pages
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionIntro
            eyebrow="The complete creative loop"
            title="How a Song Moves Through iDreamMusic"
            text="A song can be caught, shaped, understood, developed with specialized Muses, shared with listeners, and revisited through the insight that returns."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 225px), 1fr))",
              gap: "1rem",
            }}
          >
            {lifecycleSteps.map((step) => {
              const border =
                step.emphasis === "violet"
                  ? "1px solid rgba(156, 137, 220, 0.55)"
                  : step.emphasis === "gold"
                    ? "1px solid rgba(220, 182, 92, 0.55)"
                    : "1px solid var(--line)";

              const background =
                step.emphasis === "violet"
                  ? "linear-gradient(155deg, rgba(86, 67, 145, 0.17), rgba(255,255,255,0.025))"
                  : step.emphasis === "gold"
                    ? "linear-gradient(155deg, rgba(151, 106, 40, 0.16), rgba(255,255,255,0.025))"
                    : "rgba(255,255,255,0.025)";

              return (
                <article
                  key={step.number}
                  className="card"
                  style={{
                    minHeight: 225,
                    border,
                    background,
                  }}
                >
                  <div
                    className="symbol"
                    style={{
                      fontSize: "0.8rem",
                      letterSpacing: "0.12em",
                      opacity: 0.72,
                    }}
                  >
                    {step.number}
                  </div>

                  <h3
                    className="h3"
                    style={{ marginTop: "0.7rem" }}
                  >
                    {step.title}
                  </h3>

                  <p className="copy">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "1.25rem",
            }}
          >
            <div
              className="pill"
              style={{
                padding: "0.7rem 1rem",
                borderColor:
                  "rgba(220, 182, 92, 0.55)",
              }}
            >
              Catch → Shape → Understand → Collaborate → Share →
              Return ↻
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div
            className="two-col"
            style={{ alignItems: "stretch" }}
          >
            <div
              className="card"
              style={{
                border:
                  "1px solid rgba(220, 182, 92, 0.48)",
                background:
                  "linear-gradient(145deg, rgba(151, 106, 40, 0.15), rgba(255,255,255,0.025))",
              }}
            >
              <div className="eyebrow">
                The song finds its listeners
              </div>

              <h2 className="h2">
                Sharing is part of the creative process
              </h2>

              <p className="copy">
                A song can be shared while it is developing or after
                it reaches Final. The Jukebox gives listeners a place
                to hear it, rate it, comment on it, and follow the
                story behind it.
              </p>

              <p className="copy">
                The response does not disappear into a feed. Plays,
                ratings, comments, and engagement return to the
                songwriter as new creative intelligence.
              </p>

              <div className="button-row">
                <Link
                  href="/listen"
                  className="button primary"
                >
                  Open the Jukebox
                </Link>

                <Link
                  href="/studio/capture"
                  className="button"
                >
                  Share a Song
                </Link>
              </div>
            </div>

            <div
              className="card"
              style={{
                position: "relative",
                overflow: "hidden",
                border:
                  "1px solid rgba(156, 137, 220, 0.45)",
                background:
                  "radial-gradient(circle at top right, rgba(93, 76, 150, 0.20), transparent 34%), rgba(255,255,255,0.025)",
              }}
            >
              <div className="eyebrow">
                Jukebox experience
              </div>

              <h3 className="h3">
                A song becomes a conversation
              </h3>

              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  borderRadius: 16,
                  border: "1px solid var(--line)",
                  background: "rgba(0,0,0,0.16)",
                }}
              >
                <div
                  className="pillRow"
                  style={{ marginBottom: "0.7rem" }}
                >
                  <span className="pill">Final</span>
                  <span className="pill">Muse-guided</span>
                  <span className="pill">Public</span>
                </div>

                <h4
                  className="h3"
                  style={{ marginBottom: "0.35rem" }}
                >
                  The song, its story, and the listener response
                </h4>

                <div
                  aria-hidden="true"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr",
                    alignItems: "center",
                    gap: "0.8rem",
                    marginTop: "1rem",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      border:
                        "1px solid rgba(220, 182, 92, 0.55)",
                      background:
                        "rgba(151, 106, 40, 0.18)",
                    }}
                  >
                    ▶
                  </div>

                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.09)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: "62%",
                        height: "100%",
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, rgba(220, 182, 92, 0.85), rgba(156, 137, 220, 0.75))",
                      }}
                    />
                  </div>
                </div>

                <div
                  className="pillRow"
                  style={{ marginTop: "1rem" }}
                >
                  <span className="pill">Plays</span>
                  <span className="pill">Ratings</span>
                  <span className="pill">Comments</span>
                  <span className="pill">
                    Listener insight
                  </span>
                </div>
              </div>

              <div
                className="quote-panel"
                style={{ marginTop: "1rem" }}
              >
                “The song’s journey does not end when it is shared.
                Connection becomes part of what the song teaches the
                songwriter next.”
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div className="card">
            <div className="eyebrow">
              Watch the current
            </div>

            <h2 className="h2">
              Follow iDreamMusic Songs on YouTube
            </h2>

            <p className="copy">
              iDreamMusic.com is the creative home base. YouTube
              extends the current through song clips, live
              performances, songcatcher stories, and Muse
              reflections.
            </p>

            <div className="quote-panel">
              Watch the videos. Follow the current. Then return for
              the deeper journey behind the song.
            </div>

            <div className="button-row">
              <a
                href={YOUTUBE_CHANNEL_URL}
                target="_blank"
                rel="noreferrer"
                className="button primary"
              >
                Watch on YouTube
              </a>

              <Link href="/listen" className="button">
                Listen on iDreamMusic
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="eyebrow">
              One music · Four visual traditions
            </div>

            <h2 className="h2">
              The Muses can reflect the songcatcher
            </h2>

            <p className="copy">
              The same nine creative currents can appear through
              different visual heritage themes without changing
              their meaning, intelligence, or role in the creative
              process.
            </p>

            <ul className="list">
              <li className="pill">
                Muses = universal currents
              </li>
              <li className="pill">
                Heritage = visual reflection
              </li>
              <li className="pill">
                Meaning remains consistent
              </li>
            </ul>

            <div className="button-row">
              <Link
                href="/profile/muse-representation"
                className="button primary"
              >
                Choose Muse Representation
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
              position: "relative",
              overflow: "hidden",
              textAlign: "center",
              padding: "clamp(1.5rem, 4vw, 3rem)",
              border:
                "1px solid rgba(220, 182, 92, 0.55)",
              background:
                "radial-gradient(circle at 50% 0%, rgba(151, 106, 40, 0.20), transparent 40%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
            }}
          >
            <div className="eyebrow">
              The next song may already be trying to reach you
            </div>

            <h2
              className="h2"
              style={{
                maxWidth: 900,
                margin: "0.65rem auto 0",
                fontSize: "clamp(2rem, 5vw, 4rem)",
                lineHeight: 1.05,
              }}
            >
              Catch it before it disappears.
            </h2>

            <p
              className="copy"
              style={{
                maxWidth: 780,
                margin: "1rem auto 0",
                fontSize: "1.08rem",
              }}
            >
              Discover its Muse. Understand what it needs. Invite
              another perspective. Share it when it is ready.
            </p>

            <div
              className="button-row"
              style={{
                justifyContent: "center",
                marginTop: "1.25rem",
              }}
            >
              <Link
                href="/studio/capture"
                className="button primary"
              >
                Catch a Song
              </Link>

              <Link
                href="/nine-muses"
                className="button"
              >
                Talk with a Muse
              </Link>

              <Link
                href="/listen"
                className="button"
              >
                Listen to the Jukebox
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
