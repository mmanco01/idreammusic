'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type PriorityTier = 'now' | 'next' | 'later' | 'someday' | 'archive';
export type WorkflowStatus =
  | 'unreviewed'
  | 'active'
  | 'waiting'
  | 'completed'
  | 'archived';

export type StudioPortfolioSong = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  audio_url: string | null;
  current_stage: string;
  muse_slug: string | null;
  version_count: number;
  final_version_count: number;
  all_versions_final: boolean;
  is_finished: boolean;
  priority_tier: PriorityTier;
  priority_rank: number | null;
  workflow_status: WorkflowStatus;
  next_action: string | null;
  target_date: string | null;
  ai_overall_score: number | null;
  ai_ready_for_release_score: number | null;
  ai_completed_at: string | null;
  open_task_count: number;
  in_progress_task_count: number;
};

type Props = {
  initialSongs: StudioPortfolioSong[];
};

type SaveState = Record<
  string,
  {
    status: 'idle' | 'saving' | 'success' | 'error';
    message: string;
  }
>;

const PRIORITY_ORDER: Record<PriorityTier, number> = {
  now: 0,
  next: 1,
  later: 2,
  someday: 3,
  archive: 4,
};

function formatLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatScore(value: number | null) {
  return value === null ? '—' : Math.round(value).toString();
}

function scoreDescription(value: number | null) {
  if (value === null) return 'Not analyzed';
  if (value >= 90) return 'Exceptional';
  if (value >= 80) return 'Strong';
  if (value >= 70) return 'Promising';
  return 'Developing';
}

function recalculateFinished(song: StudioPortfolioSong) {
  return (
    song.all_versions_final ||
    song.workflow_status === 'completed' ||
    song.workflow_status === 'archived'
  );
}

