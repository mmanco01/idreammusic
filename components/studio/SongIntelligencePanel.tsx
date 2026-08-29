'use client';

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnalysisLoadingState, AnimatedDots } from '@/components/ui/AnalysisLoadingState';
import { RecommendedNextAction } from '@/components/ui/RecommendedNextAction';
import {
  saveSongTranscript,
  type TranscriptSaveState,
} from '@/app/studio/songs/[slug]/edit/actions';

type AudioAttachment = {
  id: string;
  title: string | null;
  storage_path: string;
  bucket: string;
  mime_type: string | null;
  song_version_id: string | null;
  created_at: string;
};
 
type Transcript = {
  id: string;
  attachment_id: string | null;
  song_version_id: string | null;
  transcript_text: string;
  is_reviewed: boolean;
  updated_at: string;
};

type MuseName =
  | 'Calliope'
  | 'Clio'
  | 'Erato'
  | 'Euterpe'
  | 'Melpomene'
  | 'Polyhymnia'
  | 'Terpsichore'
  | 'Thalia'
  | 'Urania';

type ScoreDetail = {
  score: number;
  rationale: string;
  confidence: number;
};

type SongIntelligenceResult = {
  analysis_basis:
    | 'lyrics_and_transcript'
    | 'lyrics_only'
    | 'transcript_only'
    | 'captured_text'
    | 'mixed_material';
  analysis_stage?: 'spark' | 'draft' | 'final';
  source_types?: string[];
  material_completeness?: 'limited' | 'developing' | 'substantial';
  recommended_next_move?: string;
  lead_muse?: MuseName;
  lead_muse_reason?: string;
  starter_question?: string;
  limitations: string[];
  overall_score: number;
  ready_for_release_score: number;
  summary: string;
  suggested_phase: string;
  audience_tier: 'A' | 'B' | 'C' | 'D';
  rights_caution: {
    flag: boolean;
    note: string;
  };
  strengths: string[];
  work_needed: Array<{
    area: string;
    issue: string;
    recommended_action: string;
    priority: number;
  }>;
  scores: Record<string, ScoreDetail>;
  muse_analysis: {
    primary: {
      name: MuseName;
      confidence: number;
      rationale: string;
      supporting_lines: string[];
      guidance: string;
    };
    secondary: {
      name: MuseName;
      confidence: number;
      rationale: string;
      supporting_lines: string[];
      guidance: string;
    };
    competing_muses: Array<{
      name: MuseName;
      confidence: number;
      rationale: string;
    }>;
  };
  story: {
    core_theme: string;
    emotional_arc: string;
    narrative_clarity: string;
    point_of_view: string;
    strongest_story_moment: string;
    missing_story_element: string;
  };
  hook: {
    hook_text: string;
    strength: string;
    memorability: string;
    commercial_potential: string;
    improvement: string;
  };
  lyrics: {
    strongest_lines: string[];
    weakest_lines: string[];
    cliches_detected: string[];
    rhymes_needing_work: string[];
    repeated_phrases: string[];
    rhyme_density: string;
    internal_rhyme_notes: string;
    alliteration_notes: string;
    metaphor_notes: string;
    reading_grade_level: number;
    singability_notes: string;
  };
  musical_suggestions: {
    tempo_feel: string;
    suggested_bpm_min: number;
    suggested_bpm_max: number;
    genre_fit: string[];
    vocal_range_guidance: string;
    instrumentation_ideas: string[];
    arrangement_arc: string;
    production_notes: string;
  };
  audience: {
    likely_listeners: string[];
    radio_potential: string;
    streaming_playlist_fit: string[];
    sync_opportunities: string[];
    audience_rank_score: number;
  };
  similar_artists: Array<{
    artist: string;
    similarity: number;
    reason: string;
  }>;
  rewrite_opportunities: Array<{
    section: string;
    issue: string;
    direction: string;
    example_strategy: string;
  }>;
  muse_guidance: Array<{
    muse: MuseName;
    message: string;
    priority: number;
  }>;
  metrics: {
    estimated_song_length_seconds: number;
    chorus_repetition_analysis: string;
    word_count: number;
    unique_word_ratio: number;
    rhyme_density_score: number;
    internal_rhyme_score: number;
    alliteration_score: number;
    metaphor_score: number;
    singability_score: number;
    ai_confidence: number;
    muse_confidence: number;
  };
  emotional_curve: Array<{
    section: string;
    score: number;
    description: string;
  }>;
};

type AudienceMetrics = {
  totalListens: number;
  uniqueListeners: number;
  recentListens: number;
  lastListenedAt: string | null;
};

type Props = {
  songId: string;
  slug: string;
  audioAttachments: AudioAttachment[];
  transcripts: Transcript[];
  audienceMetrics: AudienceMetrics;
  hasCapturedText: boolean;
  analysisStage: 'spark' | 'draft' | 'final';
};

const initialSaveState: TranscriptSaveState = {
  status: 'idle',
  message: '',
};

type GenerateState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
};

type AnalyticsState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  result: SongIntelligenceResult | null;
  runId: string | null;
};

type TaskCreateState = Record<
  string,
  {
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }
>;

type SongTaskStatus = 'open' | 'in_progress' | 'completed' | 'dismissed';

type SongTask = {
  id: string;
  song_id: string;
  song_version_id: string | null;
  analysis_run_id: string | null;
  title: string;
  description: string | null;
  status: SongTaskStatus;
  priority: number;
  sort_order: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  analysis: {
    model_name: string | null;
    analysis_version: string | null;
    completed_at: string | null;
  } | null;
};

type TaskListState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  updatingTaskId: string | null;
};

