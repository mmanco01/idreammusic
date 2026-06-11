import Image from 'next/image';
import Link from 'next/link';
import { veiledMuse } from '@/content/site';
import { getPublicSongsByMuse } from '@/lib/data';
import { SongUploadForm } from '@/components/studio/SongUploadForm';
import { selectableMuses } from '@/content/site';

export default async function VeiledMusePage() {
  const songs = await getPublicSongsByMuse('veiled');

  const museOptions = selectableMuses.map((item) => ({
    slug: item.slug,
    name: item.name,
    label: item.label,
  }));

  return (
    <section className="section">
      <div className="container">
        <div className="muse-page-grid">
          <div className="muse-card">
            <div className="oval-frame">
              <div className="oval-inner image-oval large-oval">
                <Image
                  src={veiledMuse.image}
                  alt={veiledMuse.name}
                  fill
                  className="muse-image"
                  sizes="(max-width: 980px) 100vw, 40vw"
                />
                <div className="image-overlay" />
                <div className="muse-image-content">
                  <div className="muse-label">{veiledMuse.name}</div>
                  <h1 className="h2" style={{ marginTop: '0.6rem', marginBottom: '0.4rem' }}>
                    {veiledMuse.label}
                  </h1>
                  <div className="symbol">{veiledMuse.symbol}</div>
                </div>
              </div>
            </div>
            <p className="copy">{veiledMuse.heroSubtitle}</p>
            <div className="quote-panel">{veiledMuse.closing}</div>
          </div>

          <div>
            <div className="eyebrow">
              {veiledMuse.name} — {veiledMuse.label}
            </div>
            <h2 className="h2">What This Is</h2>
            <p className="copy">{veiledMuse.whatThisMuseIs}</p>
            <div className="divider" />
            <h3 className="h3">The Current</h3>
            <p className="copy">{veiledMuse.current}</p>
            <div className="divider" />
            <h3 className="h3">How Songcatchers Recognize It</h3>
            <p className="copy">{veiledMuse.recognize}</p>
          </div>
        </div>

        <div className="section-tight" />

        <div className="two-col">
          <div className="card">
            <h3 className="h3">Emotional Territory</h3>
            <ul className="list">
              {veiledMuse.emotionalTerritory.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3 className="h3">What Belongs Here</h3>
            <ul className="list">
              {veiledMuse.genres.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="section-tight" />

        <div className="card">
          <div className="eyebrow">Upload directly here</div>
          <h2 className="h2">Catch a song before it is named</h2>
          <p className="copy" style={{ maxWidth: 760 }}>
            Use The Veiled Muse for sparks that are real but not yet ready to be classified under one of the named
            currents.
          </p>

          <SongUploadForm
            defaultMuseSlug="veiled"
            lockedMuse
            museOptions={museOptions}
          />
        </div>

        <div className="section-tight" />

        <div className="card">
          <div className="eyebrow">Songs held here</div>
          <h2 className="h2">Latest Veiled Muse songs</h2>

          {songs.length ? (
            <div className="song-grid">
              {songs.map((song) => (
                <article key={song.id} className="subsection">
                  <div className="pillRow" style={{ marginBottom: '.8rem' }}>
                    <span className="pill">{song.current_stage}</span>
                    {song.current_labels.map((label) => (
                      <span key={label} className="pill">
                        {label}
                      </span>
                    ))}
                  </div>

                  <h3 className="h3">
                    <Link href={`/songs/${song.slug}`}>{song.title}</Link>
                  </h3>

                  {song.summary ? <p className="copy">{song.summary}</p> : null}
                  {song.hook_line ? <div className="quote-panel">{song.hook_line}</div> : null}

                  {song.audio_url ? (
                    <audio controls preload="none" className="audioPlayer">
                      <source src={song.audio_url} />
                    </audio>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="copy">
              No public songs are currently held in The Veiled Muse.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}