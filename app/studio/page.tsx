import Link from 'next/link';
import { getServerAuthContext } from '@/lib/auth';
import { getMySongs } from '@/lib/data';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import StudioPortfolio, {
  type StudioPortfolioSong,
} from '@/components/studio/StudioPortfolio';

type VersionRow = {
  song_id: string;
  stage: string | null;
};

type WorkflowRow = {
  song_id: string;
  priority_tier: 'now' | 'next' | 'later' | 'someday' | 'archive';
  priority_rank: number | null;
  workflow_status: 'unreviewed' | 'active' | 'waiting' | 'completed' | 'archived';
  next_action: string | null;
  target_date: string | null;
};

type AnalysisRow = {
  song_id: string;
  raw_result: unknown;
  completed_at: string | null;
  created_at: string;
};

type TaskRow = {
  song_id: string;
  status: 'open' | 'in_progress' | 'completed' | 'dismissed';
};

function readNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? candidate
    : null;
}

function normalizeStudioSong(
  song: Awaited<ReturnType<typeof getMySongs>>[number]
) {
  return {
    id: song.id,
    slug: song.slug,
    title: song.title || 'Untitled song',
    summary: song.summary ?? null,
    audio_url: song.audio_url ?? null,
    current_stage: song.current_stage || 'spark',
    muse_slug: song.muse_slug ?? null,
  };
}

async function buildStudioPortfolio(
  userId: string,
  mySongs: Awaited<ReturnType<typeof getMySongs>>
): Promise<StudioPortfolioSong[]> {
  if (!mySongs.length) {
    return [];
  }

  const songIds = mySongs.map((song) => song.id);
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return mySongs.map((song) => ({
      ...normalizeStudioSong(song),
      version_count: 0,
      final_version_count: 0,
      all_versions_final: false,
      is_finished: false,
      priority_tier: 'later',
      priority_rank: null,
      workflow_status: 'active',
      next_action: null,
      target_date: null,
      ai_overall_score: null,
      ai_ready_for_release_score: null,
      ai_completed_at: null,
      open_task_count: 0,
      in_progress_task_count: 0,
    }));
  }

  const [versionsResult, workflowResult, analysisResult, tasksResult] =
    await Promise.all([
      supabase
        .from('song_versions')
        .select('song_id, stage')
        .in('song_id', songIds),
      supabase
        .from('song_workflow')
        .select(
          'song_id, priority_tier, priority_rank, workflow_status, next_action, target_date'
        )
        .eq('user_id', userId)
        .in('song_id', songIds),
      supabase
        .from('ai_analysis_runs')
        .select('song_id, raw_result, completed_at, created_at')
        .eq('status', 'ready')
        .in('song_id', songIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('song_tasks')
        .select('song_id, status')
        .in('song_id', songIds),
    ]);

  if (versionsResult.error) {
    console.error('Studio version summary failed:', versionsResult.error.message);
  }
  if (workflowResult.error) {
    console.error('Studio workflow summary failed:', workflowResult.error.message);
  }
  if (analysisResult.error) {
    console.error('Studio AI summary failed:', analysisResult.error.message);
  }
  if (tasksResult.error) {
    console.error('Studio task summary failed:', tasksResult.error.message);
  }

  const versions = (versionsResult.data || []) as VersionRow[];
  const workflows = (workflowResult.data || []) as WorkflowRow[];
  const analyses = (analysisResult.data || []) as AnalysisRow[];
  const tasks = (tasksResult.data || []) as TaskRow[];

  const versionSummary = new Map<
    string,
    { total: number; final: number }
  >();

  for (const version of versions) {
    const current = versionSummary.get(version.song_id) || {
      total: 0,
      final: 0,
    };

    current.total += 1;
    if (String(version.stage || '').toLowerCase() === 'final') {
      current.final += 1;
    }

    versionSummary.set(version.song_id, current);
  }

  const workflowBySong = new Map(
    workflows.map((workflow) => [workflow.song_id, workflow])
  );

  const latestAnalysisBySong = new Map<string, AnalysisRow>();
  for (const analysis of analyses) {
    if (!latestAnalysisBySong.has(analysis.song_id)) {
      latestAnalysisBySong.set(analysis.song_id, analysis);
    }
  }

  const taskSummary = new Map<
    string,
    { open: number; inProgress: number }
  >();

  for (const task of tasks) {
    const current = taskSummary.get(task.song_id) || {
      open: 0,
      inProgress: 0,
    };

    if (task.status === 'open') {
      current.open += 1;
    } else if (task.status === 'in_progress') {
      current.inProgress += 1;
    }

    taskSummary.set(task.song_id, current);
  }

  return mySongs.map((song) => {
    const version = versionSummary.get(song.id) || { total: 0, final: 0 };
    const workflow = workflowBySong.get(song.id);
    const latestAnalysis = latestAnalysisBySong.get(song.id);
    const task = taskSummary.get(song.id) || { open: 0, inProgress: 0 };

    const allVersionsFinal =
      version.total > 0 && version.final === version.total;

    const workflowStatus = workflow?.workflow_status || 'active';
    const isFinished =
      allVersionsFinal ||
      workflowStatus === 'completed' ||
      workflowStatus === 'archived';

    return {
      ...normalizeStudioSong(song),
      version_count: version.total,
      final_version_count: version.final,
      all_versions_final: allVersionsFinal,
      is_finished: isFinished,
      priority_tier: workflow?.priority_tier || 'later',
      priority_rank: workflow?.priority_rank ?? null,
      workflow_status: workflowStatus,
      next_action: workflow?.next_action || null,
      target_date: workflow?.target_date || null,
      ai_overall_score: latestAnalysis
        ? readNumber(latestAnalysis.raw_result, 'overall_score')
        : null,
      ai_ready_for_release_score: latestAnalysis
        ? readNumber(latestAnalysis.raw_result, 'ready_for_release_score')
        : null,
      ai_completed_at: latestAnalysis?.completed_at || null,
      open_task_count: task.open,
      in_progress_task_count: task.inProgress,
    };
  });
}

