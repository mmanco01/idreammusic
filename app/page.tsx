import Link from 'next/link';
import { muses, featuredSongStages } from '@/content/site';
import MuseCard from '@/components/MuseCard';
import { SectionIntro } from '@/components/SectionIntro';
import { getMyMuseRepresentationTheme } from '@/lib/profile';
import { resolveMuseImage } from '@/lib/muse-representation';

const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/channel/UCR1rEksaVIVKrIdUf8qKRsw';

export default async function HomePage() {
  const theme = await getMyMuseRepresentationTheme();

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-card">
            <div className="hero-grid">
              <div>
                <div className="eyebrow">Shared home for songcatchers</div>
                <h1 className="display">Songs Are Caught, Not Written</h1>
                <p className="lead">
                  iDreamMusic is a shared creative home for songcatchers — people who discover songs in the flow of
                  life, dream, memory, faith, rhythm, love, pain, and wonder.
                </p>
                <p className="copy">
                  Not every song begins at a desk. Some arrive in a dream. Some rise from heartbreak. Some come through
                  prayer, groove, memory, or story. iDreamMusic is built around the idea that songs come through deeper
                  currents — and that those currents can be named, explored, honored, and shared.
                </p>
                <div className="button-row">
                  <Link href="/nine-muses" className="button primary">
                    Explore the Nine Muses
                  </Link>
                  <Link href="/studio" className="button">
                    Enter the Studio
                  </Link>
                  <Link href="/profile/muse-representation" className="button">
                    Choose Muse Representation
                  </Link>
                </div>
              </div>

              <div className="card">
                <div className="eyebrow">Now integrated</div>
                <h3 className="h3">A real song lifecycle underneath the Muse experience</h3>
                <p className="copy">
                  This version adds the underlying architecture for Spark → Draft → Final songs, writer notes with
                  private/public control, public blog posts that require owner approval, and listener-facing song pages.
                </p>
                <div className="quote-panel">
                  “Honor the mystery of becoming — not just the finished song.”
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div className="card">
            <div className="eyebrow">Watch the current</div>
            <h2 className="h2">Follow iDreamMusic Songs on YouTube</h2>
            <p className="copy">
              iDreamMusic.com is the home base for songs, Muses, story, and process. The YouTube channel is where the
              video side of the current begins to move — song clips, live performances, songcatcher stories, and Muse
              reflections.
            </p>
            <div className="quote-panel">
              Watch the videos. Follow the current. Then come back here for the deeper journey behind the song.
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
            <div className="eyebrow">How it works</div>
            <h2 className="h2">One music. Four visual traditions.</h2>
            <p className="copy">
              The website holds the song world itself — Muse pages, song stages, notes, and the path from spark to
              final offering. Your Muse Representation setting lets the same nine creative currents appear through
              different visual heritage themes without changing their meanings.
            </p>
            <ul className="list">
              <li className="pill">Website = home base</li>
              <li className="pill">YouTube = discovery + video</li>
              <li className="pill">Muses = universal currents</li>
              <li className="pill">Heritage = visual reflection</li>
            </ul>
            <div className="button-row">
              <Link href="/profile/muse-representation" className="button">
                Choose Muse Representation
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionIntro
            eyebrow="Welcome"
            title="The Nine Muses"
            text="The Nine Muses are nine creative currents through which songs are caught. Each Muse represents a different source of inspiration and a different interior landscape. Together, they form the living map of iDreamMusic."
          />
          <div className="muse-grid">
            {muses.map((muse) => (
              <MuseCard
                key={muse.slug}
                muse={muse}
                imageOverride={resolveMuseImage(muse.slug, muse.image, theme)}
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
            eyebrow="Song journey"
            title="How a Song Moves Through the Current"
            text="Every song on iDreamMusic can now be traced through stages of becoming. A song may begin as a dream fragment, a phrase, a melody, a symbolic image, or a deep emotional impression. Over time it can move into words, chords, structure, public notes, blog posts, and final release."
          />
          <div className="stage-grid">
            {featuredSongStages.map((stage) => (
              <div key={stage.title} className="stage-card">
                <h3 className="h3">{stage.title}</h3>
                <p className="copy">{stage.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div className="card">
            <div className="eyebrow">Creator side</div>
            <h2 className="h2">Capture, build, and release</h2>
            <p className="copy">
              Writers can capture sparks, keep notes private or make them public, shape multiple versions, and submit
              blog posts into an approval queue before they go public on the site.
            </p>
            <Link href="/studio/capture" className="button">
              Capture a spark
            </Link>
          </div>

          <div className="card">
            <div className="eyebrow">Public side</div>
            <h2 className="h2">A framework, not just an archive</h2>
            <p className="copy">
              Listeners can follow the story of a song, explore notes that the writer chooses to reveal, and engage
              with final songs and approved process stories as the public portal grows.
            </p>
            <Link href="/songs" className="button">
              Browse songs
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}