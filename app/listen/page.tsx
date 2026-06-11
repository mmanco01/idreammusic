import Link from 'next/link';
import { SectionIntro } from '@/components/SectionIntro';
import { selectableMuses } from '@/content/site';
import { getSongs } from '@/lib/data';

const SONG_ORIGIN_LABELS: Record<string, string> = {
  dream: 'Dreamborn',
  comment: 'Comment-born',
  thought: 'Thought-born',
  road: 'Road-born',
  conversation: 'Conversation-born',
  prayer: 'Prayer-born',
  memory: 'Memory-born',
  image: 'Image-born',
  riff: 'Riff-born',
  title: 'Title-born',
  journal: 'Journal-born',
  performance: 'Performance-born',
  other: 'Other arrival',
};

function SongCard({ song }: { song: any }) {
  const muse = selectableMuses.find((item) => item.slug === song.muse_slug);

  return (
    <article className="subsection">
      <div className="pillRow" style={{ marginBottom: '.8rem' }}>
        {song.current_stage ? <span className="pill">{song.current_stage}</span> : null}
        {song.song_origin ? (
          <span className="pill">
            {SONG_ORIGIN_LABELS[song.song_origin] ?? song.song_origin}
          </span>
        ) : null}
        {muse ? <span className="pill">{muse.name}</span> : null}
        {(song.current_labels ?? []).map((label: string) => (
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

      <div className="button-row" style={{ marginTop: '0.9rem' }}>
        <Link href={`/songs/${song.slug}`} className="button">
          Open song
        </Link>
      </div>
    </article>
  );
}

function SongSection({
  eyebrow,
  title,
  text,
  songs,
  emptyText,
}: {
  eyebrow: string;
  title: string;
  text: string;
  songs: any[];
  emptyText: string;
}) {
  return (
    <section className="section">
      <div className="container">
        <SectionIntro eyebrow={eyebrow} title={title} text={text} />
        {songs.length ? (
          <div className="song-grid">
            {songs.map((song) => (
              <SongCard key={song.id} song={song} />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="copy">{emptyText}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default async function ListenPage() {
  const songs = await getSongs();

  const finalSongs = songs.filter((song) => song.current_stage === 'final');
  const featuredSongs = finalSongs.length ? finalSongs.slice(0, 6) : songs.slice(0, 6);

  const dreambornSongs = songs
    .filter((song) => song.song_origin === 'dream')
    .slice(0, 6);

  const songsInProgress = songs
    .filter((song) => song.current_stage === 'spark' || song.current_stage === 'draft')
    .slice(0, 6);

  const veiledSongs = songs
    .filter((song) => song.muse_slug === 'veiled')
    .slice(0, 6);

  const allRecentSongs = songs.slice(0, 12);

  return (
    <>
      <section className="section">
        <div className="container">
          <SectionIntro
            eyebrow="Listen"
            title="Songs in the current"
            text="This is where finished songs, dreamborn arrivals, developing drafts, and newly caught sparks begin to gather. Muse tells you what current the song belongs to. How It Arrived tells you how it first came into the world."
          />

          <div className="pillRow" style={{ marginTop: '1rem' }}>
            {selectableMuses.map((muse) => (
              <span key={muse.slug} className="pill">
                {muse.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <SongSection
        eyebrow="Featured"
        title="Featured Songs"
        text="Public songs that are most ready to represent the site right now."
        songs={featuredSongs}
        emptyText="No featured public songs yet."
      />

      <SongSection
        eyebrow="Origin-based"
        title="Dreamborn Songs"
        text="Dreamborn Songs are defined by how they arrived, not by which Muse they eventually belong to."
        songs={dreambornSongs}
        emptyText="No public Dreamborn songs yet."
      />

      <SongSection
        eyebrow="Still becoming"
        title="Songs in Progress"
        text="These songs are still moving through spark and draft stages."
        songs={songsInProgress}
        emptyText="No public songs in progress yet."
      />

      <SongSection
        eyebrow="Before the current is known"
        title="The Veiled Muse"
        text="These are songs held in The Veiled Muse — real sparks whose deeper current has not yet been named."
        songs={veiledSongs}
        emptyText="No public songs are currently held in The Veiled Muse."
      />

      <SongSection
        eyebrow="Latest"
        title="Recent Songs"
        text="A broader look at the latest public songs now visible on iDreamMusic."
        songs={allRecentSongs}
        emptyText="No public songs are available yet."
      />
    </>
  );
}