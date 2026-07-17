'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { TrackedAudioPlayer } from '@/components/TrackedAudioPlayer';
import type { SongSummary } from '@/lib/types';

type ListenJukeboxProps = {
  songs: SongSummary[];
};

type ExtendedSongSummary = SongSummary & {
  listen_count?: number | string | null;
  audio_play_count?: number | string | null;
  average_rating?: number | string | null;
  rating_count?: number | string | null;
  favorite_count?: number | string | null;
  video_click_count?: number | string | null;

  songwriter?: string | null;
  songwriter_name?: string | null;
  writer_name?: string | null;

  genre?: string | null;
  genre_name?: string | null;
};

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
  const stage = song.version_stage || song.current_stage;

  if (stage === 'final') return 'Finished';

  if (stage === 'draft' || stage === 'crafting') {
    return 'Crafting';
  }

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

function getSongMetrics(song: ExtendedSongSummary) {
  return {
    listens: numberValue(
      song.listen_count,
      song.audio_play_count
    ),

    averageRating: numberValue(
      song.average_rating
    ),

    ratingCount: numberValue(
      song.rating_count
    ),

    favorites: numberValue(
      song.favorite_count
    ),

    videoClicks: numberValue(
      song.video_click_count
    ),
  };
}

function getSongwriter(song: ExtendedSongSummary) {
  return (
    song.songwriter_name ??
    song.writer_name ??
    song.songwriter ??
    null
  );
}

function getGenre(song: ExtendedSongSummary) {
  return song.genre_name ?? song.genre ?? null;
}

