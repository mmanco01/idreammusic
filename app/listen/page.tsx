import Link from 'next/link';
import { SectionIntro } from '@/components/SectionIntro';
import { getSongs } from '@/lib/data';
import type { SongSummary } from '@/lib/types';
import { TrackedAudioPlayer } from '@/components/TrackedAudioPlayer';

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

function numberValue(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function getSongMetrics(song: SongSummary) {
  const item = song as any;
  const engagement = item.engagement ?? item.song_engagement ?? {};

  const listens = numberValue(
    item.listen_count,
    item.listens_count,
    item.total_listens,
    item.play_count,
    item.plays,
    engagement.listen_count,
    engagement.total_listens,
    engagement.play_count,
  );

  const averageRating = numberValue(
    item.average_rating,
    item.rating_average,
    item.avg_rating,
    engagement.average_rating,
    engagement.rating_average,
  );

  const ratingCount = numberValue(
    item.rating_count,
    item.ratings_count,
    item.total_ratings,
    engagement.rating_count,
    engagement.total_ratings,
  );

  const favorites = numberValue(
    item.favorite_count,
    item.favorites_count,
    item.total_favorites,
    engagement.favorite_count,
    engagement.total_favorites,
  );

  const videoClicks = numberValue(
    item.video_click_count,
    item.video_clicks,
    item.video_play_count,
    item.video_plays,
    engagement.video_click_count,
    engagement.video_clicks,
  );

  return {
    listens,
    averageRating,
    ratingCount,
    favorites,
    videoClicks,
  };
}

function SongMetrics({ song }: { song: SongSummary }) {
  const metrics = getSongMetrics(song);

  return (
    <div
      aria-label="Song engagement"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.55rem 1rem',
        marginTop: '0.9rem',
        padding: '0.7rem 0',
        borderTop: '1px solid rgba(255,255,255,0.12)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        fontSize: '0.9rem',
        opacity: 0.88,
      }}
    >
      <span title="Total listens">
        ▶ {metrics.listens.toLocaleString()} listens
      </span>

      <span title="Average listener rating">
        ★{' '}
        {metrics.ratingCount > 0
          ? metrics.averageRating.toFixed(1)
          : 'Not rated'}
        {metrics.ratingCount > 0
          ? ` (${metrics.ratingCount.toLocaleString()})`
          : ''}
      </span>

      <span title="Favorites">
        ♥ {metrics.favorites.toLocaleString()}
      </span>

      <span title="Video plays or clicks">
        ▷ {metrics.videoClicks.toLocaleString()} video
      </span>
    </div>
  );
}

function SongCard({ song }: { song: SongSummary }) {
  return (
    <article className="card">
      <div className="pillRow" style={{ marginBottom: '0.75rem' }}>
        <span className="pill">{song.muse_slug ?? 'unassigned'}</span>
        <span className="pill">{stageLabel(song)}</span>

        {(song as any).version_number ? (
          <span className="pill">
            Version {(song as any).version_number}
          </span>
        ) : null}
      </div>

      <h3 className="h3">{song.title || 'Untitled song'}</h3>

      {song.hook_line ? (
        <div className="quote-panel">{song.hook_line}</div>
      ) : null}

      <p className="copy">
        {song.summary || 'More story coming soon.'}
      </p>

      <SongMetrics song={song} />

      {song.audio_url ? (
        <div style={{ marginTop: '1rem' }}>
<TrackedAudioPlayer
  songId={song.id}
  songVersionId={(song as any).song_version_id ?? null}
  audioUrl={song.audio_url}
/>

          {song.audio_title ? (
            <p className="copy">{song.audio_title}</p>
          ) : null}
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
          const bucketSongs = songs.filter(
            (song) => (song as any).primary_bucket === bucket.key,
          );

          if (!bucketSongs.length) return null;

          return (
            <section key={bucket.key} style={{ marginTop: '2rem' }}>
              <div
                className="page-intro"
                style={{ marginBottom: '1rem' }}
              >
                <div>
                  <div className="eyebrow">{bucket.key}</div>
                  <h2 className="h2">{bucket.title}</h2>

                  <p className="copy" style={{ maxWidth: 760 }}>
                    {bucket.text}
                  </p>
                </div>
              </div>

              <div className="card-grid">
                {bucketSongs.map((song) => (
                  <SongCard key={song.id} song={song} />
                ))}
              </div>
            </section>
          );
        })}

        {!songs.length ? (
          <div className="card">
            <h2 className="h3">No public songs yet</h2>

            <p className="copy">
              Publish a song/version and it will appear here automatically.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
