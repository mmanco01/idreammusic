import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL_NAME = process.env.OPENAI_ANALYTICS_MODEL || 'gpt-5.6-terra';
const ANALYSIS_VERSION = '2.2';

const MUSE_NAMES = [
  'Calliope',
  'Clio',
  'Erato',
  'Euterpe',
  'Melpomene',
  'Polyhymnia',
  'Terpsichore',
  'Thalia',
  'Urania',
] as const;

const SCORE_DIMENSIONS = [
  'emotional_impact',
  'general_appeal',
  'inspiration_score',
  'lyric_clarity_score',
  'lyric_strength',
  'originality',
  'popular_appeal_score',
  'relatability_score',
  'hook_strength',
  'melodic_potential',
  'commercial_potential',
  'sync_potential',
  'development_readiness',
] as const;

type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

type ScoreDetail = {
  score: number;
  rationale: string;
  confidence: number;
};

type MuseName = (typeof MUSE_NAMES)[number];

type MuseRecommendation = {
  name: MuseName;
  confidence: number;
  rationale: string;
  supporting_lines: string[];
  guidance: string;
};

type SongIntelligenceResult = {
  analysis_basis:
    | 'lyrics_and_transcript'
    | 'lyrics_only'
    | 'transcript_only'
    | 'captured_text'
    | 'mixed_material';
  analysis_stage: 'spark' | 'draft' | 'final';
  source_types: string[];
  material_completeness: 'limited' | 'developing' | 'substantial';
  recommended_next_move: string;
  lead_muse: MuseName;
  lead_muse_reason: string;
  starter_question: string;
  limitations: string[];
  overall_score: number;
  ready_for_release_score: number;
  summary: string;
  suggested_phase:
    | 'publish_candidate'
    | 'crafting'
    | 'inspiration'
    | 'rights_review'
    | 'low_signal_fragment';
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
  scores: Record<ScoreDimension, ScoreDetail>;
  muse_analysis: {
    primary: MuseRecommendation;
    secondary: MuseRecommendation;
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

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
  incomplete_details?: {
    reason?: string;
  };
};

const scoreDetailSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: { type: 'number', minimum: 0, maximum: 100 },
    rationale: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['score', 'rationale', 'confidence'],
} as const;

const museRecommendationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', enum: MUSE_NAMES },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string' },
    supporting_lines: {
      type: 'array',
      items: { type: 'string' },
    },
    guidance: { type: 'string' },
  },
  required: ['name', 'confidence', 'rationale', 'supporting_lines', 'guidance'],
} as const;

const songIntelligenceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    analysis_basis: {
      type: 'string',
      enum: [
        'lyrics_and_transcript',
        'lyrics_only',
        'transcript_only',
        'captured_text',
        'mixed_material',
      ],
    },
    analysis_stage: {
      type: 'string',
      enum: ['spark', 'draft', 'final'],
    },
    source_types: {
      type: 'array',
      items: { type: 'string' },
    },
    material_completeness: {
      type: 'string',
      enum: ['limited', 'developing', 'substantial'],
    },
    recommended_next_move: { type: 'string' },
    lead_muse: { type: 'string', enum: MUSE_NAMES },
    lead_muse_reason: { type: 'string' },
    starter_question: { type: 'string' },
    limitations: {
      type: 'array',
      items: { type: 'string' },
    },
    overall_score: { type: 'number', minimum: 0, maximum: 100 },
    ready_for_release_score: { type: 'number', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    suggested_phase: {
      type: 'string',
      enum: [
        'publish_candidate',
        'crafting',
        'inspiration',
        'rights_review',
        'low_signal_fragment',
      ],
    },
    audience_tier: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
    rights_caution: {
      type: 'object',
      additionalProperties: false,
      properties: {
        flag: { type: 'boolean' },
        note: { type: 'string' },
      },
      required: ['flag', 'note'],
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    work_needed: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          area: { type: 'string' },
          issue: { type: 'string' },
          recommended_action: { type: 'string' },
          priority: { type: 'integer', minimum: 1, maximum: 5 },
        },
        required: ['area', 'issue', 'recommended_action', 'priority'],
      },
    },
    scores: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        SCORE_DIMENSIONS.map((dimension) => [dimension, scoreDetailSchema])
      ),
      required: SCORE_DIMENSIONS,
    },
    muse_analysis: {
      type: 'object',
      additionalProperties: false,
      properties: {
        primary: museRecommendationSchema,
        secondary: museRecommendationSchema,
        competing_muses: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', enum: MUSE_NAMES },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              rationale: { type: 'string' },
            },
            required: ['name', 'confidence', 'rationale'],
          },
        },
      },
      required: ['primary', 'secondary', 'competing_muses'],
    },
    story: {
      type: 'object',
      additionalProperties: false,
      properties: {
        core_theme: { type: 'string' },
        emotional_arc: { type: 'string' },
        narrative_clarity: { type: 'string' },
        point_of_view: { type: 'string' },
        strongest_story_moment: { type: 'string' },
        missing_story_element: { type: 'string' },
      },
      required: [
        'core_theme',
        'emotional_arc',
        'narrative_clarity',
        'point_of_view',
        'strongest_story_moment',
        'missing_story_element',
      ],
    },
    hook: {
      type: 'object',
      additionalProperties: false,
      properties: {
        hook_text: { type: 'string' },
        strength: { type: 'string' },
        memorability: { type: 'string' },
        commercial_potential: { type: 'string' },
        improvement: { type: 'string' },
      },
      required: [
        'hook_text',
        'strength',
        'memorability',
        'commercial_potential',
        'improvement',
      ],
    },
    lyrics: {
      type: 'object',
      additionalProperties: false,
      properties: {
        strongest_lines: { type: 'array', items: { type: 'string' } },
        weakest_lines: { type: 'array', items: { type: 'string' } },
        cliches_detected: { type: 'array', items: { type: 'string' } },
        rhymes_needing_work: { type: 'array', items: { type: 'string' } },
        repeated_phrases: { type: 'array', items: { type: 'string' } },
        rhyme_density: { type: 'string' },
        internal_rhyme_notes: { type: 'string' },
        alliteration_notes: { type: 'string' },
        metaphor_notes: { type: 'string' },
        reading_grade_level: { type: 'number', minimum: 0, maximum: 20 },
        singability_notes: { type: 'string' },
      },
      required: [
        'strongest_lines',
        'weakest_lines',
        'cliches_detected',
        'rhymes_needing_work',
        'repeated_phrases',
        'rhyme_density',
        'internal_rhyme_notes',
        'alliteration_notes',
        'metaphor_notes',
        'reading_grade_level',
        'singability_notes',
      ],
    },
    musical_suggestions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        tempo_feel: { type: 'string' },
        suggested_bpm_min: { type: 'integer', minimum: 40, maximum: 220 },
        suggested_bpm_max: { type: 'integer', minimum: 40, maximum: 220 },
        genre_fit: { type: 'array', items: { type: 'string' } },
        vocal_range_guidance: { type: 'string' },
        instrumentation_ideas: { type: 'array', items: { type: 'string' } },
        arrangement_arc: { type: 'string' },
        production_notes: { type: 'string' },
      },
      required: [
        'tempo_feel',
        'suggested_bpm_min',
        'suggested_bpm_max',
        'genre_fit',
        'vocal_range_guidance',
        'instrumentation_ideas',
        'arrangement_arc',
        'production_notes',
      ],
    },
    audience: {
      type: 'object',
      additionalProperties: false,
      properties: {
        likely_listeners: { type: 'array', items: { type: 'string' } },
        radio_potential: { type: 'string' },
        streaming_playlist_fit: { type: 'array', items: { type: 'string' } },
        sync_opportunities: { type: 'array', items: { type: 'string' } },
        audience_rank_score: { type: 'number', minimum: 0, maximum: 100 },
      },
      required: [
        'likely_listeners',
        'radio_potential',
        'streaming_playlist_fit',
        'sync_opportunities',
        'audience_rank_score',
      ],
    },
    similar_artists: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          artist: { type: 'string' },
          similarity: { type: 'number', minimum: 0, maximum: 100 },
          reason: { type: 'string' },
        },
        required: ['artist', 'similarity', 'reason'],
      },
    },
    rewrite_opportunities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: 'string' },
          issue: { type: 'string' },
          direction: { type: 'string' },
          example_strategy: { type: 'string' },
        },
        required: ['section', 'issue', 'direction', 'example_strategy'],
      },
    },
    muse_guidance: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          muse: { type: 'string', enum: MUSE_NAMES },
          message: { type: 'string' },
          priority: { type: 'integer', minimum: 1, maximum: 5 },
        },
        required: ['muse', 'message', 'priority'],
      },
    },
    metrics: {
      type: 'object',
      additionalProperties: false,
      properties: {
        estimated_song_length_seconds: {
          type: 'integer',
          minimum: 0,
          maximum: 1200,
        },
        chorus_repetition_analysis: { type: 'string' },
        word_count: { type: 'integer', minimum: 0 },
        unique_word_ratio: { type: 'number', minimum: 0, maximum: 1 },
        rhyme_density_score: { type: 'number', minimum: 0, maximum: 100 },
        internal_rhyme_score: { type: 'number', minimum: 0, maximum: 100 },
        alliteration_score: { type: 'number', minimum: 0, maximum: 100 },
        metaphor_score: { type: 'number', minimum: 0, maximum: 100 },
        singability_score: { type: 'number', minimum: 0, maximum: 100 },
        ai_confidence: { type: 'number', minimum: 0, maximum: 1 },
        muse_confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: [
        'estimated_song_length_seconds',
        'chorus_repetition_analysis',
        'word_count',
        'unique_word_ratio',
        'rhyme_density_score',
        'internal_rhyme_score',
        'alliteration_score',
        'metaphor_score',
        'singability_score',
        'ai_confidence',
        'muse_confidence',
      ],
    },
    emotional_curve: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 100 },
          description: { type: 'string' },
        },
        required: ['section', 'score', 'description'],
      },
    },
  },
  required: [
    'analysis_basis',
    'analysis_stage',
    'source_types',
    'material_completeness',
    'recommended_next_move',
    'lead_muse',
    'lead_muse_reason',
    'starter_question',
    'limitations',
    'overall_score',
    'ready_for_release_score',
    'summary',
    'suggested_phase',
    'audience_tier',
    'rights_caution',
    'strengths',
    'work_needed',
    'scores',
    'muse_analysis',
    'story',
    'hook',
    'lyrics',
    'musical_suggestions',
    'audience',
    'similar_artists',
    'rewrite_opportunities',
    'muse_guidance',
    'metrics',
    'emotional_curve',
  ],
} as const;