export default async function StudioPage() {
  const { user, profile } = await getServerAuthContext();
  const mySongs = user ? await getMySongs(user.id) : [];
  const portfolioSongs = user
    ? await buildStudioPortfolio(user.id, mySongs)
    : [];

  return (
    <section className="section">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Creator Studio</div>
            <h1 className="h2">Song Portfolio Command Center</h1>
            <p className="copy" style={{ maxWidth: 820 }}>
              Capture ideas, prioritize the songs that matter now, work AI
              recommendations into tasks, track versions, and move completed
              songs out of the active pipeline without losing their history.
            </p>
          </div>

          {!user ? (
            <Link className="button primary" href="/auth/sign-in?next=/studio">
              Sign in to upload
            </Link>
          ) : (
            <Link className="button primary" href="/studio/capture">
              New song or recording
            </Link>
          )}
        </div>

        <div className="stage-grid">
          <div className="stage-card">
            <h3 className="h3">Capture</h3>
            <p className="copy">
              Upload a spark, draft, final cut, lyric sheet, or voice memo and
              attach it to the right Muse.
            </p>
            <Link className="button" href="/studio/capture">
              New upload
            </Link>
          </div>

          <div className="stage-card">
            <h3 className="h3">Develop</h3>
            <p className="copy">
              Generate transcripts and Song Intelligence, create development
              tasks, and move songs through Now, Next, and Later.
            </p>
          </div>

          <div className="stage-card">
            <h3 className="h3">Release</h3>
            <p className="copy">
              Identify strong release candidates, finish the remaining tasks,
              and keep completed songs out of the daily working view.
            </p>
            <Link className="button" href="/admin/review">
              Review queue
            </Link>
          </div>
        </div>

        {user ? (
          <div className="card">
            <div className="eyebrow">Signed in as</div>
            <h2 className="h3">{profile?.display_name || user.email}</h2>
            <p className="copy">
              Your active catalog, priorities, AI ratings, versions, and
              development workload.
            </p>

            {portfolioSongs.length ? (
              <StudioPortfolio initialSongs={portfolioSongs} />
            ) : (
              <p className="copy" style={{ marginTop: '1rem' }}>
                You have not uploaded a song yet. Start at the capture page or
                any Muse page.
              </p>
            )}
          </div>
        ) : (
          <div className="card">
            <h2 className="h3">Not signed in yet</h2>
            <p className="copy">
              Sign in first, then use the Muse pages as direct upload entry
              points for your songs.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
