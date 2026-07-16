import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const TASK_STATUSES = [
  'open',
  'in_progress',
  'completed',
  'dismissed',
] as const;

type TaskStatus = (typeof TASK_STATUSES)[number];

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

async function verifySongOwnership(
  supabase: NonNullable<
    Awaited<ReturnType<typeof createServerSupabaseClient>>
  >,
  songId: string,
  userId: string
) {
  const { data: song, error } = await supabase
    .from('songs')
    .select('id')
    .eq('id', songId)
    .eq('owner_user_id', userId)
    .maybeSingle();

  return {
    owned: Boolean(song) && !error,
    message: error?.message || 'Song not found or not owned by you.',
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

    if (!songId) {
      return NextResponse.json(
        { status: 'error', message: 'A song is required.' },
        { status: 400 }
      );
    }

    const ownership = await verifySongOwnership(supabase, songId, user.id);
    if (!ownership.owned) {
      return NextResponse.json(
        { status: 'error', message: ownership.message },
        { status: 404 }
      );
    }

    const { data: taskRows, error: taskError } = await supabase
      .from('song_tasks')
      .select(
        'id, song_id, song_version_id, analysis_run_id, title, description, status, priority, sort_order, due_date, completed_at, created_at, updated_at'
      )
      .eq('song_id', songId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (taskError) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Song task lookup failed: ${taskError.message}`,
        },
        { status: 500 }
      );
    }

    const analysisRunIds = Array.from(
      new Set(
        (taskRows || [])
          .map((task) => task.analysis_run_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const analysisById = new Map<
      string,
      {
        model_name: string | null;
        analysis_version: string | null;
        completed_at: string | null;
      }
    >();

    if (analysisRunIds.length > 0) {
      const { data: analysisRows, error: analysisError } = await supabase
        .from('ai_analysis_runs')
        .select('id, model_name, analysis_version, completed_at')
        .eq('song_id', songId)
        .in('id', analysisRunIds);

      if (analysisError) {
        return NextResponse.json(
          {
            status: 'error',
            message: `Analysis task-link lookup failed: ${analysisError.message}`,
          },
          { status: 500 }
        );
      }

      for (const analysis of analysisRows || []) {
        analysisById.set(analysis.id, {
          model_name: analysis.model_name,
          analysis_version: analysis.analysis_version,
          completed_at: analysis.completed_at,
        });
      }
    }

    const tasks = (taskRows || []).map((task) => ({
      ...task,
      analysis: task.analysis_run_id
        ? analysisById.get(task.analysis_run_id) || null
        : null,
    }));

    return NextResponse.json({
      status: 'success',
      message: 'Song tasks loaded.',
      tasks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Song task lookup failed.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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

    const formData = await request.formData();
    const songId = String(formData.get('song_id') || '');
    const taskId = String(formData.get('task_id') || '');
    const statusValue = String(formData.get('status') || '');

    if (!songId || !taskId) {
      return NextResponse.json(
        { status: 'error', message: 'Song and task are required.' },
        { status: 400 }
      );
    }

    if (!isTaskStatus(statusValue)) {
      return NextResponse.json(
        { status: 'error', message: 'The requested task status is invalid.' },
        { status: 400 }
      );
    }

    const ownership = await verifySongOwnership(supabase, songId, user.id);
    if (!ownership.owned) {
      return NextResponse.json(
        { status: 'error', message: ownership.message },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const { data: updatedTask, error: updateError } = await supabase
      .from('song_tasks')
      .update({
        status: statusValue,
        completed_at: statusValue === 'completed' ? now : null,
        updated_at: now,
      })
      .eq('id', taskId)
      .eq('song_id', songId)
      .select(
        'id, song_id, song_version_id, analysis_run_id, title, description, status, priority, sort_order, due_date, completed_at, created_at, updated_at'
      )
      .maybeSingle();

    if (updateError || !updatedTask) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            updateError?.message || 'Song task was not found or could not be updated.',
        },
        { status: 500 }
      );
    }

    let analysis: {
      model_name: string | null;
      analysis_version: string | null;
      completed_at: string | null;
    } | null = null;

    if (updatedTask.analysis_run_id) {
      const { data: analysisRow } = await supabase
        .from('ai_analysis_runs')
        .select('model_name, analysis_version, completed_at')
        .eq('id', updatedTask.analysis_run_id)
        .eq('song_id', songId)
        .maybeSingle();

      analysis = analysisRow || null;
    }

    return NextResponse.json({
      status: 'success',
      message:
        statusValue === 'completed'
          ? 'Song task completed.'
          : statusValue === 'in_progress'
            ? 'Song task moved to In Progress.'
            : statusValue === 'dismissed'
              ? 'Song task dismissed.'
              : 'Song task reopened.',
      task: {
        ...updatedTask,
        analysis,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Song task update failed.',
      },
      { status: 500 }
    );
  }
}