const SYSTEM_PROMPT = `You are the iDreamMusic Song Intelligence Engine.

Your job is to provide rigorous, compassionate, practical songwriter feedback. Do not flatter.
Do not rewrite the entire song. Identify focused opportunities the songwriter can choose to accept,
reject, or turn into development tasks.

The iDreamMusic Nine Muses are:
- Calliope — Story: narrative, character, journey, point of view.
- Clio — Roots: history, memory, heritage, place, lived experience.
- Erato — Love: intimacy, relationship, desire, vulnerability.
- Euterpe — Craft: musicality, lyric craft, structure, melody potential.
- Melpomene — Blues: sorrow, tragedy, tension, struggle, catharsis.
- Polyhymnia — Faith: sacred meaning, devotion, gratitude, spiritual searching.
- Terpsichore — Rhythm: movement, groove, dance, physical energy.
- Thalia — Play: humor, wit, joy, satire, lightness.
- Urania — Dream: wonder, imagination, future, mystery, transcendence.

Muse classifications are recommendations only. Select one primary and one different secondary Muse.
Supporting lines must be short excerpts from the supplied song text.

Important analytical rules:
1. Distinguish measured text properties from musical recommendations.
2. A transcript cannot establish actual BPM, melody, instrumentation, or vocal range.
   Give suggested tempo and vocal guidance, and state that limitation.
3. Similar artists are high-level stylistic comparisons only. Never recommend copying an artist.
4. Rights cautions are warnings for human review, not legal conclusions.
5. Scores must be internally consistent with the written rationale.
6. Use the full 0–100 scale honestly. A promising draft need not score like a release-ready master.
7. The Muse guidance should sound specific to each Muse's domain, not like generic advice.
8. When a transcript appears to repeat choruses, account for repetition rather than treating it as accidental.
9. Preserve the songwriter's voice. Recommend direction and strategy more often than replacement lines.
10. For a Spark, treat scores as provisional evidence of creative promise, not a verdict on a finished song.
11. recommended_next_move must be one concrete action the songwriter can take next.
12. lead_muse must match muse_analysis.primary.name. lead_muse_reason should briefly explain the fit.
13. starter_question must be a useful first question the songwriter can ask the lead Muse about this exact material.
14. Never invent missing lyrics, events, characters, melody, harmony, or production evidence.
15. When material is limited, use conditional language, lower confidence appropriately, and make the limitations explicit.
16. The CURRENT SAVED LYRICS from the canonical song version are authoritative for lyric wording, story details, hook language, rhyme, repetition, and line-level critique.
17. A recording transcript is secondary audio evidence. If it differs from the current saved lyrics, do not replace, correct, score, quote, or downgrade the current lyrics based on the transcript.
18. If the transcript comes from a different song version, treat audio-specific conclusions as potentially stale and state that limitation where relevant.`;

