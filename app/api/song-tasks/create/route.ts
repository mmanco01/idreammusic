import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
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
    const songVersionId = String(formData.get('song_version_id') || '');
    const analysisRunId = String(formData.get('analysis_run_id') || '');
    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const priorityValue = Number(formData.get('priority') || 3);
    const priority = Number.isFinite(priorityValue)
      ? Math.min(5, Math.max(1, Math.round(priorityValue)))
      : 3;

    if (!songId) {
      return NextResponse.json(
        { status: 'error', message: 'A song is required.' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { status: 'error', message: 'A task title is required.' },
        { status: 400 }
      );
    }

    if (title.length > 240) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'The task title must be 240 characters or fewer.',
        },
        { status: 400 }
      );
    }

    const { data: ownedSong, error: ownedSongError } = await supabase
      .from('songs')
      .select('id')
      .eq('id', songId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (ownedSongError || !ownedSong) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            ownedSongError?.message || 'Song not found or not owned by you.',
        },
        { status: 404 }
      );
    }

    if (songVersionId) {
      const { data: version, error: versionError } = await supabase
        .from('song_versions')
        .select('id')
        .eq('id', songVersionId)
        .eq('song_id', songId)
        .maybeSingle();

      if (versionError || !version) {
        return NextResponse.json(
          {
            status: 'error',
            message:
              versionError?.message || 'Song version was not found for this song.',
          },
          { status: 400 }
        );
      }
    }

    if (analysisRunId) {
      const { data: analysisRun, error: analysisRunError } = await supabase
        .from('ai_analysis_runs')
        .select('id')
        .eq('id', analysisRunId)
        .eq('song_id', songId)
        .maybeSingle();

      if (analysisRunError || !analysisRun) {
        return NextResponse.json(
          {
            status: 'error',
            message:
              analysisRunError?.message ||
              'Analysis run was not found for this song.',
          },
          { status: 400 }
        );
      }
    }

    let existingTaskQuery = supabase
      .from('song_tasks')
      .select('id')
      .eq('song_id', songId)
      .eq('title', title);

    existingTaskQuery = analysisRunId
      ? existingTaskQuery.eq('analysis_run_id', analysisRunId)
      : existingTaskQuery.is('analysis_run_id', null);

    const { data: existingTask, error: existingTaskError } =
      await existingTaskQuery.limit(1).maybeSingle();

    if (existingTaskError) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Task duplicate check failed: ${existingTaskError.message}`,
        },
        { status: 500 }
      );
    }

    if (existingTask) {
      return NextResponse.json({
        status: 'success',
        message: 'This song task already exists.',
        task_id: existingTask.id,
        already_existed: true,
      });
    }

    const now = new Date().toISOString();

    const { data: task, error: taskError } = await supabase
      .from('song_tasks')
      .insert({
        song_id: songId,
        song_version_id: songVersionId || null,
        analysis_run_id: analysisRunId || null,
        title,
        description: description || null,
        status: 'open',
        priority,
        sort_order: 0,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Task creation failed: ${
            taskError?.message || 'No task was returned.'
          }`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Song task created and saved.',
      task_id: task.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Song task creation failed.',
      },
      { status: 500 }
    );
  }
}