function SongMetrics({ song }: { song: ExtendedSongSummary }) {
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

function SongCard({ song }: { song: ExtendedSongSummary }) {
  return (
    <article className="card">
      <div
        className="pillRow"
        style={{ marginBottom: '0.75rem' }}
      >
        <span className="pill">
          {song.muse_slug ?? 'unassigned'}
        </span>

        <span className="pill">
          {stageLabel(song)}
        </span>

        {song.version_number ? (
          <span className="pill">
            Version {song.version_number}
          </span>
        ) : null}
      </div>

      <h3 className="h3">
        {song.title || 'Untitled song'}
      </h3>

      {song.hook_line ? (
        <div className="quote-panel">
          {song.hook_line}
        </div>
      ) : null}

      <p className="copy">
        {song.summary || 'More story coming soon.'}
      </p>

      <SongMetrics song={song} />

      {song.audio_url ? (
        <div style={{ marginTop: '1rem' }}>
          <TrackedAudioPlayer
            songId={song.id}
            songVersionId={song.song_version_id ?? null}
            audioUrl={song.audio_url}
          />

          {song.audio_title ? (
            <p className="copy">
              {song.audio_title}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className="button-row"
        style={{ marginTop: '1rem' }}
      >
        <Link
          href={`/songs/${song.slug}`}
          className="button primary"
        >
          Open song page
        </Link>
      </div>
    </article>
  );
}

function formatOption(value: string) {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ListenJukebox({
  songs,
}: ListenJukeboxProps) {
  const extendedSongs = songs as ExtendedSongSummary[];

  const [search, setSearch] = useState('');
  const [museFilter, setMuseFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [songwriterFilter, setSongwriterFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');

  const museOptions = useMemo(() => {
    return Array.from(
      new Set(
        extendedSongs
          .map((song) => song.muse_slug)
          .filter((value): value is string => Boolean(value))
      )
    ).sort();
  }, [extendedSongs]);

  const stageOptions = useMemo(() => {
    return Array.from(
      new Set(
        extendedSongs.map((song) => stageLabel(song))
      )
    ).sort();
  }, [extendedSongs]);

  const songwriterOptions = useMemo(() => {
    return Array.from(
      new Set(
        extendedSongs
          .map(getSongwriter)
          .filter((value): value is string => Boolean(value))
      )
    ).sort();
  }, [extendedSongs]);

  const genreOptions = useMemo(() => {
    return Array.from(
      new Set(
        extendedSongs
          .map(getGenre)
          .filter((value): value is string => Boolean(value))
      )
    ).sort();
  }, [extendedSongs]);

  const filteredSongs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return extendedSongs.filter((song) => {
      const matchesSearch =
        !normalizedSearch ||
        song.title.toLowerCase().includes(normalizedSearch) ||
        song.summary?.toLowerCase().includes(normalizedSearch) ||
        song.hook_line?.toLowerCase().includes(normalizedSearch);

      const matchesMuse =
        museFilter === 'all' ||
        song.muse_slug === museFilter;

      const matchesStage =
        stageFilter === 'all' ||
        stageLabel(song) === stageFilter;

      const matchesSongwriter =
        songwriterFilter === 'all' ||
        getSongwriter(song) === songwriterFilter;

      const matchesGenre =
        genreFilter === 'all' ||
        getGenre(song) === genreFilter;

      return (
        matchesSearch &&
        matchesMuse &&
        matchesStage &&
        matchesSongwriter &&
        matchesGenre
      );
    });
  }, [
    extendedSongs,
    search,
    museFilter,
    stageFilter,
    songwriterFilter,
    genreFilter,
  ]);

  const hasFilters =
    search !== '' ||
    museFilter !== 'all' ||
    stageFilter !== 'all' ||
    songwriterFilter !== 'all' ||
    genreFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setMuseFilter('all');
    setStageFilter('all');
    setSongwriterFilter('all');
    setGenreFilter('all');
  }

  return (
    <>
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          padding: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}
        >
          <label>
            <span
              className="copy"
              style={{
                display: 'block',
                marginBottom: '0.35rem',
              }}
            >
              Search
            </span>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search songs"
              style={{
                width: '100%',
                minHeight: 44,
                padding: '0.65rem 0.75rem',
                borderRadius: 8,
              }}
            />
          </label>

          <label>
            <span
              className="copy"
              style={{
                display: 'block',
                marginBottom: '0.35rem',
              }}
            >
              Muse
            </span>

            <select
              value={museFilter}
              onChange={(event) =>
                setMuseFilter(event.target.value)
              }
              style={{
                width: '100%',
                minHeight: 44,
                padding: '0.65rem 0.75rem',
                borderRadius: 8,
              }}
            >
              <option value="all">All muses</option>

              {museOptions.map((muse) => (
                <option key={muse} value={muse}>
                  {formatOption(muse)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span
              className="copy"
              style={{
                display: 'block',
                marginBottom: '0.35rem',
              }}
            >
              Stage
            </span>

            <select
              value={stageFilter}
              onChange={(event) =>
                setStageFilter(event.target.value)
              }
              style={{
                width: '100%',
                minHeight: 44,
                padding: '0.65rem 0.75rem',
                borderRadius: 8,
              }}
            >
              <option value="all">All stages</option>

              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>

          {songwriterOptions.length > 0 ? (
            <label>
              <span
                className="copy"
                style={{
                  display: 'block',
                  marginBottom: '0.35rem',
                }}
              >
                Songwriter
              </span>

              <select
                value={songwriterFilter}
                onChange={(event) =>
                  setSongwriterFilter(event.target.value)
                }
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: '0.65rem 0.75rem',
                  borderRadius: 8,
                }}
              >
                <option value="all">
                  All songwriters
                </option>

                {songwriterOptions.map((songwriter) => (
                  <option
                    key={songwriter}
                    value={songwriter}
                  >
                    {songwriter}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {genreOptions.length > 0 ? (
            <label>
              <span
                className="copy"
                style={{
                  display: 'block',
                  marginBottom: '0.35rem',
                }}
              >
                Genre
              </span>

              <select
                value={genreFilter}
                onChange={(event) =>
                  setGenreFilter(event.target.value)
                }
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: '0.65rem 0.75rem',
                  borderRadius: 8,
                }}
              >
                <option value="all">
                  All genres
                </option>

                {genreOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginTop: '1rem',
          }}
        >
          <p className="copy" style={{ margin: 0 }}>
            Showing {filteredSongs.length} of{' '}
            {extendedSongs.length} songs
          </p>

          {hasFilters ? (
            <button
              type="button"
              className="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {buckets.map((bucket) => {
        const bucketSongs = filteredSongs.filter(
          (song) => song.primary_bucket === bucket.key
        );

        if (!bucketSongs.length) return null;

        return (
          <section
            key={bucket.key}
            style={{ marginTop: '2rem' }}
          >
            <div
              className="page-intro"
              style={{ marginBottom: '1rem' }}
            >
              <div>
                <div className="eyebrow">
                  {bucket.key}
                </div>

                <h2 className="h2">
                  {bucket.title}
                </h2>

                <p
                  className="copy"
                  style={{ maxWidth: 760 }}
                >
                  {bucket.text}
                </p>
              </div>
            </div>

            <div className="card-grid">
              {bucketSongs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                />
              ))}
            </div>
          </section>
        );
      })}

      {extendedSongs.length > 0 &&
      filteredSongs.length === 0 ? (
        <div className="card">
          <h2 className="h3">
            No matching songs
          </h2>

          <p className="copy">
            Try changing or clearing the filters.
          </p>

          <button
            type="button"
            className="button primary"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </>
  );
}
