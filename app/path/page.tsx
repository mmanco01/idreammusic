export default function SongcatchersPathPage() {
  const arrivalItems = [
    "a line",
    "a hook",
    "a groove",
    "a title",
    "a dream fragment",
    "a story image",
    "a spiritual impression",
    "a sudden emotional current",
  ];

  const sparkItems = [
    "a voice memo sung into a phone",
    "a single lyric line",
    "a chorus idea",
    "a guitar riff",
    "a journal note",
    "a dream image",
    "a Muse impression",
    "a title with emotional weight",
  ];

  const draftItems = [
    "building verses and chorus",
    "finding the right Muse current",
    "clarifying point of view",
    "testing melodic movement",
    "refining phrasing",
    "discovering what the song is really about",
    "keeping what is true and cutting what is merely clever",
  ];

  const finalItems = [
    "a finished lyric",
    "a demo",
    "a home recording",
    "a studio master",
    "a live performance",
    "a published song page",
    "a released recording",
  ];

  const museItems = [
    "Story",
    "Roots",
    "Love",
    "Craft",
    "Blues",
    "Faith",
    "Rhythm",
    "Play",
    "Dream",
  ];

  const valuesItems = [
    "attention before production",
    "listening before control",
    "truth before performance",
    "offering before ego",
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:px-8 lg:py-24">
      <article className="space-y-16">
        <header className="space-y-6 border-b border-white/10 pb-10">
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            The Songcatcher&apos;s Path
          </h1>

          <div className="space-y-5 text-lg leading-8 text-white/75">
            <p>
              At iDreamMusic, songs are not forced into existence. They are
              caught.
            </p>
            <p>
              Some arrive in dreams. Some rise out of memory, grief, faith,
              love, rhythm, or play. Some come as a phrase, a melody, an image,
              or a feeling that will not leave you alone. However they appear,
              each one begins as an arrival.
            </p>
            <p>
              The Songcatcher&apos;s Path is the journey a song takes from that
              first moment of contact to its final offering in the world.
            </p>
          </div>
        </header>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            Songs are caught, not written
          </h2>

          <div className="space-y-5 leading-8 text-white/75">
            <p>
              A song often begins before there is a structure for it.
              <br />
              It may come as:
            </p>

            <ul className="space-y-2 pl-6">
              {arrivalItems.map((item) => (
                <li key={item} className="list-disc marker:text-white/40">
                  {item}
                </li>
              ))}
            </ul>

            <p>
              The songwriter&apos;s first job is not to control it.
              <br />
              The first job is to notice it, honor it, and catch it before it
              disappears.
            </p>

            <p>That is where the path begins.</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            Stage 1: Spark
          </h2>

          <div className="space-y-5 leading-8 text-white/75">
            <p>
              A <strong className="text-white">Spark</strong> is first arrival.
            </p>

            <p>
              This is the raw moment — the seed, the glimpse, the opening. It
              may be incomplete, messy, or mysterious. A spark does not need to
              make sense yet. It only needs to be captured.
            </p>

            <p>A spark might be:</p>

            <ul className="space-y-2 pl-6">
              {sparkItems.map((item) => (
                <li key={item} className="list-disc marker:text-white/40">
                  {item}
                </li>
              ))}
            </ul>

            <p>
              At this stage, the goal is simple:{" "}
              <strong className="text-white">catch it faithfully</strong>.
            </p>

            <p>
              Do not judge it too early.
              <br />
              Do not over-arrange it.
              <br />
              Do not demand that a seed already be a tree.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            Stage 2: Draft
          </h2>

          <div className="space-y-5 leading-8 text-white/75">
            <p>
              A <strong className="text-white">Draft</strong> is where the song
              begins to reveal its shape.
            </p>

            <p>
              This is the working phase. The spark is revisited, tested,
              extended, and interpreted. Lyrics begin to connect. Melody finds a
              home. Sections emerge. The emotional center becomes clearer.
            </p>

            <p>Drafting may include:</p>

            <ul className="space-y-2 pl-6">
              {draftItems.map((item) => (
                <li key={item} className="list-disc marker:text-white/40">
                  {item}
                </li>
              ))}
            </ul>

            <p>This is where craftsmanship joins inspiration.</p>

            <p>
              A song in draft is still alive and becoming. It may change key,
              point of view, tempo, title, or meaning. What matters is not
              perfection. What matters is staying true to the current that gave
              birth to it.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            Stage 3: Final Offering
          </h2>

          <div className="space-y-5 leading-8 text-white/75">
            <p>
              A <strong className="text-white">Final Offering</strong> is the
              song brought forward with intention.
            </p>

            <p>
              This does not always mean the song is “finished forever.” It means
              it has reached a form worthy of sharing. It has become coherent
              enough, truthful enough, and complete enough to be offered to
              listeners.
            </p>

            <p>A final offering may take many forms:</p>

            <ul className="space-y-2 pl-6">
              {finalItems.map((item) => (
                <li key={item} className="list-disc marker:text-white/40">
                  {item}
                </li>
              ))}
            </ul>

            <p>This stage is not just about polish. It is about release.</p>

            <p>
              The song leaves the private room and enters relationship with
              other people.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            The path is not always linear
          </h2>

          <div className="space-y-5 leading-8 text-white/75">
            <p>Not every song moves in a straight line.</p>

            <p>
              Some sparks sleep for years before becoming drafts.
              <br />
              Some drafts split into two different songs.
              <br />
              Some final offerings later reveal a deeper version still waiting
              underneath.
            </p>

            <p>That is normal.</p>

            <p>
              The Songcatcher&apos;s Path is not a factory line. It is a living
              current. Songs arrive differently because they carry different
              assignments.
            </p>

            <p>
              The task is not to force them into sameness.
              <br />
              The task is to follow them faithfully from arrival to offering.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            The role of the Muses
          </h2>

          <div className="space-y-5 leading-8 text-white/75">
            <p>Along the way, a song often reveals its deeper current.</p>

            <p>At iDreamMusic, these currents are reflected in the Nine Muses:</p>

            <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {museItems.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/85"
                >
                  {item}
                </li>
              ))}
            </ul>

            <p>
              A song may begin in one place and deepen into another.
              <br />
              A dream may become a love song.
              <br />
              A blues song may uncover a story.
              <br />
              A crafted lyric may open into faith.
            </p>

            <p>
              The Muse does not limit the song.
              <br />
              It helps name the current moving through it.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            Why this path matters
          </h2>

          <div className="space-y-5 leading-8 text-white/75">
            <p>
              Modern songwriting often emphasizes output, polish, and speed.
              <br />
              The Songcatcher&apos;s Path honors something older and deeper:
            </p>

            <ul className="space-y-2 pl-6">
              {valuesItems.map((item) => (
                <li key={item} className="list-disc marker:text-white/40">
                  {item}
                </li>
              ))}
            </ul>

            <p>
              This path gives songs room to arrive honestly and become what they
              were meant to become.
            </p>

            <p>
              It also gives the songwriter a way to work with inspiration
              instead of against it.
            </p>
          </div>
        </section>

        <section className="space-y-6 border-t border-white/10 pt-10">
          <h2 className="text-2xl font-semibold text-white">
            For songcatchers
          </h2>

          <div className="space-y-5 leading-8 text-white/75">
            <p>
              If you are a writer, artist, dreamer, believer, musician, or
              listener, you may already know this path.
            </p>

            <p>
              You have felt the sudden line.
              <br />
              You have heard the melody that came from nowhere.
              <br />
              You have carried unfinished fragments for years.
              <br />
              You have known the moment when a song finally becomes ready to
              leave your hands.
            </p>

            <p>That is the Songcatcher&apos;s Path.</p>

            <p className="text-lg text-white">
              Catch the spark.
              <br />
              Shape the draft.
              <br />
              Offer the song.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}