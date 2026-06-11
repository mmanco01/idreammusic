import Link from 'next/link';

export default function SongcatchersPathPage() {
  const arrivalItems = [
    'a line',
    'a hook',
    'a groove',
    'a title',
    'a dream fragment',
    'a story image',
    'a spiritual impression',
    'a sudden emotional current',
  ];

  const sparkItems = [
    'voice memo',
    'single lyric line',
    'chorus idea',
    'guitar riff',
    'journal note',
    'dream image',
    'Muse impression',
    'title with emotional weight',
  ];

  const draftItems = [
    'building verses and chorus',
    'finding the right Muse current',
    'clarifying point of view',
    'testing melodic movement',
    'refining phrasing',
    'discovering what the song is really about',
    'keeping what is true and cutting what is merely clever',
  ];

  const finalItems = [
    'finished lyric',
    'demo',
    'home recording',
    'studio master',
    'live performance',
    'published song page',
    'released recording',
  ];

  const museItems = [
    'Story',
    'Roots',
    'Love',
    'Craft',
    'Blues',
    'Faith',
    'Rhythm',
    'Play',
    'Dream',
  ];

  const valuesItems = [
    'attention before production',
    'listening before control',
    'truth before performance',
    'offering before ego',
  ];

  return (
    <section className="section">
      <div className="container">
        <div className="card">
          <div className="eyebrow">Songcatcher&apos;s Path</div>
          <h1 className="h2">How songs move from spark to offering</h1>
          <p className="copy" style={{ maxWidth: 860 }}>
            At iDreamMusic, songs are not forced into existence. They are caught, honored,
            shaped, and released. Some arrive in dreams. Some rise out of memory, grief,
            faith, love, rhythm, or play. However they appear, each one begins as an arrival.
          </p>
          <div className="quote-panel">
            Songs are caught, not written.
          </div>
        </div>

        <div className="section-tight" />

        <div>
          <div className="eyebrow">The path</div>
          <h2 className="h2">Three stages of the current</h2>
          <div className="stage-grid">
            <div className="stage-card">
              <h3 className="h3">Stage 1: Spark</h3>
              <p className="copy">
                First arrival. The seed, the glimpse, the opening. A spark does not need to
                make sense yet. It only needs to be captured faithfully.
              </p>
            </div>
            <div className="stage-card">
              <h3 className="h3">Stage 2: Draft</h3>
              <p className="copy">
                The shaping phase. The spark is revisited, tested, extended, and interpreted
                until the emotional center and form of the song begin to emerge.
              </p>
            </div>
            <div className="stage-card">
              <h3 className="h3">Stage 3: Final Offering</h3>
              <p className="copy">
                The release. The song reaches a form worthy of sharing and enters
                relationship with listeners in the world.
              </p>
            </div>
          </div>
        </div>

        <div className="section-tight" />

        <div className="two-col">
          <div className="card">
            <div className="eyebrow">Before structure</div>
            <h2 className="h2">Songs are caught, not written</h2>
            <p className="copy">
              A song often begins before there is a structure for it. It may come as:
            </p>
            <ul className="list">
              {arrivalItems.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
            <div className="divider" />
            <p className="copy">
              The first job is not to control it. The first job is to notice it, honor it,
              and catch it before it disappears.
            </p>
          </div>

          <div className="card">
            <div className="eyebrow">Why it matters</div>
            <h2 className="h2">The deeper values</h2>
            <p className="copy">
              Modern songwriting often emphasizes output, polish, and speed. The
              Songcatcher&apos;s Path honors something older and deeper:
            </p>
            <ul className="list">
              {valuesItems.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
            <div className="divider" />
            <p className="copy">
              This path gives songs room to arrive honestly and become what they were meant
              to become.
            </p>
          </div>
        </div>

        <div className="section-tight" />

        <div className="card">
          <div className="eyebrow">How this works in iDreamMusic</div>
          <h2 className="h2">Catch, build, release</h2>
          <div className="stage-grid">
            <div className="stage-card">
              <h3 className="h3">Catch</h3>
              <p className="copy">
                Capture the spark through the Muse page that best fits the current. A voice
                memo, rough lyric, hook, or riff can become the first real entry.
              </p>
            </div>
            <div className="stage-card">
              <h3 className="h3">Build</h3>
              <p className="copy">
                Add drafts, lyrics, arrangement notes, story, and new versions as the song
                takes shape and reveals what it is really becoming.
              </p>
            </div>
            <div className="stage-card">
              <h3 className="h3">Release</h3>
              <p className="copy">
                Publish the final song, share the journey behind it, and invite listener
                response once the offering is ready.
              </p>
            </div>
          </div>
        </div>

        <div className="section-tight" />

        <div className="two-col">
          <div className="card">
            <div className="eyebrow">Spark</div>
            <h2 className="h2">What first arrival can look like</h2>
            <ul className="list">
              {sparkItems.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
            <div className="divider" />
            <p className="copy">
              Do not judge it too early. Do not over-arrange it. Do not demand that a seed
              already be a tree.
            </p>
          </div>

          <div className="card">
            <div className="eyebrow">Draft</div>
            <h2 className="h2">How the song reveals its shape</h2>
            <ul className="list">
              {draftItems.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
            <div className="divider" />
            <p className="copy">
              This is where craftsmanship joins inspiration. Stay true to the current that
              gave birth to the song.
            </p>
          </div>
        </div>

        <div className="section-tight" />

        <div className="two-col">
          <div className="card">
            <div className="eyebrow">Final offering</div>
            <h2 className="h2">What release may become</h2>
            <ul className="list">
              {finalItems.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
            <div className="divider" />
            <p className="copy">
              Final does not mean “finished forever.” It means the song has reached a form
              worthy of being shared.
            </p>
          </div>

          <div className="card">
            <div className="eyebrow">Nine Muses</div>
            <h2 className="h2">Naming the current</h2>
            <p className="copy">
              Along the way, a song often reveals its deeper current. The Muse does not limit
              the song. It helps name the movement running through it.
            </p>
            <ul className="list">
              {museItems.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="section-tight" />

        <div className="card">
          <div className="eyebrow">For songcatchers</div>
          <h2 className="h2">This path is probably already in you</h2>
          <p className="copy" style={{ maxWidth: 860 }}>
            If you are a writer, artist, dreamer, believer, musician, or listener, you may
            already know this path. You have felt the sudden line. You have heard the melody
            that came from nowhere. You have carried unfinished fragments for years. You have
            known the moment when a song finally becomes ready to leave your hands.
          </p>
          <div className="quote-panel">
            Catch the spark. Shape the draft. Offer the song.
          </div>

          <div className="pillRow" style={{ marginTop: '1rem' }}>
            <Link href="/nine-muses" className="pill">
              Explore the Nine Muses
            </Link>
            <Link href="/studio/capture" className="pill">
              Catch a new song
            </Link>
            <Link href="/listen" className="pill">
              Hear the current
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}