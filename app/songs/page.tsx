import Link from 'next/link';
import { getSongs } from '@/lib/data';

export default async function SongsPage() {
  const songs = await getSongs();

  return (
    <section className="section">
      <div className="container">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Public songs</div>
            <h1 className="h2">Song catalog</h1>
            <p className="copy" style={{ maxWidth: 780 }}>
              Browse live uploads across the full current: spark, first draft, and final song. When Supabase is wired,
              this page reads the real catalog and each card links to the full song story and audio.
            </p>
          </div>
          <Link className="button" href="/studio/capture">
            Upload a song
          </Link>
        </div>

        <div className="song-grid">
          {songs.map((song) => (
            <article key={song.id} className="card">
              <div className="pillRow">
                <span className="pill">{song.current_stage}</span>
                {song.muse_slug ? <span className="pill">{song.muse_slug}</span> : null}
              </div>
              <h3 className="h3">
                <Link href={`/songs/${song.slug}`}>{song.title}</Link>
              </h3>
              {song.summary ? <p className="copy">{song.summary}</p> : null}
              {song.hook_line ? <div className="quote-panel" style={{ marginTop: '1rem' }}>{song.hook_line}</div> : null}
              {song.audio_url ? (
                <audio controls preload="none" className="audioPlayer">
                  <source src={song.audio_url} />
                </audio>
              ) : null}
              {song.current_labels.length ? (
                <ul className="list" style={{ marginTop: '1rem' }}>
                  {song.current_labels.map((label) => (
                    <li key={label} className="pill">
                      {label}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