function extractOutputText(payload: OpenAIResponse): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const item of payload.output || []) {
    if (item.type !== 'message') continue;

    for (const content of item.content || []) {
      if (content.type === 'refusal' && content.refusal) {
        throw new Error(`OpenAI declined the analysis: ${content.refusal}`);
      }

      if (content.type === 'output_text' && content.text) {
        return content.text.trim();
      }
    }
  }

  return '';
}

function normalizeMuseName(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function findMuseId(
  museRows: Array<Record<string, unknown>>,
  requestedName: string
): string | null {
  const target = normalizeMuseName(requestedName);

  for (const row of museRows) {
    const candidates = [
      row.name,
      row.title,
      row.display_name,
      row.slug,
      row.key,
    ];

    if (
      candidates.some((candidate) => {
        const normalized = normalizeMuseName(candidate);
        return normalized === target || normalized.startsWith(target);
      })
    ) {
      return typeof row.id === 'string' ? row.id : null;
    }
  }

  return null;
}

async function markRunFailed(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  runId: string | null,
  message: string
) {
  if (!supabase || !runId) return;

  await supabase
    .from('ai_analysis_runs')
    .update({
      status: 'failed',
      error_message: message.slice(0, 4000),
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

type ResolvedSongMaterial = {
  song: {
    id: string;
    title_working: string | null;
    title_final: string | null;
    hook_line: string | null;
    summary: string | null;
    current_stage: string | null;
    song_origin: string | null;
  };
  version: {
    id: string;
    title: string | null;
    lyrics: string | null;
    arrangement_notes: string | null;
    story_behind_song: string | null;
    stage: string | null;
  } | null;
  transcript: {
    id: string;
    song_version_id: string | null;
    transcript_text: string | null;
    is_reviewed: boolean;
  } | null;
  notes: Array<{ title: string | null; body: string | null }>;
  attachments: Array<{
    title: string | null;
    file_type: string | null;
    mime_type: string | null;
  }>;
  title: string;
  savedLyrics: string;
  transcriptText: string;
  sourceTypes: string[];
  analysisBasis: SongIntelligenceResult['analysis_basis'];
  analysisStage: SongIntelligenceResult['analysis_stage'];
  materialCompleteness: SongIntelligenceResult['material_completeness'];
  transcriptVersionRelation: 'current_version' | 'different_version' | 'unlinked';
};

function normalizeAnalysisStage(value: unknown): SongIntelligenceResult['analysis_stage'] {
  return value === 'draft' || value === 'final' ? value : 'spark';
}

async function resolveSongMaterial(
  supabase: any,
  userId: string,
  songId: string,
  requestedTranscriptId?: string
): Promise<ResolvedSongMaterial> {
  const { data: song, error: songError } = await supabase
    .from('songs')
    .select(
      'id, owner_user_id, title_working, title_final, hook_line, summary, current_stage, song_origin'
    )
    .eq('id', songId)
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (songError || !song) {
    throw new Error(songError?.message || 'Song not found or not owned by you.');
  }

  let transcript: ResolvedSongMaterial['transcript'] = null;

  if (requestedTranscriptId) {
    const { data, error } = await supabase
      .from('song_transcripts')
      .select('id, song_version_id, transcript_text, is_reviewed, updated_at')
      .eq('id', requestedTranscriptId)
      .eq('song_id', songId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message || 'Saved transcript not found.');
    }

    transcript = data;
  } else {
    const { data, error } = await supabase
      .from('song_transcripts')
      .select('id, song_version_id, transcript_text, is_reviewed, updated_at')
      .eq('song_id', songId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Transcript lookup failed: ${error.message}`);
    }

    transcript = data || null;
  }

  // Always analyze the song's current canonical version. A transcript is audio
  // evidence and may be linked to an earlier recording/version; it must never
  // override newer saved lyrics simply because it has a song_version_id.
  const { data: currentVersion, error: versionError } = await supabase
    .from('song_versions')
    .select(
      'id, title, lyrics, arrangement_notes, story_behind_song, stage, version_number, is_stage_primary'
    )
    .eq('song_id', songId)
    .order('is_stage_primary', { ascending: false })
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    throw new Error(`Song version lookup failed: ${versionError.message}`);
  }

  const version = (currentVersion || null) as ResolvedSongMaterial['version'];

  const [{ data: notesData, error: notesError }, { data: attachmentData, error: attachmentError }] =
    await Promise.all([
      supabase
        .from('writer_notes')
        .select('title, body, created_at')
        .eq('song_id', songId)
        .order('created_at', { ascending: true }),
      supabase
        .from('attachments')
        .select('title, file_type, mime_type, created_at')
        .eq('song_id', songId)
        .order('created_at', { ascending: true }),
    ]);

  if (notesError) {
    throw new Error(`Writer-note lookup failed: ${notesError.message}`);
  }

  if (attachmentError) {
    throw new Error(`Attachment lookup failed: ${attachmentError.message}`);
  }

  const notes = (notesData || []) as ResolvedSongMaterial['notes'];
  const attachments = (attachmentData || []) as ResolvedSongMaterial['attachments'];
  const title = song.title_final || song.title_working || version?.title || 'Untitled song';
  const hasMeaningfulTitle = Boolean(
    title.trim() && !/^Untitled Spark\s*[—-]/i.test(title.trim())
  );
  const savedLyrics = String(version?.lyrics || '').trim();
  const transcriptText = String(transcript?.transcript_text || '').trim();
  const transcriptVersionRelation: ResolvedSongMaterial['transcriptVersionRelation'] =
    !transcript?.song_version_id
      ? 'unlinked'
      : transcript.song_version_id === version?.id
        ? 'current_version'
        : 'different_version';
  const sourceTypes = new Set<string>();

  if (hasMeaningfulTitle) sourceTypes.add('title');
  if (song.summary?.trim()) sourceTypes.add('summary');
  if (song.hook_line?.trim()) sourceTypes.add('hook');
  if (savedLyrics) sourceTypes.add('saved_lyrics');
  if (transcriptText) sourceTypes.add('transcript');
  if (transcriptText && transcriptVersionRelation === 'different_version') {
    sourceTypes.add('earlier_version_transcript');
  }
  if (version?.story_behind_song?.trim()) sourceTypes.add('story');
  const arrangementNotes = String(version?.arrangement_notes || '').trim();
  const meaningfulArrangementNotes =
    arrangementNotes &&
    arrangementNotes !== 'Captured in expanded Spark Capture.'
      ? arrangementNotes
      : '';

  if (meaningfulArrangementNotes) sourceTypes.add('arrangement_notes');
  if (notes.some((note) => String(note.body || '').trim())) sourceTypes.add('writer_notes');
  if (attachments.some((attachment) => attachment.file_type === 'audio')) sourceTypes.add('audio');
  if (attachments.some((attachment) => attachment.file_type !== 'audio')) sourceTypes.add('documents');

  const summaryText = String(song.summary || '').trim();
  const nonDuplicateSummary =
    summaryText && (!savedLyrics || !savedLyrics.startsWith(summaryText))
      ? summaryText
      : '';
  const capturedTextParts = [
    nonDuplicateSummary,
    song.hook_line,
    version?.story_behind_song,
    meaningfulArrangementNotes,
    ...notes.flatMap((note) => [note.title, note.body]),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const analysisStage = normalizeAnalysisStage(song.current_stage || version?.stage);
  const hasNonTranscriptText = Boolean(savedLyrics || capturedTextParts.length);

  const analysisBasis: SongIntelligenceResult['analysis_basis'] =
    analysisStage === 'spark'
      ? transcriptText
        ? hasNonTranscriptText
          ? 'mixed_material'
          : 'transcript_only'
        : 'captured_text'
      : savedLyrics && transcriptText
        ? capturedTextParts.length
          ? 'mixed_material'
          : 'lyrics_and_transcript'
        : savedLyrics
          ? capturedTextParts.length
            ? 'mixed_material'
            : 'lyrics_only'
          : transcriptText
            ? capturedTextParts.length
              ? 'mixed_material'
              : 'transcript_only'
            : 'captured_text';

  const attachmentContext = attachments
    .filter((attachment) => attachment.file_type !== 'audio')
    .map((attachment) => String(attachment.title || attachment.mime_type || '').trim())
    .filter(Boolean);
  const signalText = [
    hasMeaningfulTitle ? title : '',
    savedLyrics,
    transcriptText,
    ...capturedTextParts,
    ...attachmentContext,
  ]
    .join('\n')
    .trim();

  if (!signalText) {
    throw new Error('Add a title, a few words, a note, a document, or a recording before running Song Intelligence.');
  }

  const signalLength = signalText.length;
  const materialCompleteness: SongIntelligenceResult['material_completeness'] =
    signalLength < 160 ? 'limited' : signalLength < 1500 ? 'developing' : 'substantial';

  return {
    song,
    version,
    transcript,
    notes,
    attachments,
    title,
    savedLyrics,
    transcriptText,
    sourceTypes: [...sourceTypes],
    analysisBasis,
    analysisStage,
    materialCompleteness,
    transcriptVersionRelation,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { status: 'error', message: 'Supabase is not available.' },
        { status: 500 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'You must be signed in.' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const songId = url.searchParams.get('song_id') || '';
    const transcriptId = url.searchParams.get('transcript_id') || '';

    if (!songId) {
      return NextResponse.json(
        { status: 'error', message: 'Song is required.' },
        { status: 400 }
      );
    }

    const { data: ownedSong } = await supabase
      .from('songs')
      .select('id')
      .eq('id', songId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!ownedSong) {
      return NextResponse.json(
        { status: 'error', message: 'Song not found or not owned by you.' },
        { status: 404 }
      );
    }

    let query = supabase
      .from('ai_analysis_runs')
      .select('id, model_name, analysis_version, raw_result, completed_at, transcript_id')
      .eq('song_id', songId)
      .eq('status', 'ready');

    if (transcriptId) {
      query = query.eq('transcript_id', transcriptId);
    }

    const { data: run, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { status: 'error', message: `Analysis lookup failed: ${error.message}` },
        { status: 500 }
      );
    }

    if (!run) {
      return NextResponse.json(
        { status: 'empty', message: 'No saved analysis yet.' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Latest analysis loaded.',
      run_id: run.id,
      model_name: run.model_name,
      analysis_version: run.analysis_version,
      completed_at: run.completed_at,
      result: run.raw_result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Analysis lookup failed.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let runId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> = null;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { status: 'error', message: 'OPENAI_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { status: 'error', message: 'Supabase is not available.' },
        { status: 500 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'You must be signed in.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const songId = String(formData.get('song_id') || '');
    const transcriptId = String(formData.get('transcript_id') || '');

    if (!songId) {
      return NextResponse.json(
        { status: 'error', message: 'A song is required for analysis.' },
        { status: 400 }
      );
    }

    let material: ResolvedSongMaterial;

    try {
      material = await resolveSongMaterial(
        supabase,
        user.id,
        songId,
        transcriptId || undefined
      );
    } catch (error) {
      return NextResponse.json(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Song material could not be resolved.',
        },
        { status: 400 }
      );
    }

    const { data: createdRun, error: runError } = await supabase
      .from('ai_analysis_runs')
      .insert({
        song_id: songId,
        song_version_id: material.version?.id || null,
        transcript_id: material.transcript?.id || null,
        requested_by: user.id,
        model_name: MODEL_NAME,
        analysis_version: ANALYSIS_VERSION,
        status: 'analyzing',
      })
      .select('id')
      .single();

    if (runError || !createdRun) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Could not start analysis: ${runError?.message || 'No run returned.'}`,
        },
        { status: 500 }
      );
    }

    runId = createdRun.id;

    const noteText = material.notes
      .map((note, index) => {
        const title = String(note.title || '').trim() || `Note ${index + 1}`;
        const body = String(note.body || '').trim();
        return body ? `${title}\n${body}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    const documentNames = material.attachments
      .filter((attachment) => attachment.file_type !== 'audio')
      .map((attachment) => attachment.title || attachment.mime_type || 'Captured document')
      .join(', ');

    const userPrompt = `Analyze this song material for iDreamMusic Song Intelligence.

SONG METADATA
Title: ${material.title}
Current stage: ${material.analysisStage}
Origin: ${material.song.song_origin || 'unknown'}
Existing hook field: ${material.song.hook_line || 'not supplied'}
Existing summary: ${material.song.summary || 'not supplied'}
Transcript reviewed by songwriter: ${material.transcript?.is_reviewed ? 'yes' : 'no'}
Transcript/version relationship: ${material.transcriptVersionRelation}
Available basis: ${material.analysisBasis}
Source types: ${material.sourceTypes.join(', ') || 'title'}
Material completeness: ${material.materialCompleteness}

${material.savedLyrics ? `CURRENT SAVED LYRICS — AUTHORITATIVE\n${material.savedLyrics.slice(0, 50000)}\n` : ''}
${material.transcriptText ? `RECORDING TRANSCRIPT — SECONDARY AUDIO EVIDENCE\n${material.transcriptText.slice(0, 50000)}\n` : ''}
${material.version?.story_behind_song ? `STORY BEHIND THE SONG\n${material.version.story_behind_song.slice(0, 10000)}\n` : ''}
${material.version?.arrangement_notes && material.version.arrangement_notes !== 'Captured in expanded Spark Capture.' ? `ARRANGEMENT OR CAPTURE NOTES\n${material.version.arrangement_notes.slice(0, 10000)}\n` : ''}
${noteText ? `WRITER NOTES\n${noteText.slice(0, 30000)}\n` : ''}
${documentNames ? `ATTACHED DOCUMENTS\n${documentNames}\nDocument filenames are available, but their full contents were not extracted for this analysis.\n` : ''}

Return the complete structured analysis.
Set analysis_basis to ${material.analysisBasis}.
Set analysis_stage to ${material.analysisStage}.
Set source_types to exactly ${JSON.stringify(material.sourceTypes)}.
Set material_completeness to ${material.materialCompleteness}.
For Spark-stage material, describe ratings as provisional and developmental.
Treat BPM, vocal range, melody, arrangement, performance, and production as recommendations unless directly supported by supplied notes.
Use short excerpts only when citing strongest lines, weakest lines, or Muse evidence.
Choose one practical recommended_next_move.
If current saved lyrics are present, base all lyric-specific scoring, strongest/weakest lines, rhyme observations, repetition, hook wording, and story wording on those saved lyrics rather than the transcript.
If Transcript/version relationship is different_version, use the transcript only as secondary evidence from an earlier/different recording and include an appropriate limitation for audio-dependent observations.
Set lead_muse to the same Muse as muse_analysis.primary and generate one specific starter_question for that Muse.`;

    const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        store: false,
        reasoning: {
          effort: 'low',
        },
        max_output_tokens: 6500,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: SYSTEM_PROMPT,
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: userPrompt,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'idreammusic_song_intelligence',
            strict: true,
            schema: songIntelligenceSchema,
          },
        },
      }),
    });

    const responseText = await openAIResponse.text();
    let openAIPayload: OpenAIResponse = {};

    try {
      openAIPayload = JSON.parse(responseText) as OpenAIResponse;
    } catch {
      // The raw response is included in the error below.
    }

    if (!openAIResponse.ok) {
      const message =
        openAIPayload.error?.message ||
        responseText ||
        `OpenAI returned status ${openAIResponse.status}.`;

      await markRunFailed(supabase, runId, message);

      return NextResponse.json(
        { status: 'error', message: `OpenAI analysis failed: ${message}` },
        { status: openAIResponse.status }
      );
    }

    const outputText = extractOutputText(openAIPayload);
    if (!outputText) {
      const message =
        openAIPayload.incomplete_details?.reason ||
        'OpenAI returned no structured analysis text.';

      await markRunFailed(supabase, runId, message);

      return NextResponse.json(
        { status: 'error', message },
        { status: 502 }
      );
    }

    let result: SongIntelligenceResult;
    try {
      result = JSON.parse(outputText) as SongIntelligenceResult;
    } catch (error) {
      const message =
        error instanceof Error
          ? `Could not parse structured analysis: ${error.message}`
          : 'Could not parse structured analysis.';

      await markRunFailed(supabase, runId, message);

      return NextResponse.json(
        { status: 'error', message },
        { status: 502 }
      );
    }

    result.analysis_basis = material.analysisBasis;
    result.analysis_stage = material.analysisStage;
    result.source_types = material.sourceTypes;
    result.material_completeness = material.materialCompleteness;
    result.lead_muse = result.muse_analysis.primary.name;
    result.lead_muse_reason = String(
      result.lead_muse_reason || result.muse_analysis.primary.rationale
    )
      .trim()
      .slice(0, 800);
    result.recommended_next_move = String(
      result.recommended_next_move ||
        result.work_needed[0]?.recommended_action ||
        'Choose one promising direction and add the next piece of the song.'
    )
      .trim()
      .slice(0, 600);
    result.starter_question = String(
      result.starter_question ||
        `Based on this ${material.analysisStage} and its Song Intelligence, what is the most promising direction, and what should I develop next?`
    )
      .trim()
      .slice(0, 900);

    const scoreRows = SCORE_DIMENSIONS.map((dimension) => ({
      analysis_run_id: runId,
      song_id: songId,
      dimension,
      score: result.scores[dimension].score,
      rationale: result.scores[dimension].rationale,
      confidence: result.scores[dimension].confidence,
    }));

    const { error: scoreError } = await supabase
      .from('ai_analysis_scores')
      .insert(scoreRows);

    if (scoreError) {
      const message = `Score save failed: ${scoreError.message}`;
      await markRunFailed(supabase, runId, message);

      return NextResponse.json(
        { status: 'error', message },
        { status: 500 }
      );
    }

    const { data: museRowsData, error: museLookupError } = await supabase
      .from('muses')
      .select('*');

    const museRows = (museRowsData || []) as Array<Record<string, unknown>>;

    if (museLookupError) {
      const message = `Muse lookup failed: ${museLookupError.message}`;
      await markRunFailed(supabase, runId, message);

      return NextResponse.json(
        { status: 'error', message },
        { status: 500 }
      );
    }

    const museRecommendationRows = [
      {
        analysis_run_id: runId,
        song_id: songId,
        muse_id: findMuseId(museRows, result.muse_analysis.primary.name),
        assignment_role: 'primary',
        confidence: result.muse_analysis.primary.confidence,
        rationale: result.muse_analysis.primary.rationale,
      },
      {
        analysis_run_id: runId,
        song_id: songId,
        muse_id: findMuseId(museRows, result.muse_analysis.secondary.name),
        assignment_role: 'secondary',
        confidence: result.muse_analysis.secondary.confidence,
        rationale: result.muse_analysis.secondary.rationale,
      },
    ];

    const { error: museSaveError } = await supabase
      .from('ai_muse_recommendations')
      .insert(museRecommendationRows);

    if (museSaveError) {
      const message = `Muse recommendation save failed: ${museSaveError.message}`;
      await markRunFailed(supabase, runId, message);

      return NextResponse.json(
        { status: 'error', message },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    const { error: runUpdateError } = await supabase
      .from('ai_analysis_runs')
      .update({
        status: 'ready',
        audience_rank_score: result.audience.audience_rank_score,
        audience_tier: result.audience_tier,
        suggested_phase: result.suggested_phase,
        rights_caution_flag: result.rights_caution.flag,
        rights_caution_note: result.rights_caution.note || null,
        strengths: result.strengths,
        work_needed: result.work_needed,
        summary: result.summary,
        raw_result: result,
        error_message: null,
        completed_at: now,
      })
      .eq('id', runId)
      .eq('song_id', songId);

    if (runUpdateError) {
      const message = `Analysis run save failed: ${runUpdateError.message}`;
      await markRunFailed(supabase, runId, message);

      return NextResponse.json(
        { status: 'error', message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Song Intelligence generated and saved.',
      run_id: runId,
      model_name: MODEL_NAME,
      analysis_version: ANALYSIS_VERSION,
      completed_at: now,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Song Intelligence failed.';

    await markRunFailed(supabase, runId, message);

    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    );
  }
}