function SaveTranscriptButton({
  runIntelligence = false,
  disabled = false,
}: {
  runIntelligence?: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      name="next_action"
      value={runIntelligence ? 'run_intelligence' : 'save'}
      className={runIntelligence ? 'button primary' : 'button'}
      disabled={isDisabled}
      aria-busy={pending}
      title={
        runIntelligence && disabled
          ? 'Review the transcript against the recording first.'
          : undefined
      }
      style={{
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.58 : 1,
      }}
    >
      {pending ? (
        <>
          {runIntelligence ? 'Saving transcript and preparing analysis' : 'Saving transcript'}
          <AnimatedDots label="Saving transcript" />
        </>
      ) : runIntelligence ? (
        'Save Transcript and Run Song Intelligence'
      ) : (
        'Save transcript'
      )}
    </button>
  );
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function scoreLabel(value: number) {
  return `${Math.round(value)} / 100`;
}

function IntelligenceScore({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div
      style={{
        padding: '1rem',
        border: '1px solid var(--line)',
        borderRadius: 16,
        minWidth: 0,
      }}
    >
      <div className="eyebrow">{label}</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 750, marginTop: '0.25rem' }}>
        {scoreLabel(value)}
      </div>
      {detail ? (
        <div className="copy" style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function TextList({ items }: { items: string[] }) {
  if (!items.length) {
    return <p className="copy">None identified.</p>;
  }

  return (
    <ul className="copy" style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`} style={{ marginBottom: '0.35rem' }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function CreateTaskButton({
  taskKey,
  label,
  taskState,
  onCreate,
}: {
  taskKey: string;
  label?: string;
  taskState: TaskCreateState;
  onCreate: () => void;
}) {
  const state = taskState[taskKey];
  const isLoading = state?.status === 'loading';
  const isSuccess = state?.status === 'success';

  return (
    <div style={{ marginTop: '0.7rem' }}>
      <button
        type="button"
        className={`button secondary${isSuccess ? ' task-created' : ''}`}
        onClick={onCreate}
        disabled={isLoading || isSuccess}
        aria-busy={isLoading}
        style={{
          fontSize: '0.9rem',
          padding: '0.65rem 0.9rem',
        }}
      >
        {isLoading ? (
          <>
            Creating task
            <AnimatedDots label="Creating task" />
          </>
        ) : isSuccess ? (
          '✓ Task Created'
        ) : (
          label || '+ Create Song Task'
        )}
      </button>

      {state?.message ? (
        <div
          className="copy"
          role="status"
          style={{
            marginTop: '0.4rem',
            fontSize: '0.86rem',
            fontWeight: 650,
            color: state.status === 'error' ? '#ffb4b4' : '#d9f7d6',
          }}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}

function formatTaskDate(value: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatAudienceDate(value: string | null) {
  if (!value) return 'No listens yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function AudienceIntelligencePanel({
  metrics,
  intelligence,
}: {
  metrics: AudienceMetrics;
  intelligence: SongIntelligenceResult | null;
}) {
  const audience = intelligence?.audience ?? null;
  const repeatListens = Math.max(
    0,
    metrics.totalListens - metrics.uniqueListeners
  );

  return (
    <section
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        border: '1px solid var(--line)',
        borderRadius: 18,
        background:
          'linear-gradient(145deg, rgba(255,217,120,0.08), rgba(255,255,255,0.025))',
      }}
    >
      <div className="eyebrow">Audience intelligence</div>
      <h3 className="h2" style={{ marginTop: '0.25rem' }}>
        Listener Response &amp; Audience Fit
      </h3>
      <p className="copy" style={{ maxWidth: 850 }}>
        Combine real listener engagement with Song Intelligence to understand
        which songs are attracting attention and where they may fit in the
        marketplace.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.75rem',
          marginTop: '1rem',
        }}
      >
        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Total listens</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>
            {metrics.totalListens.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Unique listeners</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>
            {metrics.uniqueListeners.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Last 7 days</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>
            {metrics.recentListens.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Audience score</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>
            {audience
              ? `${Math.round(audience.audience_rank_score)} / 100`
              : 'Pending'}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.75rem',
          marginTop: '0.75rem',
        }}
      >
        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Listener activity</div>
          <p className="copy">
            <strong>Last listened:</strong>{' '}
            {formatAudienceDate(metrics.lastListenedAt)}
          </p>
          <p className="copy">
            <strong>Repeat-listen activity:</strong>{' '}
            {repeatListens > 0
              ? `${repeatListens.toLocaleString()} additional listens beyond first-time sessions`
              : 'No repeat-listen activity identified yet'}
          </p>
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Best-fit audiences</div>
          {audience ? (
            <TextList items={audience.likely_listeners} />
          ) : (
            <p className="copy">
              Run AI Song Intelligence to identify likely listeners.
            </p>
          )}
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Playlist opportunities</div>
          {audience ? (
            <TextList items={audience.streaming_playlist_fit} />
          ) : (
            <p className="copy">
              Playlist recommendations will appear after analysis.
            </p>
          )}
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Sync opportunities</div>
          {audience ? (
            <TextList items={audience.sync_opportunities} />
          ) : (
            <p className="copy">
              Sync opportunities will appear after analysis.
            </p>
          )}
        </div>
      </div>

      {intelligence ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Commercial perspective</div>
          <p className="copy">
            <strong>Radio potential:</strong>{' '}
            {intelligence.audience.radio_potential}
          </p>
          <p className="copy">
            <strong>Hook potential:</strong>{' '}
            {intelligence.hook.commercial_potential}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function TaskActionButton({
  children,
  onClick,
  disabled,
  emphasis = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      className="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.68 : 1,
        padding: '0.5rem 0.7rem',
        fontSize: '0.82rem',
        fontWeight: 800,
        color: emphasis ? '#17120a' : '#f5f1e8',
        background: emphasis
          ? 'linear-gradient(135deg, #ffe49a 0%, #dca52f 100%)'
          : 'rgba(255,255,255,0.11)',
        border: emphasis
          ? '1px solid #ffe7a7'
          : '1px solid rgba(255,255,255,0.28)',
        boxShadow: emphasis
          ? '0 6px 16px rgba(220, 165, 47, 0.2)'
          : 'none',
      }}
    >
      {children}
    </button>
  );
}

function SongTasksManager({
  tasks,
  state,
  onRefresh,
  onUpdateStatus,
}: {
  tasks: SongTask[];
  state: TaskListState;
  onRefresh: () => void;
  onUpdateStatus: (taskId: string, status: SongTaskStatus) => void;
}) {
  const groups: Array<{
    status: SongTaskStatus;
    label: string;
    description: string;
  }> = [
    { status: 'open', label: 'Open', description: 'Ready to work' },
    { status: 'in_progress', label: 'In Progress', description: 'Actively developing' },
    { status: 'completed', label: 'Completed', description: 'Finished work' },
    { status: 'dismissed', label: 'Dismissed', description: 'Not pursuing' },
  ];

  return (
    <section
      style={{
        marginTop: '1.5rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="eyebrow">Song development workflow</div>
          <h3 className="h2" style={{ marginTop: '0.25rem' }}>
            Song Tasks
          </h3>
          <p className="copy" style={{ maxWidth: 760 }}>
            Turn AI recommendations into work, move each item through development,
            then run Song Intelligence again to measure the next version.
          </p>
        </div>

        <button
          type="button"
          className="button secondary"
          onClick={onRefresh}
          disabled={state.status === 'loading'}
          aria-busy={state.status === 'loading'}
        >
          {state.status === 'loading' ? (
            <>
              Loading tasks
              <AnimatedDots label="Loading tasks" />
            </>
          ) : (
            'Refresh Tasks'
          )}
        </button>
      </div>

      {state.message ? (
        <div
          role="status"
          className="copy"
          style={{
            marginTop: '0.75rem',
            color: state.status === 'error' ? '#ffb4b4' : '#d9f7d6',
            fontWeight: 650,
          }}
        >
          {state.message}
        </div>
      ) : null}

      {tasks.length === 0 && state.status !== 'loading' ? (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            border: '1px dashed var(--line)',
            borderRadius: 16,
          }}
        >
          <strong>No song tasks yet.</strong>
          <p className="copy" style={{ marginBottom: 0 }}>
            Use a gold “Create Song Task” button in Work Needed or Rewrite
            Opportunities to start the development list.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.85rem',
            marginTop: '1rem',
          }}
        >
          {groups.map((group) => {
            const groupTasks = tasks.filter((task) => task.status === group.status);

            return (
              <div
                key={group.status}
                style={{
                  padding: '0.9rem',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  minWidth: 0,
                  background: 'rgba(255,255,255,0.025)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <strong>{group.label}</strong>
                    <div className="copy" style={{ fontSize: '0.84rem' }}>
                      {group.description}
                    </div>
                  </div>
                  <span className="pill">{groupTasks.length}</span>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.8rem' }}>
                  {groupTasks.length === 0 ? (
                    <div className="copy" style={{ opacity: 0.7 }}>
                      Nothing here.
                    </div>
                  ) : (
                    groupTasks.map((task) => {
                      const updating = state.updatingTaskId === task.id;

                      return (
                        <article
                          key={task.id}
                          style={{
                            padding: '0.85rem',
                            border: '1px solid var(--line)',
                            borderRadius: 14,
                            background: 'rgba(0,0,0,0.12)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: '0.75rem',
                            }}
                          >
                            <strong style={{ lineHeight: 1.3 }}>{task.title}</strong>
                            <span
                              className="pill"
                              title="Priority 1 is highest"
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              P{task.priority}
                            </span>
                          </div>

                          <div
                            className="copy"
                            style={{
                              marginTop: '0.45rem',
                              fontSize: '0.82rem',
                              opacity: 0.8,
                            }}
                          >
                            {task.analysis_run_id
                              ? `Linked to AI analysis${
                                  task.analysis?.analysis_version
                                    ? ` v${task.analysis.analysis_version}`
                                    : ''
                                }`
                              : 'Manual song task'}
                            {task.created_at
                              ? ` · Created ${formatTaskDate(task.created_at)}`
                              : ''}
                          </div>

                          {task.description ? (
                            <div
                              className="copy"
                              style={{
                                marginTop: '0.55rem',
                                whiteSpace: 'pre-wrap',
                                fontSize: '0.9rem',
                              }}
                            >
                              {task.description}
                            </div>
                          ) : null}

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.45rem',
                              marginTop: '0.75rem',
                            }}
                          >
                            {task.status === 'open' ? (
                              <>
                                <TaskActionButton
                                  disabled={updating}
                                  emphasis
                                  onClick={() =>
                                    onUpdateStatus(task.id, 'in_progress')
                                  }
                                >
                                  Start
                                </TaskActionButton>
                                <TaskActionButton
                                  disabled={updating}
                                  onClick={() =>
                                    onUpdateStatus(task.id, 'completed')
                                  }
                                >
                                  Complete
                                </TaskActionButton>
                                <TaskActionButton
                                  disabled={updating}
                                  onClick={() =>
                                    onUpdateStatus(task.id, 'dismissed')
                                  }
                                >
                                  Dismiss
                                </TaskActionButton>
                              </>
                            ) : null}

                            {task.status === 'in_progress' ? (
                              <>
                                <TaskActionButton
                                  disabled={updating}
                                  emphasis
                                  onClick={() =>
                                    onUpdateStatus(task.id, 'completed')
                                  }
                                >
                                  Complete
                                </TaskActionButton>
                                <TaskActionButton
                                  disabled={updating}
                                  onClick={() => onUpdateStatus(task.id, 'open')}
                                >
                                  Move to Open
                                </TaskActionButton>
                                <TaskActionButton
                                  disabled={updating}
                                  onClick={() =>
                                    onUpdateStatus(task.id, 'dismissed')
                                  }
                                >
                                  Dismiss
                                </TaskActionButton>
                              </>
                            ) : null}

                            {task.status === 'completed' ||
                            task.status === 'dismissed' ? (
                              <TaskActionButton
                                disabled={updating}
                                emphasis
                                onClick={() => onUpdateStatus(task.id, 'open')}
                              >
                                Reopen
                              </TaskActionButton>
                            ) : null}
                          </div>

                          {updating ? (
                            <div
                              className="copy"
                              style={{
                                marginTop: '0.45rem',
                                fontSize: '0.84rem',
                                color: '#f7dda0',
                              }}
                            >
                              Updating task…
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function IntelligenceDisclosure({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details
      style={{
        border: '1px solid var(--line)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          padding: '1rem',
          fontWeight: 800,
          listStylePosition: 'inside',
        }}
      >
        {title}
        <span
          className="copy"
          style={{
            display: 'block',
            marginTop: '0.3rem',
            marginLeft: '1.25rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            opacity: 0.82,
          }}
        >
          {description}
        </span>
      </summary>
      <div
        style={{
          padding: '0 1rem 1rem',
          borderTop: '1px solid var(--line)',
        }}
      >
        {children}
      </div>
    </details>
  );
}

function IntelligenceResults({
  result,
  slug,
  taskState,
  onCreateTask,
}: {
  result: SongIntelligenceResult;
  slug: string;
  taskState: TaskCreateState;
  onCreateTask: (
    taskKey: string,
    title: string,
    description: string,
    priority: number
  ) => void;
}) {
  const leadMuse = result.lead_muse || result.muse_analysis.primary.name;
  const leadMuseSlug = leadMuse.toLowerCase();
  const leadMuseReason =
    result.lead_muse_reason || result.muse_analysis.primary.rationale;
  const starterQuestion = String(
    result.starter_question ||
      `Based on this song and its Song Intelligence, what is the most promising direction, and what should I develop next?`
  )
    .trim()
    .slice(0, 900);
  const recommendedNextMove =
    result.recommended_next_move ||
    result.work_needed[0]?.recommended_action ||
    'Choose one promising direction and add the next piece of the song.';
  const isSparkAssessment = result.analysis_stage === 'spark';

  return (
    <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
      <div>
        <div className="eyebrow">AI Song Intelligence</div>
        <h3 className="h2" style={{ marginTop: '0.25rem' }}>
          At a Glance
        </h3>
        <p className="copy" style={{ maxWidth: 900 }}>
          {result.summary}
        </p>
        {isSparkAssessment ? (
          <p className="copy" style={{ maxWidth: 900, fontWeight: 700 }}>
            Spark-stage assessment: these ratings reflect the promise visible in
            the material currently captured. They will evolve as you add lyrics,
            structure, melody, recordings, and creative decisions.
          </p>
        ) : null}
      </div>

      {!isSparkAssessment ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <IntelligenceScore label="Overall song strength" value={result.overall_score} />
          <IntelligenceScore
            label="Ready for release"
            value={result.ready_for_release_score}
            detail={`Suggested phase: ${result.suggested_phase.replaceAll('_', ' ')}`}
          />
          <IntelligenceScore
            label="Audience rank"
            value={result.audience.audience_rank_score}
            detail={`Audience tier ${result.audience_tier}`}
          />
          <IntelligenceScore
            label="Singability"
            value={result.metrics.singability_score}
            detail={`AI confidence ${percent(result.metrics.ai_confidence)}`}
          />
        </div>
      ) : null}

      <RecommendedNextAction
        eyebrow="Recommended creative partner"
        title={`Explore this with ${leadMuse}`}
        description={
          <>
            <p>{leadMuseReason}</p>
            <p style={{ marginTop: '0.55rem' }}>
              <strong>Recommended next move:</strong> {recommendedNextMove}
            </p>
          </>
        }
      >
        <Link
          className="button primary"
          href={`/studio/songs/${slug}/edit?muse=${encodeURIComponent(leadMuseSlug)}&question=${encodeURIComponent(starterQuestion)}#muses`}
        >
          Explore this with {leadMuse}
        </Link>
      </RecommendedNextAction>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">What is already working</div>
          <TextList items={result.strengths} />
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Best next moves</div>
          {result.work_needed.length ? (
            <div style={{ display: 'grid', gap: '0.9rem', marginTop: '0.6rem' }}>
              {result.work_needed.map((item, index) => (
                <div key={`${item.area}-${index}`}>
                  <strong>
                    {item.area} · Priority {item.priority}
                  </strong>
                  <div className="copy">{item.issue}</div>
                  <div className="copy">
                    <em>Next move:</em> {item.recommended_action}
                  </div>
                  <CreateTaskButton
                    taskKey={`work-needed-${index}`}
                    taskState={taskState}
                    onCreate={() =>
                      onCreateTask(
                        `work-needed-${index}`,
                        `${item.area}: ${item.issue}`,
                        `AI Song Intelligence recommendation:\n\n${item.issue}\n\nRecommended action:\n${item.recommended_action}`,
                        item.priority
                      )
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="copy">No major work items identified.</p>
          )}
        </div>
      </div>

      {isSparkAssessment ? (
        <div
          style={{
            display: 'grid',
            gap: '0.6rem',
          }}
        >
          <div>
            <div className="eyebrow">Provisional scores</div>
            <p className="copy" style={{ margin: '0.25rem 0 0', maxWidth: 860 }}>
              These are early signals, not a verdict. Use them after the creative
              direction and next moves above.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <IntelligenceScore label="Overall song strength" value={result.overall_score} />
            <IntelligenceScore
              label="Ready for release"
              value={result.ready_for_release_score}
              detail={`Suggested phase: ${result.suggested_phase.replaceAll('_', ' ')}`}
            />
            <IntelligenceScore
              label="Audience rank"
              value={result.audience.audience_rank_score}
              detail={`Audience tier ${result.audience_tier}`}
            />
            <IntelligenceScore
              label="Singability"
              value={result.metrics.singability_score}
              detail={`AI confidence ${percent(result.metrics.ai_confidence)}`}
            />
          </div>
        </div>
      ) : null}

      {result.rights_caution.flag ? (
        <div
          role="note"
          style={{
            padding: '1rem',
            border: '1px solid #e8b45f',
            borderRadius: 16,
          }}
        >
          <strong>Rights review recommended</strong>
          <div className="copy">{result.rights_caution.note}</div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <IntelligenceDisclosure
          title="Muse Direction"
          description={`${result.muse_analysis.primary.name} leads, supported by ${result.muse_analysis.secondary.name}.`}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.75rem',
              marginTop: '1rem',
            }}
          >
            <div>
              <div className="eyebrow">Primary Muse</div>
              <h3 style={{ margin: '0.3rem 0' }}>
                {result.muse_analysis.primary.name}{' '}
                <span style={{ fontWeight: 500 }}>
                  ({percent(result.muse_analysis.primary.confidence)})
                </span>
              </h3>
              <p className="copy">{result.muse_analysis.primary.rationale}</p>
              <p className="copy">
                <strong>{result.muse_analysis.primary.name} says:</strong>{' '}
                {result.muse_analysis.primary.guidance}
              </p>
              <TextList items={result.muse_analysis.primary.supporting_lines} />
            </div>

            <div>
              <div className="eyebrow">Secondary Muse</div>
              <h3 style={{ margin: '0.3rem 0' }}>
                {result.muse_analysis.secondary.name}{' '}
                <span style={{ fontWeight: 500 }}>
                  ({percent(result.muse_analysis.secondary.confidence)})
                </span>
              </h3>
              <p className="copy">{result.muse_analysis.secondary.rationale}</p>
              <p className="copy">
                <strong>{result.muse_analysis.secondary.name} says:</strong>{' '}
                {result.muse_analysis.secondary.guidance}
              </p>
              <TextList items={result.muse_analysis.secondary.supporting_lines} />
            </div>
          </div>

          {result.muse_analysis.competing_muses.length ? (
            <div style={{ marginTop: '1rem' }}>
              <div className="eyebrow">Other active Muses</div>
              {result.muse_analysis.competing_muses.map((item, index) => (
                <p className="copy" key={`${item.name}-${index}`}>
                  <strong>{item.name} ({percent(item.confidence)}):</strong>{' '}
                  {item.rationale}
                </p>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: '1rem' }}>
            <div className="eyebrow">Muse Guidance</div>
            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.6rem' }}>
              {result.muse_guidance.map((item, index) => (
                <div key={`${item.muse}-${index}`}>
                  <strong>
                    {item.muse} · Priority {item.priority}
                  </strong>
                  <div className="copy">{item.message}</div>
                </div>
              ))}
            </div>
          </div>
        </IntelligenceDisclosure>

        <IntelligenceDisclosure
          title="Story & Hook"
          description="Theme, emotional movement, narrative clarity, and the central memorable idea."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <div>
              <div className="eyebrow">Story</div>
              <p className="copy"><strong>Core theme:</strong> {result.story.core_theme}</p>
              <p className="copy"><strong>Emotional arc:</strong> {result.story.emotional_arc}</p>
              <p className="copy"><strong>Narrative clarity:</strong> {result.story.narrative_clarity}</p>
              <p className="copy"><strong>Point of view:</strong> {result.story.point_of_view}</p>
              <p className="copy"><strong>Strongest moment:</strong> {result.story.strongest_story_moment}</p>
              <p className="copy"><strong>Missing element:</strong> {result.story.missing_story_element}</p>
            </div>
            <div>
              <div className="eyebrow">Hook</div>
              <p className="copy"><strong>Hook:</strong> {result.hook.hook_text || 'Not clearly isolated'}</p>
              <p className="copy"><strong>Strength:</strong> {result.hook.strength}</p>
              <p className="copy"><strong>Memorability:</strong> {result.hook.memorability}</p>
              <p className="copy"><strong>Commercial potential:</strong> {result.hook.commercial_potential}</p>
              <p className="copy"><strong>Improvement:</strong> {result.hook.improvement}</p>
            </div>
          </div>
        </IntelligenceDisclosure>

        <IntelligenceDisclosure
          title="Lyrics & Craft"
          description="Strong and weak lines, rhyme, language, metaphor, repetition, and singability."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <div>
              <div className="eyebrow">Strongest lines</div>
              <TextList items={result.lyrics.strongest_lines} />
            </div>
            <div>
              <div className="eyebrow">Lines needing work</div>
              <TextList items={result.lyrics.weakest_lines} />
            </div>
            <div>
              <div className="eyebrow">Clichés detected</div>
              <TextList items={result.lyrics.cliches_detected} />
            </div>
            <div>
              <div className="eyebrow">Rhymes needing work</div>
              <TextList items={result.lyrics.rhymes_needing_work} />
            </div>
            <div>
              <div className="eyebrow">Repeated phrases</div>
              <TextList items={result.lyrics.repeated_phrases} />
            </div>
            <div>
              <div className="eyebrow">Craft readout</div>
              <p className="copy"><strong>Rhyme density:</strong> {result.lyrics.rhyme_density}</p>
              <p className="copy"><strong>Internal rhyme:</strong> {result.lyrics.internal_rhyme_notes}</p>
              <p className="copy"><strong>Alliteration:</strong> {result.lyrics.alliteration_notes}</p>
              <p className="copy"><strong>Metaphor:</strong> {result.lyrics.metaphor_notes}</p>
              <p className="copy"><strong>Reading grade:</strong> {result.lyrics.reading_grade_level.toFixed(1)}</p>
              <p className="copy"><strong>Singability:</strong> {result.lyrics.singability_notes}</p>
            </div>
          </div>
        </IntelligenceDisclosure>

        <IntelligenceDisclosure
          title="Musical Direction"
          description="Tempo, genre, vocal range, instrumentation, arrangement, and production ideas."
        >
          <div style={{ marginTop: '1rem' }}>
            <p className="copy"><strong>Tempo feel:</strong> {result.musical_suggestions.tempo_feel}</p>
            <p className="copy"><strong>Suggested BPM:</strong> {result.musical_suggestions.suggested_bpm_min}–{result.musical_suggestions.suggested_bpm_max}</p>
            <p className="copy"><strong>Genre fit:</strong> {result.musical_suggestions.genre_fit.join(', ')}</p>
            <p className="copy"><strong>Vocal guidance:</strong> {result.musical_suggestions.vocal_range_guidance}</p>
            <div className="eyebrow" style={{ marginTop: '1rem' }}>Instrumentation ideas</div>
            <TextList items={result.musical_suggestions.instrumentation_ideas} />
            <p className="copy"><strong>Arrangement arc:</strong> {result.musical_suggestions.arrangement_arc}</p>
            <p className="copy"><strong>Production:</strong> {result.musical_suggestions.production_notes}</p>
          </div>
        </IntelligenceDisclosure>

        <IntelligenceDisclosure
          title="Audience & Style"
          description="Likely listeners, playlist and sync fit, radio potential, and comparable artists."
        >
          <div style={{ marginTop: '1rem' }}>
            <p className="copy"><strong>Likely listeners:</strong> {result.audience.likely_listeners.join(', ')}</p>
            <p className="copy"><strong>Radio potential:</strong> {result.audience.radio_potential}</p>
            <p className="copy"><strong>Playlist fit:</strong> {result.audience.streaming_playlist_fit.join(', ')}</p>
            <p className="copy"><strong>Sync opportunities:</strong> {result.audience.sync_opportunities.join(', ')}</p>
            <div style={{ marginTop: '0.8rem' }}>
              <strong>Stylistic comparisons</strong>
              {result.similar_artists.map((item, index) => (
                <div className="copy" key={`${item.artist}-${index}`}>
                  {item.artist} ({Math.round(item.similarity)}%): {item.reason}
                </div>
              ))}
            </div>
          </div>
        </IntelligenceDisclosure>

        <IntelligenceDisclosure
          title="Rewrite Opportunities"
          description={`${result.rewrite_opportunities.length} focused rewrite direction${result.rewrite_opportunities.length === 1 ? '' : 's'} identified.`}
        >
          {result.rewrite_opportunities.length ? (
            <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
              {result.rewrite_opportunities.map((item, index) => (
                <div key={`${item.section}-${index}`}>
                  <strong>{item.section}</strong>
                  <div className="copy">{item.issue}</div>
                  <div className="copy"><em>Direction:</em> {item.direction}</div>
                  <div className="copy"><em>Strategy:</em> {item.example_strategy}</div>
                  <CreateTaskButton
                    taskKey={`rewrite-${index}`}
                    taskState={taskState}
                    onCreate={() =>
                      onCreateTask(
                        `rewrite-${index}`,
                        `Rewrite ${item.section}`,
                        `AI Song Intelligence rewrite opportunity:\n\nIssue:\n${item.issue}\n\nDirection:\n${item.direction}\n\nSuggested strategy:\n${item.example_strategy}`,
                        2
                      )
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="copy" style={{ marginTop: '1rem' }}>No focused rewrites identified.</p>
          )}
        </IntelligenceDisclosure>

        <IntelligenceDisclosure
          title="Emotional Curve & Analysis Details"
          description="Section-by-section emotion, scoring detail, confidence, source basis, and analysis limits."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.65rem',
              marginTop: '1rem',
            }}
          >
            {result.emotional_curve.map((point, index) => (
              <div
                key={`${point.section}-${index}`}
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                }}
              >
                <strong>{point.section}</strong>
                <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                  {Math.round(point.score)}
                </div>
                <div className="copy" style={{ fontSize: '0.88rem' }}>
                  {point.description}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div className="eyebrow">Detailed scores</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.75rem',
                marginTop: '0.75rem',
              }}
            >
              {Object.entries(result.scores).map(([key, detail]) => (
                <div
                  key={key}
                  style={{
                    padding: '0.75rem',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                  }}
                >
                  <strong>{key.replaceAll('_', ' ')}</strong>
                  <div className="copy">{scoreLabel(detail.score)}</div>
                  <div className="copy" style={{ fontSize: '0.88rem' }}>{detail.rationale}</div>
                  <div className="copy" style={{ fontSize: '0.82rem', opacity: 0.8 }}>
                    Confidence {percent(detail.confidence)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <p className="copy"><strong>Analysis basis:</strong> {result.analysis_basis.replaceAll('_', ' ')}</p>
            <p className="copy"><strong>Estimated length:</strong> {Math.round(result.metrics.estimated_song_length_seconds)} seconds</p>
            <p className="copy"><strong>Word count:</strong> {result.metrics.word_count}</p>
            <p className="copy"><strong>Unique word ratio:</strong> {percent(result.metrics.unique_word_ratio)}</p>
            <p className="copy"><strong>Chorus repetition:</strong> {result.metrics.chorus_repetition_analysis}</p>
            {result.limitations.length ? (
              <p className="copy"><strong>Analysis limits:</strong> {result.limitations.join(' ')}</p>
            ) : null}
          </div>
        </IntelligenceDisclosure>
      </div>
    </div>
  );
}


export function SongIntelligencePanel({
  songId,
  slug,
  audioAttachments,
  transcripts,
  audienceMetrics,
  hasCapturedText,
  analysisStage,
}: Props) {
  const router = useRouter();
  const [saveState, saveFormAction] = useActionState(
    saveSongTranscript,
    initialSaveState
  );
  const [generateState, setGenerateState] = useState<GenerateState>({
    status: 'idle',
    message: '',
  });
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>({
    status: 'idle',
    message: '',
    result: null,
    runId: null,
  });
  const [taskCreateState, setTaskCreateState] = useState<TaskCreateState>({});
  const [songTasks, setSongTasks] = useState<SongTask[]>([]);
  const [taskListState, setTaskListState] = useState<TaskListState>({
    status: 'idle',
    message: '',
    updatingTaskId: null,
  });
  const [selectedAttachmentId, setSelectedAttachmentId] = useState(
    audioAttachments[0]?.id ?? ''
  );
  const [isTranscriptReviewed, setIsTranscriptReviewed] = useState(false);
  const handledSaveTokenRef = useRef('');
  const completionNoticeRef = useRef<HTMLDivElement | null>(null);
  const previousAnalyticsStatusRef = useRef<AnalyticsState['status']>('idle');

  useEffect(() => {
    const previousStatus = previousAnalyticsStatusRef.current;
    previousAnalyticsStatusRef.current = analyticsState.status;

    if (
      previousStatus !== 'loading' ||
      analyticsState.status !== 'success' ||
      !analyticsState.result
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const notice = completionNoticeRef.current;
      if (!notice) return;

      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      notice.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
      notice.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [analyticsState.status, analyticsState.result]);

  const selectedAttachment = useMemo(
    () =>
      audioAttachments.find((item) => item.id === selectedAttachmentId) ?? null,
    [audioAttachments, selectedAttachmentId]
  );

  const selectedTranscript = useMemo(
    () =>
      transcripts.find((item) => item.attachment_id === selectedAttachmentId) ??
      null,
    [transcripts, selectedAttachmentId]
  );

  useEffect(() => {
    setIsTranscriptReviewed(selectedTranscript?.is_reviewed ?? false);
  }, [selectedAttachmentId, selectedTranscript?.id, selectedTranscript?.is_reviewed]);

  useEffect(() => {
    if (saveState.status !== 'success') return;

    router.refresh();

    if (
      saveState.runAnalytics &&
      saveState.transcriptId &&
      saveState.saveToken &&
      handledSaveTokenRef.current !== saveState.saveToken
    ) {
      handledSaveTokenRef.current = saveState.saveToken;
      void handleRunAnalytics(saveState.transcriptId, true);
    }
  }, [
    router,
    saveState.runAnalytics,
    saveState.saveToken,
    saveState.status,
    saveState.transcriptId,
  ]);

  const loadSongTasks = useCallback(async () => {
    setTaskListState((current) => ({
      ...current,
      status: 'loading',
      message: '',
    }));

    try {
      const query = new URLSearchParams({ song_id: songId });
      const response = await fetch(`/api/song-tasks?${query.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const result = (await response.json().catch(() => null)) as
        | {
            status?: string;
            message?: string;
            tasks?: SongTask[];
          }
        | null;

      if (!response.ok || result?.status !== 'success') {
        setTaskListState({
          status: 'error',
          message:
            result?.message ||
            `Song task lookup failed with status ${response.status}.`,
          updatingTaskId: null,
        });
        return;
      }

      setSongTasks(result.tasks || []);
      setTaskListState({
        status: 'success',
        message: '',
        updatingTaskId: null,
      });
    } catch (error) {
      setTaskListState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Could not load song tasks.',
        updatingTaskId: null,
      });
    }
  }, [songId]);

  useEffect(() => {
    void loadSongTasks();
  }, [loadSongTasks]);

  useEffect(() => {
    const transcriptId = selectedTranscript?.id;
    let cancelled = false;

    async function loadLatestAnalysis() {
      try {
        const query = new URLSearchParams({ song_id: songId });
        if (transcriptId) query.set('transcript_id', transcriptId);

        const response = await fetch(
          `/api/song-analytics/generate?${query.toString()}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        );

        const result = (await response.json().catch(() => null)) as
          | {
              status?: string;
              message?: string;
              result?: SongIntelligenceResult;
              run_id?: string;
            }
          | null;

        if (cancelled) return;

        if (response.ok && result?.status === 'success' && result.result) {
          setAnalyticsState({
            status: 'success',
            message: 'Latest saved analysis loaded.',
            result: result.result,
            runId: result.run_id || null,
          });
          setTaskCreateState({});
        } else if (response.ok && result?.status === 'empty') {
          setAnalyticsState({
            status: 'idle',
            message: '',
            result: null,
            runId: null,
          });
          setTaskCreateState({});
        } else {
          setAnalyticsState({
            status: 'error',
            message:
              result?.message ||
              `Analysis lookup failed with status ${response.status}.`,
            result: null,
            runId: null,
          });
        }
      } catch (error) {
        if (cancelled) return;

        setAnalyticsState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Could not load the latest analysis.',
          result: null,
          runId: null,
        });
      }
    }

    void loadLatestAnalysis();

    return () => {
      cancelled = true;
    };
  }, [selectedTranscript?.id, songId]);

  async function handleGenerateTranscript() {
    if (!selectedAttachmentId) {
      setGenerateState({
        status: 'error',
        message: 'Choose an audio recording first.',
      });
      return;
    }

    setGenerateState({ status: 'loading', message: '' });

    try {
      const requestBody = new FormData();
      requestBody.append('song_id', songId);
      requestBody.append('slug', slug);
      requestBody.append('attachment_id', selectedAttachmentId);

      const response = await fetch('/api/song-transcript/generate', {
        method: 'POST',
        body: requestBody,
      });

      const result = (await response.json().catch(() => null)) as
        | { status?: string; message?: string }
        | null;

      if (!response.ok || result?.status !== 'success') {
        setGenerateState({
          status: 'error',
          message:
            result?.message ||
            `Transcription failed with status ${response.status}.`,
        });
        return;
      }

      setGenerateState({
        status: 'success',
        message: result.message || 'Transcript generated successfully.',
      });
      router.refresh();
    } catch (error) {
      setGenerateState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Transcript generation failed.',
      });
    }
  }

  async function handleRunAnalytics(
    transcriptIdOverride?: string,
    reviewedOverride = false
  ) {
    const transcriptId = transcriptIdOverride || selectedTranscript?.id || '';
    const transcriptReviewed =
      reviewedOverride || selectedTranscript?.is_reviewed || false;
    const previousRunId = analyticsState.runId;
    const requestStartedAt = Date.now();

    if (audioAttachments.length && (!transcriptId || !transcriptReviewed)) {
      setAnalyticsState({
        status: 'error',
        message:
          'Transcribe the recording and review the words before running Song Intelligence.',
        result: null,
        runId: null,
      });
      return;
    }

    if (!transcriptId && !hasCapturedText && !audioAttachments.length) {
      setAnalyticsState({
        status: 'error',
        message: 'Add a title, a few words, a note, or a document before running Song Intelligence.',
        result: null,
        runId: null,
      });
      return;
    }

    setAnalyticsState((current) => ({
      status: 'loading',
      message: '',
      result: current.result,
      runId: current.runId,
    }));

    try {
      const requestBody = new FormData();
      requestBody.append('song_id', songId);
      requestBody.append('slug', slug);
      if (transcriptId) {
        requestBody.append('transcript_id', transcriptId);
      }

      const response = await fetch('/api/song-analytics/generate', {
        method: 'POST',
        body: requestBody,
      });

      const result = (await response.json().catch(() => null)) as
        | {
            status?: string;
            message?: string;
            result?: SongIntelligenceResult;
            run_id?: string;
          }
        | null;

      if (!response.ok || result?.status !== 'success' || !result.result) {
        setAnalyticsState({
          status: 'error',
          message:
            result?.message ||
            `AI Song Intelligence failed with status ${response.status}.`,
          result: null,
          runId: null,
        });
        return;
      }

      setAnalyticsState({
        status: 'success',
        message: result.message || 'AI Song Intelligence generated and saved.',
        result: result.result,
        runId: result.run_id || null,
      });
      setTaskCreateState({});
    } catch (error) {
      const transportMessage =
        error instanceof Error ? error.message : 'AI Song Intelligence failed.';

      // A dropped browser connection can happen after the server has already
      // finished and saved a new analysis. Before suggesting another paid run,
      // check the saved-analysis endpoint for a newly completed run.
      const recoveryDelaysMs = [0, 2500, 5000, 7500];

      for (const delayMs of recoveryDelaysMs) {
        if (delayMs) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        try {
          const query = new URLSearchParams({ song_id: songId });
          if (transcriptId) query.set('transcript_id', transcriptId);

          const recoveryResponse = await fetch(
            `/api/song-analytics/generate?${query.toString()}`,
            {
              method: 'GET',
              cache: 'no-store',
            }
          );

          const recovery = (await recoveryResponse.json().catch(() => null)) as
            | {
                status?: string;
                result?: SongIntelligenceResult;
                run_id?: string;
                completed_at?: string;
              }
            | null;

          const completedAt = recovery?.completed_at
            ? Date.parse(recovery.completed_at)
            : Number.NaN;
          const isNewlyCompletedRun =
            Boolean(recovery?.run_id) &&
            recovery?.run_id !== previousRunId &&
            Number.isFinite(completedAt) &&
            completedAt >= requestStartedAt - 5000;

          if (
            recoveryResponse.ok &&
            recovery?.status === 'success' &&
            recovery.result &&
            recovery.run_id &&
            isNewlyCompletedRun
          ) {
            setAnalyticsState({
              status: 'success',
              message:
                'Song Intelligence completed and was recovered after the connection was interrupted.',
              result: recovery.result,
              runId: recovery.run_id,
            });
            setTaskCreateState({});
            return;
          }
        } catch {
          // Keep checking. A temporary mobile/network interruption can also
          // affect the first recovery lookup.
        }
      }

      setAnalyticsState({
        status: 'error',
        message:
          transportMessage === 'Failed to fetch'
            ? 'The connection ended before Song Intelligence could confirm completion. Do not run it again yet. Wait a moment, then refresh this song to check for a saved result.'
            : transportMessage,
        result: null,
        runId: null,
      });
    }
  }

  async function handleCreateSongTask(
    taskKey: string,
    title: string,
    description: string,
    priority: number
  ) {
    setTaskCreateState((current) => ({
      ...current,
      [taskKey]: {
        status: 'loading',
        message: '',
      },
    }));

    try {
      const requestBody = new FormData();
      requestBody.append('song_id', songId);
      requestBody.append(
        'song_version_id',
        selectedTranscript?.song_version_id || ''
      );
      requestBody.append('analysis_run_id', analyticsState.runId || '');
      requestBody.append('title', title);
      requestBody.append('description', description);
      requestBody.append('priority', String(priority));

      const response = await fetch('/api/song-tasks/create', {
        method: 'POST',
        body: requestBody,
      });

      const result = (await response.json().catch(() => null)) as
        | {
            status?: string;
            message?: string;
            task_id?: string;
          }
        | null;

      if (!response.ok || result?.status !== 'success') {
        setTaskCreateState((current) => ({
          ...current,
          [taskKey]: {
            status: 'error',
            message:
              result?.message ||
              `Task creation failed with status ${response.status}.`,
          },
        }));
        return;
      }

      setTaskCreateState((current) => ({
        ...current,
        [taskKey]: {
          status: 'success',
          message: result.message || 'Song task created.',
        },
      }));
      await loadSongTasks();
    } catch (error) {
      setTaskCreateState((current) => ({
        ...current,
        [taskKey]: {
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Song task creation failed.',
        },
      }));
    }
  }

  async function handleUpdateTaskStatus(
    taskId: string,
    status: SongTaskStatus
  ) {
    setTaskListState((current) => ({
      ...current,
      message: '',
      updatingTaskId: taskId,
    }));

    try {
      const requestBody = new FormData();
      requestBody.append('song_id', songId);
      requestBody.append('task_id', taskId);
      requestBody.append('status', status);

      const response = await fetch('/api/song-tasks', {
        method: 'PATCH',
        body: requestBody,
      });

      const result = (await response.json().catch(() => null)) as
        | {
            status?: string;
            message?: string;
            task?: SongTask;
          }
        | null;

      if (!response.ok || result?.status !== 'success' || !result.task) {
        setTaskListState({
          status: 'error',
          message:
            result?.message ||
            `Task update failed with status ${response.status}.`,
          updatingTaskId: null,
        });
        return;
      }

      setSongTasks((current) =>
        current.map((task) => (task.id === taskId ? result.task! : task))
      );
      setTaskListState({
        status: 'success',
        message: result.message || 'Song task updated.',
        updatingTaskId: null,
      });
    } catch (error) {
      setTaskListState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Song task update failed.',
        updatingTaskId: null,
      });
    }
  }

  if (audioAttachments.length === 0) {
    return (
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="eyebrow">Song intelligence</div>
        <h2 className="h2">Understand what you caught</h2>
        <p className="copy" style={{ maxWidth: 840 }}>
          Analyze the title, captured words, lyrics, summary, hook, writer notes,
          and attached-document context already saved with this song. No
          recording or transcript is required.
        </p>

        <div className="pillRow" style={{ marginTop: '0.75rem' }}>
          <span className="pill">{analysisStage} assessment</span>
          <span className="pill">
            {hasCapturedText ? 'Saved text available' : 'Limited material'}
          </span>
        </div>

        <RecommendedNextAction
          title="Run Song Intelligence"
          description={
            <p>
              See provisional ratings, creative strengths, a recommended next move,
              and the Muse best suited to help this Spark develop.
            </p>
          }
        >
          <button
            type="button"
            className="button primary"
            onClick={() => void handleRunAnalytics()}
            disabled={analyticsState.status === 'loading'}
            aria-busy={analyticsState.status === 'loading'}
          >
            {analyticsState.status === 'loading'
              ? 'Song Intelligence is working'
              : analyticsState.status === 'success'
                ? 'Regenerate Song Intelligence'
                : 'Run Song Intelligence'}
            {analyticsState.status === 'loading' ? (
              <AnimatedDots label="Song Intelligence is working" />
            ) : null}
          </button>
        </RecommendedNextAction>

        {analyticsState.status === 'loading' ? (
          <AnalysisLoadingState
            title="Song Intelligence is working"
            messages={[
              'Reading the title, captured words, notes, lyrics, and document context.',
              'Identifying creative strengths, hook possibilities, and development needs.',
              'Considering the most useful Muse direction and next move.',
              'Still working—your analysis will appear here when it is ready.',
            ]}
          />
        ) : null}

        {analyticsState.message ? (
          <div
            ref={completionNoticeRef}
            role="status"
            aria-live="polite"
            tabIndex={-1}
            style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: 14,
              border: '1px solid var(--line)',
              color:
                analyticsState.status === 'error' ? '#ffb4b4' : '#d9f7d6',
              background:
                analyticsState.status === 'error'
                  ? 'rgba(160, 40, 40, 0.18)'
                  : 'rgba(40, 130, 60, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              scrollMarginTop: '6rem',
              outline: 'none',
            }}
          >
            <div>
              {analyticsState.status === 'success' ? (
                <div className="eyebrow" style={{ color: '#d9f7d6' }}>
                  Song Intelligence complete
                </div>
              ) : null}
              <strong style={{ display: 'block', marginTop: '0.2rem' }}>
                {analyticsState.message}
              </strong>
              {analyticsState.status === 'success' ? (
                <div className="copy" style={{ marginTop: '0.25rem' }}>
                  Your results are ready below.
                </div>
              ) : null}
            </div>
            {analyticsState.status === 'success' ? (
              <span
                className="pill"
                style={{
                  borderColor: 'rgba(140, 225, 150, 0.55)',
                  color: '#d9f7d6',
                  background: 'rgba(40, 130, 60, 0.22)',
                  whiteSpace: 'nowrap',
                }}
              >
                Saved automatically
              </span>
            ) : null}
          </div>
        ) : null}

        {analyticsState.result ? (
          <IntelligenceResults
            result={analyticsState.result}
            slug={slug}
            taskState={taskCreateState}
            onCreateTask={handleCreateSongTask}
          />
        ) : null}

        <details
          style={{
            marginTop: '1.25rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '0 1rem 1rem',
          }}
        >
          <summary style={{ cursor: 'pointer', padding: '1rem 0', fontWeight: 800 }}>
            Listener Response &amp; Audience Fit
          </summary>
          <AudienceIntelligencePanel
            metrics={audienceMetrics}
            intelligence={analyticsState.result}
          />
        </details>

        <details
          style={{
            marginTop: '0.75rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '0 1rem 1rem',
          }}
        >
          <summary style={{ cursor: 'pointer', padding: '1rem 0', fontWeight: 800 }}>
            Song Tasks ({songTasks.length})
          </summary>
          <SongTasksManager
            tasks={songTasks}
            state={taskListState}
            onRefresh={() => {
              void loadSongTasks();
            }}
            onUpdateStatus={handleUpdateTaskStatus}
          />
        </details>
      </div>
    );
  }

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="eyebrow">Song intelligence</div>
      <h2 className="h2">Transcript first, then Song Intelligence</h2>
      <p className="copy" style={{ maxWidth: 840 }}>
        Song Intelligence reads the words in your recording. Transcribe the
        audio, check what was heard, and correct anything that was misread
        before the song is analyzed.
      </p>

      <section
        className={!selectedTranscript?.is_reviewed ? 'recommended-action' : undefined}
        style={{
          marginTop: '1rem',
          padding: '1.1rem',
          border: '1px solid rgba(220, 182, 92, 0.42)',
          borderRadius: 18,
          background: 'rgba(0,0,0,0.12)',
        }}
      >
        <div className="eyebrow">
          {!selectedTranscript?.is_reviewed ? 'Recommended next step · ' : ''}
          Step 1 · Transcribe and review
        </div>
        <h3 className="h3" style={{ marginTop: '0.35rem' }}>
          Make sure Song Intelligence hears the right words
        </h3>

        <label className="copy" htmlFor="intelligence-audio">
          Recording
        </label>
        <select
          id="intelligence-audio"
          className="input"
          value={selectedAttachmentId}
          onChange={(event) => setSelectedAttachmentId(event.target.value)}
        >
          {audioAttachments.map((attachment) => (
            <option key={attachment.id} value={attachment.id}>
              {attachment.title ||
                attachment.storage_path.split('/').pop() ||
                'Audio recording'}
            </option>
          ))}
        </select>

        <div
          className="pillRow"
          style={{ marginTop: '0.75rem', marginBottom: '1rem' }}
        >
          <span className="pill">{selectedAttachment?.mime_type || 'audio'}</span>
          {selectedTranscript ? (
            <span className="pill">
              {selectedTranscript.is_reviewed
                ? 'Transcript reviewed'
                : 'Transcript ready for review'}
            </span>
          ) : (
            <span className="pill">No transcript yet</span>
          )}
        </div>

        <button
          type="button"
          className={selectedTranscript ? 'button' : 'button primary'}
          onClick={handleGenerateTranscript}
          disabled={generateState.status === 'loading'}
          aria-busy={generateState.status === 'loading'}
          style={{
            cursor: generateState.status === 'loading' ? 'wait' : 'pointer',
            opacity: generateState.status === 'loading' ? 0.7 : 1,
          }}
        >
          {generateState.status === 'loading' ? (
            <>
              Transcribing your recording
              <AnimatedDots label="Transcribing your recording" />
            </>
          ) : selectedTranscript ? (
            'Regenerate Transcript'
          ) : (
            'Transcribe My Recording'
          )}
        </button>

        {generateState.status === 'loading' ? (
          <AnalysisLoadingState
            title="Transcribing your recording"
            messages={[
              'Listening for the words, phrases, and repeated lines.',
              'Preparing editable text for you to review against the recording.',
              'Still working—longer recordings can take a little more time.',
            ]}
          />
        ) : null}

        {generateState.message ? (
          <div
            role="status"
            style={{
              marginTop: '1rem',
              padding: '0.85rem 1rem',
              borderRadius: 14,
              border: '1px solid var(--line)',
              color:
                generateState.status === 'error' ? '#ffb4b4' : '#d9f7d6',
              background:
                generateState.status === 'error'
                  ? 'rgba(160, 40, 40, 0.18)'
                  : 'rgba(40, 130, 60, 0.18)',
            }}
          >
            {generateState.message}
          </div>
        ) : null}

        <form
          action={saveFormAction}
          key={`save-${selectedAttachmentId}-${selectedTranscript?.updated_at ?? 'new'}`}
          style={{ marginTop: '1rem' }}
        >
          <input type="hidden" name="song_id" value={songId} />
          <input type="hidden" name="slug" value={slug} />
          <input
            type="hidden"
            name="attachment_id"
            value={selectedAttachmentId}
          />
          <input
            type="hidden"
            name="song_version_id"
            value={selectedAttachment?.song_version_id ?? ''}
          />
          <input
            type="hidden"
            name="transcript_id"
            value={selectedTranscript?.id ?? ''}
          />

          <label className="copy" htmlFor="transcript_text">
            {selectedTranscript
              ? 'Review and correct the transcript'
              : 'Transcript — generate it above or enter it manually'}
          </label>
          <textarea
            id="transcript_text"
            name="transcript_text"
            className="textarea"
            rows={14}
            defaultValue={selectedTranscript?.transcript_text ?? ''}
            placeholder="The words from the recording will appear here. Correct anything that was misheard."
          />

          <label
            className="copy"
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              marginTop: '0.75rem',
            }}
          >
            <input
              type="checkbox"
              name="is_reviewed"
              checked={isTranscriptReviewed}
              onChange={(event) => setIsTranscriptReviewed(event.target.checked)}
            />
            <span>I reviewed this transcript against the recording.</span>
          </label>

          {saveState.message ? (
            <div
              role="status"
              style={{
                marginTop: '1rem',
                padding: '0.85rem 1rem',
                borderRadius: 14,
                border: '1px solid var(--line)',
                color:
                  saveState.status === 'error' ? '#ffb4b4' : '#d9f7d6',
                background:
                  saveState.status === 'error'
                    ? 'rgba(160, 40, 40, 0.18)'
                    : 'rgba(40, 130, 60, 0.18)',
              }}
            >
              {saveState.message}
            </div>
          ) : null}

          <div className="button-row" style={{ marginTop: '1rem' }}>
            <SaveTranscriptButton />
            <SaveTranscriptButton
              runIntelligence
              disabled={!isTranscriptReviewed}
            />
          </div>
        </form>
      </section>

      <section
        className={selectedTranscript?.is_reviewed ? 'recommended-action' : undefined}
        style={{
          marginTop: '1rem',
          padding: '1.1rem',
          border: '1px solid var(--line)',
          borderRadius: 18,
          background: selectedTranscript?.is_reviewed
            ? 'linear-gradient(145deg, rgba(220, 182, 92, 0.12), rgba(255,255,255,0.025))'
            : 'rgba(255,255,255,0.025)',
        }}
      >
        <div className="eyebrow">
          {selectedTranscript?.is_reviewed ? 'Recommended next step · ' : ''}
          Step 2 · Understand the song
        </div>
        <h3 className="h3" style={{ marginTop: '0.35rem' }}>
          Run Song Intelligence
        </h3>
        <p className="copy" style={{ maxWidth: 820 }}>
          {selectedTranscript?.is_reviewed
            ? 'The reviewed transcript is ready. Song Intelligence will combine it with the title, captured words, notes, lyrics, and other saved material.'
            : 'Review and save the transcript above to unlock ratings, Muse direction, story and hook analysis, and the recommended next move.'}
        </p>
        <button
          type="button"
          className="button primary"
          onClick={() => void handleRunAnalytics()}
          disabled={
            !selectedTranscript?.is_reviewed || analyticsState.status === 'loading'
          }
          aria-busy={analyticsState.status === 'loading'}
          style={{
            cursor:
              !selectedTranscript?.is_reviewed || analyticsState.status === 'loading'
                ? 'not-allowed'
                : 'pointer',
            opacity:
              !selectedTranscript?.is_reviewed || analyticsState.status === 'loading'
                ? 0.55
                : 1,
          }}
        >
          {analyticsState.status === 'loading' ? (
            <>
              Song Intelligence is working
              <AnimatedDots label="Song Intelligence is working" />
            </>
          ) : analyticsState.status === 'success' ? (
            'Regenerate Song Intelligence'
          ) : (
            'Run Song Intelligence'
          )}
        </button>

        {analyticsState.status === 'loading' ? (
          <AnalysisLoadingState
            title="Song Intelligence is working"
            messages={[
              'Reading your reviewed transcript and the other material saved with this song.',
              'Identifying strengths, hook possibilities, and development opportunities.',
              'Considering the most useful Muse direction and recommended next move.',
              'Still working—your results will replace this message when they are ready.',
            ]}
          />
        ) : null}
      </section>

      {analyticsState.message ? (
        <div
          ref={completionNoticeRef}
          role="status"
          aria-live="polite"
          tabIndex={-1}
          style={{
            marginTop: '1rem',
            padding: '1rem',
            borderRadius: 14,
            border: '1px solid var(--line)',
            color:
              analyticsState.status === 'error' ? '#ffb4b4' : '#d9f7d6',
            background:
              analyticsState.status === 'error'
                ? 'rgba(160, 40, 40, 0.18)'
                : 'rgba(40, 130, 60, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            scrollMarginTop: '6rem',
            outline: 'none',
          }}
        >
          <div>
            {analyticsState.status === 'success' ? (
              <div className="eyebrow" style={{ color: '#d9f7d6' }}>
                Song Intelligence complete
              </div>
            ) : null}
            <strong style={{ display: 'block', marginTop: '0.2rem' }}>
              {analyticsState.message}
            </strong>
            {analyticsState.status === 'success' ? (
              <div className="copy" style={{ marginTop: '0.25rem' }}>
                Your results are ready below.
              </div>
            ) : null}
          </div>
          {analyticsState.status === 'success' ? (
            <span
              className="pill"
              style={{
                borderColor: 'rgba(140, 225, 150, 0.55)',
                color: '#d9f7d6',
                background: 'rgba(40, 130, 60, 0.22)',
                whiteSpace: 'nowrap',
              }}
            >
              Saved automatically
            </span>
          ) : null}
        </div>
      ) : null}

      {analyticsState.result ? (
        <IntelligenceResults
          result={analyticsState.result}
          slug={slug}
          taskState={taskCreateState}
          onCreateTask={handleCreateSongTask}
        />
      ) : null}

      <details
        style={{
          marginTop: '1.25rem',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: '0 1rem 1rem',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            padding: '1rem 0',
            fontWeight: 800,
          }}
        >
          Listener Response &amp; Audience Fit
          <span
            className="copy"
            style={{
              display: 'block',
              marginTop: '0.3rem',
              marginLeft: '1.25rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              opacity: 0.82,
            }}
          >
            Real listener activity, likely audiences, playlists, and sync possibilities.
          </span>
        </summary>
        <AudienceIntelligencePanel
          metrics={audienceMetrics}
          intelligence={analyticsState.result}
        />
      </details>

      <details
        style={{
          marginTop: '0.75rem',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: '0 1rem 1rem',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            padding: '1rem 0',
            fontWeight: 800,
          }}
        >
          Song Tasks ({songTasks.length})
          <span
            className="copy"
            style={{
              display: 'block',
              marginTop: '0.3rem',
              marginLeft: '1.25rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              opacity: 0.82,
            }}
          >
            Turn selected recommendations into manageable development work.
          </span>
        </summary>
        <SongTasksManager
          tasks={songTasks}
          state={taskListState}
          onRefresh={() => {
            void loadSongTasks();
          }}
          onUpdateStatus={handleUpdateTaskStatus}
        />
      </details>
    </div>
  );
}
