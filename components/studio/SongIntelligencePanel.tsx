'use client';

import { useActionState, useCallback, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
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
  analysis_basis: 'lyrics_and_transcript' | 'lyrics_only' | 'transcript_only';
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

type Props = {
  songId: string;
  slug: string;
  audioAttachments: AudioAttachment[];
  transcripts: Transcript[];
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

function SaveTranscriptButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="button primary"
      disabled={pending}
      style={{ cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}
    >
      {pending ? 'Saving…' : 'Save transcript'}
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
        className="button"
        onClick={onCreate}
        disabled={isLoading || isSuccess}
        style={{
          cursor: isLoading || isSuccess ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.78 : 1,
          fontSize: '0.9rem',
          fontWeight: 800,
          padding: '0.65rem 0.9rem',
          color: isSuccess ? '#f4fff5' : '#17120a',
          background: isSuccess
            ? 'linear-gradient(135deg, #287a45 0%, #1d5e35 100%)'
            : isLoading
              ? 'linear-gradient(135deg, #ad8234 0%, #7f5d22 100%)'
              : 'linear-gradient(135deg, #ffe49a 0%, #dca52f 100%)',
          border: isSuccess
            ? '1px solid #68c987'
            : '1px solid #ffe7a7',
          boxShadow: isSuccess
            ? '0 8px 22px rgba(35, 120, 67, 0.24)'
            : '0 8px 22px rgba(220, 165, 47, 0.28)',
          textShadow: isSuccess ? '0 1px 1px rgba(0,0,0,0.35)' : 'none',
        }}
      >
        {isLoading
          ? 'Creating Task…'
          : isSuccess
            ? '✓ Task Created'
            : label || '+ Create Song Task'}
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
          className="button"
          onClick={onRefresh}
          disabled={state.status === 'loading'}
          style={{
            cursor: state.status === 'loading' ? 'wait' : 'pointer',
            opacity: state.status === 'loading' ? 0.7 : 1,
            color: '#17120a',
            background: 'linear-gradient(135deg, #ffe49a 0%, #dca52f 100%)',
            border: '1px solid #ffe7a7',
            fontWeight: 800,
            boxShadow: '0 6px 16px rgba(220, 165, 47, 0.2)',
          }}
        >
          {state.status === 'loading' ? 'Loading Tasks…' : 'Refresh Tasks'}
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

function IntelligenceResults({
  result,
  taskState,
  onCreateTask,
}: {
  result: SongIntelligenceResult;
  taskState: TaskCreateState;
  onCreateTask: (
    taskKey: string,
    title: string,
    description: string,
    priority: number
  ) => void;
}) {
  return (
    <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
      <div>
        <div className="eyebrow">AI Song Intelligence</div>
        <h3 className="h2" style={{ marginTop: '0.25rem' }}>
          Song Intelligence Report
        </h3>
        <p className="copy" style={{ maxWidth: 900 }}>
          {result.summary}
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

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
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
          <div className="eyebrow">Strengths</div>
          <TextList items={result.strengths} />
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Work Needed</div>
          {result.work_needed.length ? (
            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.6rem' }}>
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
          <div className="eyebrow">Story</div>
          <p className="copy">
            <strong>Core theme:</strong> {result.story.core_theme}
          </p>
          <p className="copy">
            <strong>Emotional arc:</strong> {result.story.emotional_arc}
          </p>
          <p className="copy">
            <strong>Narrative clarity:</strong> {result.story.narrative_clarity}
          </p>
          <p className="copy">
            <strong>Strongest moment:</strong> {result.story.strongest_story_moment}
          </p>
          <p className="copy">
            <strong>Missing element:</strong> {result.story.missing_story_element}
          </p>
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Hook</div>
          <p className="copy">
            <strong>Hook:</strong> {result.hook.hook_text || 'Not clearly isolated'}
          </p>
          <p className="copy">
            <strong>Strength:</strong> {result.hook.strength}
          </p>
          <p className="copy">
            <strong>Memorability:</strong> {result.hook.memorability}
          </p>
          <p className="copy">
            <strong>Commercial potential:</strong> {result.hook.commercial_potential}
          </p>
          <p className="copy">
            <strong>Improvement:</strong> {result.hook.improvement}
          </p>
        </div>
      </div>

      <div
        style={{
          padding: '1rem',
          border: '1px solid var(--line)',
          borderRadius: 16,
        }}
      >
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
          <div className="eyebrow">Lyric Craft</div>
          <p className="copy">
            <strong>Rhyme density:</strong> {result.lyrics.rhyme_density}
          </p>
          <p className="copy">
            <strong>Internal rhyme:</strong> {result.lyrics.internal_rhyme_notes}
          </p>
          <p className="copy">
            <strong>Alliteration:</strong> {result.lyrics.alliteration_notes}
          </p>
          <p className="copy">
            <strong>Metaphor:</strong> {result.lyrics.metaphor_notes}
          </p>
          <p className="copy">
            <strong>Reading grade:</strong>{' '}
            {result.lyrics.reading_grade_level.toFixed(1)}
          </p>
          <p className="copy">
            <strong>Singability:</strong> {result.lyrics.singability_notes}
          </p>
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Musical Direction</div>
          <p className="copy">
            <strong>Tempo feel:</strong> {result.musical_suggestions.tempo_feel}
          </p>
          <p className="copy">
            <strong>Suggested BPM:</strong>{' '}
            {result.musical_suggestions.suggested_bpm_min}–
            {result.musical_suggestions.suggested_bpm_max}
          </p>
          <p className="copy">
            <strong>Genre fit:</strong>{' '}
            {result.musical_suggestions.genre_fit.join(', ')}
          </p>
          <p className="copy">
            <strong>Vocal guidance:</strong>{' '}
            {result.musical_suggestions.vocal_range_guidance}
          </p>
          <p className="copy">
            <strong>Arrangement arc:</strong>{' '}
            {result.musical_suggestions.arrangement_arc}
          </p>
          <p className="copy">
            <strong>Production:</strong> {result.musical_suggestions.production_notes}
          </p>
        </div>
      </div>

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
          <div className="eyebrow">Rewrite Opportunities</div>
          {result.rewrite_opportunities.length ? (
            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.6rem' }}>
              {result.rewrite_opportunities.map((item, index) => (
                <div key={`${item.section}-${index}`}>
                  <strong>{item.section}</strong>
                  <div className="copy">{item.issue}</div>
                  <div className="copy">
                    <em>Direction:</em> {item.direction}
                  </div>
                  <div className="copy">
                    <em>Strategy:</em> {item.example_strategy}
                  </div>
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
            <p className="copy">No focused rewrites identified.</p>
          )}
        </div>

        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--line)',
            borderRadius: 16,
          }}
        >
          <div className="eyebrow">Audience & Style</div>
          <p className="copy">
            <strong>Likely listeners:</strong>{' '}
            {result.audience.likely_listeners.join(', ')}
          </p>
          <p className="copy">
            <strong>Radio potential:</strong> {result.audience.radio_potential}
          </p>
          <p className="copy">
            <strong>Playlist fit:</strong>{' '}
            {result.audience.streaming_playlist_fit.join(', ')}
          </p>
          <p className="copy">
            <strong>Sync opportunities:</strong>{' '}
            {result.audience.sync_opportunities.join(', ')}
          </p>
          <div style={{ marginTop: '0.8rem' }}>
            <strong>Stylistic comparisons</strong>
            {result.similar_artists.map((item, index) => (
              <div className="copy" key={`${item.artist}-${index}`}>
                {item.artist} ({Math.round(item.similarity)}%): {item.reason}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '1rem',
          border: '1px solid var(--line)',
          borderRadius: 16,
        }}
      >
        <div className="eyebrow">Emotional Curve</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.65rem',
            marginTop: '0.75rem',
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
      </div>

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

      {result.limitations.length ? (
        <div className="copy" style={{ fontSize: '0.9rem', opacity: 0.85 }}>
          <strong>Analysis limits:</strong> {result.limitations.join(' ')}
        </div>
      ) : null}
    </div>
  );
}

export function SongIntelligencePanel({
  songId,
  slug,
  audioAttachments,
  transcripts,
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
    if (saveState.status === 'success') {
      router.refresh();
    }
  }, [router, saveState.status]);

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

    if (!transcriptId) {
      setAnalyticsState({
        status: 'idle',
        message: '',
        result: null,
        runId: null,
      });
      setTaskCreateState({});
      return;
    }

    let cancelled = false;

    async function loadLatestAnalysis(id: string) {
      try {
        const query = new URLSearchParams({
          song_id: songId,
          transcript_id: id,
        });

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

    void loadLatestAnalysis(transcriptId);

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

  async function handleRunAnalytics() {
    if (!selectedTranscript?.id) {
      setAnalyticsState({
        status: 'error',
        message: 'Save or generate a transcript before running AI Song Intelligence.',
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
      requestBody.append('transcript_id', selectedTranscript.id);

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
      setAnalyticsState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'AI Song Intelligence failed.',
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
        <h2 className="h2">Transcript &amp; AI Song Intelligence</h2>
        <p className="copy">
          Upload an audio version of this song first. Once a recording exists, it
          can be transcribed, reviewed, and analyzed here.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="eyebrow">Song intelligence</div>
      <h2 className="h2">Transcript &amp; AI Song Intelligence</h2>
      <p className="copy" style={{ maxWidth: 820 }}>
        Choose a recording, save or correct its transcript, then run the
        iDreamMusic Song Intelligence Engine for scores, Muse recommendations,
        story and hook analysis, audience fit, and development guidance.
      </p>

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
              : 'Transcript saved'}
          </span>
        ) : (
          <span className="pill">No transcript yet</span>
        )}
      </div>

      <form action={saveFormAction} key={`save-${selectedAttachmentId}`}>
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
          Full transcript
        </label>
        <textarea
          id="transcript_text"
          name="transcript_text"
          className="textarea"
          rows={14}
          defaultValue={selectedTranscript?.transcript_text ?? ''}
          placeholder="Paste or type the transcript here, or generate one from the recording."
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
            defaultChecked={selectedTranscript?.is_reviewed ?? false}
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
          <button
            type="button"
            className="button"
            onClick={handleRunAnalytics}
            disabled={
              !selectedTranscript ||
              analyticsState.status === 'loading'
            }
            title={
              selectedTranscript
                ? 'Generates and automatically saves a new Song Intelligence report'
                : 'Save or generate a transcript first'
            }
            style={{
              cursor:
                !selectedTranscript ||
                analyticsState.status === 'loading'
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                !selectedTranscript ||
                analyticsState.status === 'loading'
                  ? 0.55
                  : 1,
              color:
                !selectedTranscript ||
                analyticsState.status === 'loading'
                  ? 'rgba(255,255,255,0.72)'
                  : '#17120a',
              background:
                !selectedTranscript
                  ? 'rgba(255,255,255,0.06)'
                  : analyticsState.status === 'loading'
                    ? 'linear-gradient(135deg, #8f6a24 0%, #6f511b 100%)'
                    : 'linear-gradient(135deg, #ffd978 0%, #d9a12e 100%)',
              border:
                !selectedTranscript
                  ? '1px solid var(--line)'
                  : '1px solid rgba(255, 221, 132, 0.9)',
              boxShadow:
                !selectedTranscript ||
                analyticsState.status === 'loading'
                  ? 'none'
                  : '0 8px 24px rgba(217, 161, 46, 0.25)',
              fontWeight: 750,
            }}
          >
            {analyticsState.status === 'loading'
              ? 'Analyzing & Saving…'
              : analyticsState.status === 'success'
                ? 'Regenerate AI Song Intelligence'
                : 'Run AI Song Intelligence'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="button primary"
          onClick={handleGenerateTranscript}
          disabled={generateState.status === 'loading'}
          style={{
            cursor:
              generateState.status === 'loading' ? 'wait' : 'pointer',
            opacity: generateState.status === 'loading' ? 0.7 : 1,
          }}
        >
          {generateState.status === 'loading'
            ? 'Generating…'
            : 'Generate Transcript'}
        </button>

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
      </div>

      {analyticsState.message ? (
        <div
          role="status"
          style={{
            marginTop: '1rem',
            padding: '0.85rem 1rem',
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
          }}
        >
          <span>{analyticsState.message}</span>
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
          taskState={taskCreateState}
          onCreateTask={handleCreateSongTask}
        />
      ) : null}

      <SongTasksManager
        tasks={songTasks}
        state={taskListState}
        onRefresh={() => {
          void loadSongTasks();
        }}
        onUpdateStatus={handleUpdateTaskStatus}
      />
    </div>
  );
}
