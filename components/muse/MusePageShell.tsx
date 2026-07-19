import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { muses } from '@/content/site';
import { getPublicSongsByMuse } from '@/lib/data';
import { SongUploadForm } from '@/components/studio/SongUploadForm';
import { MuseChatPanel } from '@/components/studio/MuseChatPanel';
import { getMyMuseRepresentationTheme } from '@/lib/profile';
import { resolveMuseImage } from '@/lib/muse-representation';
import { MUSE_OPTIONS } from '@/lib/muses';

type Props = {
  slug: string;
};

export async function MusePageShell({ slug }: Props) {
  const muse = muses.find((item) => item.slug === slug);
  if (!muse) notFound();

  const songs = await getPublicSongsByMuse(slug);
  const museOptions = muses.map((item) => ({
    slug: item.slug,
    name: item.name,
    label: item.label,
  }));

  const theme = await getMyMuseRepresentationTheme();
  const museImage = resolveMuseImage(muse.slug, muse.image, theme);

  return (
    <section className="section">
      <div className="container">
        <div className="muse-page-grid">
          <div className="muse-card">
            <div className="oval-frame">
              <div className="oval-inner image-oval large-oval">
                <Image
                  src={museImage}
                  alt={`${muse.name} portrait`}
                  fill
                  className="muse-image"
                  sizes="(max-width: 980px) 100vw, 40vw"
                />
                <div className="image-overlay" />
                <div className="muse-image-content">
                  <div className="muse-label">{muse.name}</div>
                  <h1 className="h2" style={{ marginTop: '0.6rem', marginBottom: '0.4rem' }}>
                    {muse.label}
                  </h1>
                  <div className="symbol">{muse.symbol}</div>
                </div>
              </div>
            </div>
            <p className="copy">{muse.heroSubtitle}</p>
            <div className="quote-panel">{muse.closing}</div>
          </div>

          <div>
            <div className="eyebrow">
              {muse.name} — {muse.label}
            </div>
            <h2 className="h2">What This Muse Is</h2>
            <p className="copy">{muse.whatThisMuseIs}</p>
            <div className="divider" />
            <h3 className="h3">The Current</h3>
            <p className="copy">{muse.current}</p>
            <div className="divider" />
            <h3 className="h3">How Songcatchers Recognize This Muse</h3>
            <p className="copy">{muse.recognize}</p>
          </div>
        </div>

        <div className="section-tight" />

        <div className="two-col">
          <div className="card">
            <h3 className="h3">Emotional Territory</h3>
            <ul className="list">
              {muse.emotionalTerritory.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3 className="h3">Styles & Genre Expressions</h3>
            <ul className="list">
              {muse.genres.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="section-tight" />

        <div className="card">
          <h3 className="h3">Lyrical Themes</h3>
          <ul className="list">
            {muse.lyricalThemes.map((item) => (
              <li key={item} className="pill">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="section-tight" />

        <div>
          <div className="eyebrow">Song journey library</div>
          <h2 className="h2">From spark to song</h2>
          <div className="stage-grid">
            <div className="stage-card">
              <h3 className="h3">Dream Description</h3>
              <p className="copy">{muse.dreamDescription}</p>
            </div>
            <div className="stage-card">
              <h3 className="h3">First Draft</h3>
              <p className="copy">{muse.firstDraft}</p>
            </div>
            <div className="stage-card">
              <h3 className="h3">Final Song</h3>
              <p className="copy">{muse.finalSong}</p>
            </div>
          </div>
        </div>

        <div className="section-tight" />

        <div className="card">
          <div className="eyebrow">Upload directly here</div>
          <h2 className="h2">Catch and share in this Muse</h2>
          <p className="copy" style={{ maxWidth: 760 }}>
            This page is now a real entry point. Authenticated users can upload an audio file straight into {muse.name},
            create the song record, and decide whether it should appear publicly right away.
          </p>
          <SongUploadForm defaultMuseSlug={muse.slug} lockedMuse museOptions={museOptions} />
        </div>

        <div className="section-tight" />

        <div className="card">
          <div className="eyebrow">Songs caught in this current</div>
          <h2 className="h2">Latest uploads in {muse.name}</h2>
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
            <p className="copy">No public uploads have landed in this Muse yet.</p>
          )}
        </div>

        <div className="section-tight" />

        <div className="card">
          <div className="eyebrow">Example songs</div>
          <h2 className="h2">Songs that live in this current</h2>
          <div className="examples-grid">
            {muse.exampleSongs.map((song) => (
              <div key={`${song.title}-${song.artist}`} className="example-card">
                <h3 className="h3">{song.title}</h3>
                <div className="symbol" style={{ marginBottom: '0.6rem' }}>
                  {song.artist}
                </div>
                <p className="copy">{song.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="section-tight" />

        <div className="two-col">
          <div className="card">
            <h3 className="h3">For Creators</h3>
            <p className="copy">{muse.forCreators}</p>
          </div>
          <div className="card">
            <h3 className="h3">Related Muses</h3>
            <ul className="list">
              {muse.related.map((item) => (
                <li key={item} className="pill">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="section-tight" />

        <MuseChatPanel
          defaultMuseSlug={muse.slug}
          museOptions={MUSE_OPTIONS}
          lockedMuse
        />       
      </div>
    </section>
  );
}