export default function StudioPortfolio({ initialSongs }: Props) {
  const [songs, setSongs] = useState(initialSongs);
  const [search, setSearch] = useState('');
  const [museFilter, setMuseFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [analysisFilter, setAnalysisFilter] = useState('all');
  const [sortMode, setSortMode] = useState('priority');
  const [showFinished, setShowFinished] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({});

  const museOptions = useMemo(
    () =>
      Array.from(
        new Set(
          songs
            .map((song) => song.muse_slug)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [songs]
  );

  const stageOptions = useMemo(
    () =>
      Array.from(new Set(songs.map((song) => song.current_stage))).sort(),
    [songs]
  );

  const summary = useMemo(() => {
    const active = songs.filter((song) => !recalculateFinished(song)).length;
    const now = songs.filter(
      (song) =>
        song.priority_tier === 'now' && !recalculateFinished(song)
    ).length;
    const openTasks = songs.reduce(
      (total, song) =>
        total + song.open_task_count + song.in_progress_task_count,
      0
    );
    const releaseCandidates = songs.filter(
      (song) =>
        (song.ai_ready_for_release_score || 0) >= 80 &&
        !recalculateFinished(song)
    ).length;
    const finished = songs.filter((song) => recalculateFinished(song)).length;

    return { active, now, openTasks, releaseCandidates, finished };
  }, [songs]);

  const visibleSongs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = songs.filter((song) => {
      const finished = recalculateFinished(song);

      if (!showFinished && finished) return false;
      if (
        normalizedSearch &&
        !song.title.toLowerCase().includes(normalizedSearch) &&
        !(song.summary || '').toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      if (museFilter !== 'all' && song.muse_slug !== museFilter) return false;
      if (stageFilter !== 'all' && song.current_stage !== stageFilter) {
        return false;
      }
      if (
        priorityFilter !== 'all' &&
        song.priority_tier !== priorityFilter
      ) {
        return false;
      }
      if (analysisFilter === 'analyzed' && song.ai_overall_score === null) {
        return false;
      }
      if (analysisFilter === 'not_analyzed' && song.ai_overall_score !== null) {
        return false;
      }
      if (
        analysisFilter === 'release_candidates' &&
        (song.ai_ready_for_release_score || 0) < 80
      ) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'ai_score') {
        return (b.ai_overall_score ?? -1) - (a.ai_overall_score ?? -1);
      }

      if (sortMode === 'release_score') {
        return (
          (b.ai_ready_for_release_score ?? -1) -
          (a.ai_ready_for_release_score ?? -1)
        );
      }

      if (sortMode === 'versions') {
        return b.version_count - a.version_count;
      }

      if (sortMode === 'title') {
        return a.title.localeCompare(b.title);
      }

      const priorityDifference =
        PRIORITY_ORDER[a.priority_tier] - PRIORITY_ORDER[b.priority_tier];

      if (priorityDifference !== 0) return priorityDifference;

      const aRank = a.priority_rank ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.priority_rank ?? Number.MAX_SAFE_INTEGER;

      if (aRank !== bRank) return aRank - bRank;

      return a.title.localeCompare(b.title);
    });
  }, [
    analysisFilter,
    museFilter,
    priorityFilter,
    search,
    showFinished,
    sortMode,
    songs,
    stageFilter,
  ]);

  function updateLocalSong(
    songId: string,
    patch: Partial<StudioPortfolioSong>
  ) {
    setSongs((current) =>
      current.map((song) => {
        if (song.id !== songId) return song;

        const updated = {
          ...song,
          ...patch,
        };

        return {
          ...updated,
          is_finished: recalculateFinished(updated),
        };
      })
    );
  }

  async function saveWorkflow(
    song: StudioPortfolioSong,
    patch: Partial<
      Pick<
        StudioPortfolioSong,
        'priority_tier' | 'priority_rank' | 'workflow_status'
      >
    >
  ) {
    const nextSong = {
      ...song,
      ...patch,
    };

    updateLocalSong(song.id, patch);
    setSaveState((current) => ({
      ...current,
      [song.id]: {
        status: 'saving',
        message: 'Saving…',
      },
    }));

    try {
      const requestBody = new FormData();
      requestBody.append('song_id', song.id);
      requestBody.append('priority_tier', nextSong.priority_tier);
      requestBody.append(
        'priority_rank',
        nextSong.priority_rank ? String(nextSong.priority_rank) : ''
      );
      requestBody.append('workflow_status', nextSong.workflow_status);

      const response = await fetch('/api/studio/song-workflow', {
        method: 'PATCH',
        body: requestBody,
      });

      const result = (await response.json().catch(() => null)) as
        | {
            status?: string;
            message?: string;
            workflow?: {
              priority_tier: PriorityTier;
              priority_rank: number | null;
              workflow_status: WorkflowStatus;
            };
          }
        | null;

      if (!response.ok || result?.status !== 'success' || !result.workflow) {
        throw new Error(
          result?.message ||
            `Workflow update failed with status ${response.status}.`
        );
      }

      updateLocalSong(song.id, result.workflow);
      setSaveState((current) => ({
        ...current,
        [song.id]: {
          status: 'success',
          message: 'Saved',
        },
      }));
    } catch (error) {
      updateLocalSong(song.id, {
        priority_tier: song.priority_tier,
        priority_rank: song.priority_rank,
        workflow_status: song.workflow_status,
      });

      setSaveState((current) => ({
        ...current,
        [song.id]: {
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Workflow save failed.',
        },
      }));
    }
  }

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {[
          ['Active Songs', summary.active],
          ['Work Now', summary.now],
          ['Active Tasks', summary.openTasks],
          ['Release Candidates', summary.releaseCandidates],
          ['Finished', summary.finished],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: '0.9rem',
              border: '1px solid var(--line)',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.025)',
            }}
          >
            <div className="eyebrow">{label}</div>
            <div
              style={{
                fontSize: '1.85rem',
                fontWeight: 800,
                marginTop: '0.2rem',
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.65rem',
          marginTop: '1rem',
          padding: '0.9rem',
          border: '1px solid var(--line)',
          borderRadius: 16,
        }}
      >
        <label className="copy">
          Search
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Song title or summary"
            style={{ marginTop: '0.35rem' }}
          />
        </label>

        <label className="copy">
          Muse
          <select
            className="input"
            value={museFilter}
            onChange={(event) => setMuseFilter(event.target.value)}
            style={{ marginTop: '0.35rem' }}
          >
            <option value="all">All Muses</option>
            {museOptions.map((muse) => (
              <option key={muse} value={muse}>
                {formatLabel(muse)}
              </option>
            ))}
          </select>
        </label>

        <label className="copy">
          Stage
          <select
            className="input"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            style={{ marginTop: '0.35rem' }}
          >
            <option value="all">All stages</option>
            {stageOptions.map((stage) => (
              <option key={stage} value={stage}>
                {formatLabel(stage)}
              </option>
            ))}
          </select>
        </label>

        <label className="copy">
          Priority
          <select
            className="input"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            style={{ marginTop: '0.35rem' }}
          >
            <option value="all">All priorities</option>
            <option value="now">Now</option>
            <option value="next">Next</option>
            <option value="later">Later</option>
            <option value="someday">Someday</option>
            <option value="archive">Archive</option>
          </select>
        </label>

        <label className="copy">
          AI status
          <select
            className="input"
            value={analysisFilter}
            onChange={(event) => setAnalysisFilter(event.target.value)}
            style={{ marginTop: '0.35rem' }}
          >
            <option value="all">All songs</option>
            <option value="analyzed">Analyzed</option>
            <option value="not_analyzed">Not analyzed</option>
            <option value="release_candidates">Release candidates</option>
          </select>
        </label>

        <label className="copy">
          Sort
          <select
            className="input"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            style={{ marginTop: '0.35rem' }}
          >
            <option value="priority">Priority</option>
            <option value="ai_score">AI score: highest</option>
            <option value="release_score">Release score: highest</option>
            <option value="versions">Most versions</option>
            <option value="title">Title</option>
          </select>
        </label>

        <label
          className="copy"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            alignSelf: 'end',
            minHeight: 46,
          }}
        >
          <input
            type="checkbox"
            checked={showFinished}
            onChange={(event) => setShowFinished(event.target.checked)}
          />
          Show finished songs
        </label>
      </div>

      <div
        className="copy"
        style={{
          marginTop: '0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span>
          Showing <strong>{visibleSongs.length}</strong> of{' '}
          <strong>{songs.length}</strong> songs
        </span>
        {!showFinished && summary.finished > 0 ? (
          <span>{summary.finished} finished song(s) hidden</span>
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.85rem',
          marginTop: '1rem',
        }}
      >
        {visibleSongs.map((song) => {
          const state = saveState[song.id];

          return (
            <article
              key={song.id}
              className="subsection"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.8fr) minmax(250px, 1fr)',
                gap: '1rem',
                alignItems: 'start',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  className="pillRow"
                  style={{ marginBottom: '0.75rem' }}
                >
                  <span className="pill">{formatLabel(song.current_stage)}</span>
                  {song.muse_slug ? (
                    <span className="pill">{formatLabel(song.muse_slug)}</span>
                  ) : null}
                  <span className="pill">
                    {song.version_count}{' '}
                    {song.version_count === 1 ? 'version' : 'versions'}
                  </span>
                  <span className="pill">
                    Priority {formatLabel(song.priority_tier)}
                    {song.priority_rank ? ` #${song.priority_rank}` : ''}
                  </span>
                  <span className="pill">
                    AI {formatScore(song.ai_overall_score)}
                  </span>
                  {song.open_task_count + song.in_progress_task_count > 0 ? (
                    <span className="pill">
                      {song.open_task_count + song.in_progress_task_count}{' '}
                      active task(s)
                    </span>
                  ) : null}
                  {song.is_finished ? (
                    <span className="pill">Finished</span>
                  ) : null}
                </div>

                <h3 className="h3" style={{ marginBottom: '0.4rem' }}>
                  <Link href={`/songs/${song.slug}`}>{song.title}</Link>
                </h3>

                {song.summary ? <p className="copy">{song.summary}</p> : null}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(135px, 1fr))',
                    gap: '0.55rem',
                    marginTop: '0.8rem',
                  }}
                >
                  <div>
                    <div className="eyebrow">Versions</div>
                    <div className="copy">
                      {song.final_version_count} final of {song.version_count}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">AI overall</div>
                    <div className="copy">
                      <strong>{formatScore(song.ai_overall_score)}</strong>{' '}
                      {scoreDescription(song.ai_overall_score)}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">Release readiness</div>
                    <div className="copy">
                      <strong>
                        {formatScore(song.ai_ready_for_release_score)}
                      </strong>
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">Tasks</div>
                    <div className="copy">
                      {song.open_task_count} open ·{' '}
                      {song.in_progress_task_count} in progress
                    </div>
                  </div>
                </div>

                {song.audio_url ? (
                  <audio
                    controls
                    preload="none"
                    className="audioPlayer"
                    style={{ marginTop: '0.85rem' }}
                  >
                    <source src={song.audio_url} />
                  </audio>
                ) : null}

                <div
                  className="button-row"
                  style={{ marginTop: '0.9rem' }}
                >
                  <Link
                    className="button primary"
                    href={`/studio/songs/${song.slug}/edit`}
                  >
                    Work this song
                  </Link>
                  <Link className="button" href={`/songs/${song.slug}`}>
                    View song
                  </Link>
                </div>
              </div>

              <div
                style={{
                  padding: '0.9rem',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.025)',
                }}
              >
                <div className="eyebrow">Portfolio controls</div>

                <label
                  className="copy"
                  style={{ display: 'block', marginTop: '0.7rem' }}
                >
                  Priority
                  <select
                    className="input"
                    value={song.priority_tier}
                    onChange={(event) =>
                      void saveWorkflow(song, {
                        priority_tier: event.target.value as PriorityTier,
                      })
                    }
                    style={{ marginTop: '0.3rem' }}
                  >
                    <option value="now">Now</option>
                    <option value="next">Next</option>
                    <option value="later">Later</option>
                    <option value="someday">Someday</option>
                    <option value="archive">Archive</option>
                  </select>
                </label>

                <label
                  className="copy"
                  style={{ display: 'block', marginTop: '0.65rem' }}
                >
                  Rank within priority
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={song.priority_rank ?? ''}
                    placeholder="Optional"
                    onChange={(event) =>
                      updateLocalSong(song.id, {
                        priority_rank: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    onBlur={(event) =>
                      void saveWorkflow(song, {
                        priority_rank: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    style={{ marginTop: '0.3rem' }}
                  />
                </label>

                <label
                  className="copy"
                  style={{ display: 'block', marginTop: '0.65rem' }}
                >
                  Workflow status
                  <select
                    className="input"
                    value={song.workflow_status}
                    onChange={(event) =>
                      void saveWorkflow(song, {
                        workflow_status: event.target
                          .value as WorkflowStatus,
                      })
                    }
                    style={{ marginTop: '0.3rem' }}
                  >
                    <option value="unreviewed">Unreviewed</option>
                    <option value="active">Active</option>
                    <option value="waiting">Waiting</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>

                {song.all_versions_final ? (
                  <div
                    className="copy"
                    style={{
                      marginTop: '0.7rem',
                      padding: '0.65rem',
                      borderRadius: 12,
                      border: '1px solid var(--line)',
                    }}
                  >
                    All current versions are marked Final.
                  </div>
                ) : null}

                {state?.message ? (
                  <div
                    role="status"
                    className="copy"
                    style={{
                      marginTop: '0.65rem',
                      fontWeight: 700,
                      color:
                        state.status === 'error'
                          ? '#ffb4b4'
                          : state.status === 'saving'
                            ? '#f7dda0'
                            : '#d9f7d6',
                    }}
                  >
                    {state.message}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {visibleSongs.length === 0 ? (
        <div
          className="copy"
          style={{
            marginTop: '1rem',
            padding: '1rem',
            border: '1px dashed var(--line)',
            borderRadius: 16,
          }}
        >
          No songs match the current filters.
        </div>
      ) : null}
    </div>
  );
}
