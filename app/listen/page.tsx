import Link from 'next/link';
import { SectionIntro } from '@/components/SectionIntro';
import { getSongs } from '@/lib/data';
import type { SongSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

const buckets = [
  {
    key: 'featured',
    title: 'Featured',
    text: 'The strongest front-window songs. This is the short shelf, not the warehouse.',
  },
  {
    key: 'finished',
    title: 'Finished',
    text: 'Public final versions, sorted by latest public activity.',
  },
  {
    key: 'crafting',
    title: 'Crafting',
    text: 'Songs moving through draft, arrangement, or cleanup.',
  },
  {
    key: 'sparks',
    title: 'Sparks',
    text: 'Early catches: fragments, hooks, voice memos, and first signs of a song.',
  },
] as const;

function stageLabel(song: SongSummary) {
  const stage = (song as any).version_stage || song.current_stage;
  if (stage === 'final') return 'Finished';
  if (stage === 'draft' || stage === 'crafting') return 'Crafting';
  return 'Spark';
}

function SongCard({ song }: { song: SongSummary }) {
  return (
    <article className="card">
      <div className="pillRow" style={{ marginBottom: '0.75rem' }}>
        <span className="pill">{song.muse_slug ?? 'unassigned'}</span>
        <span className="pill">{stageLabel(song)}</span>
        {(song as any).version_number ? <span className="pill">Version {(song as any).version_number}</span> : null}
      </div>

      <h3 className="h3">{song.title || 'Untitled song'}</h3>

      {song.hook_line ? <div className="quote-panel">{song.hook_line}</div> : null}

      <p className="copy">{song.summary || 'More story coming soon.'}</p>

      {song.audio_url ? (
        <div style={{ marginTop: '1rem' }}>
          <audio controls preload="none" style={{ width: '100%' }} src={song.audio_url}>
            Your browser does not support audio playback.
          </audio>
          {song.audio_title ? <p className="copy">{song.audio_title}</p> : null}
        </div>
      ) : null}

      <div className="button-row" style={{ marginTop: '1rem' }}>
        <Link href={`/songs/${song.slug}`} className="button primary">
          Open song page
        </Link>
      </div>
    </article>
  );
}

export default async function ListenPage() {
  const songs = await getSongs();

  return (
    <section className="section">
      <div className="container">
        <SectionIntro
          eyebrow="Listen"
          title="The iDreamMusic Jukebox"
          text="One song, one public current version. Full history lives on the individual song page. This keeps Listen clean without hiding the journey."
        />

        {buckets.map((bucket) => {
          const bucketSongs = songs.filter((song) => (song as any).primary_bucket === bucket.key);
          if (!bucketSongs.length) return null;

          return (
            <section key={bucket.key} style={{ marginTop: '2rem' }}>
              <div className="page-intro" style={{ marginBottom: '1rem' }}>
                <div>
                  <div className="eyebrow">{bucket.key}</div>
                  <h2 className="h2">{bucket.title}</h2>
                  <p className="copy" style={{ maxWidth: 760 }}>{bucket.text}</p>
                </div>
              </div>

              <div className="card-grid">
                {bucketSongs.map((song) => <SongCard key={song.id} song={song} />)}
              </div>
            </section>
          );
        })}

        {!songs.length ? (
          <div className="card">
            <h2 className="h3">No public songs yet</h2>
            <p className="copy">Publish a song/version and it will appear here automatically.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
