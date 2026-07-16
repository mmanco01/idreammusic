'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function saveSongEdits(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not available.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const slug = String(formData.get('slug') || '');
  const songId = String(formData.get('song_id') || '');
  const versionId = String(formData.get('version_id') || '');
  const writerNoteId = String(formData.get('writer_note_id') || '');

  const currentStage = String(formData.get('current_stage') || 'spark');
  const status = String(formData.get('status') || 'private');
  const songOrigin = String(formData.get('song_origin') || 'other');

  const titleWorking = String(formData.get('title_working') || '');
  const titleFinal = String(formData.get('title_final') || '');
  const hookLine = String(formData.get('hook_line') || '');
  const summary = String(formData.get('summary') || '');

  const versionStage = String(formData.get('version_stage') || 'spark');
  const versionTitle = String(formData.get('version_title') || '');
  const lyrics = String(formData.get('lyrics') || '');
  const arrangementNotes = String(formData.get('arrangement_notes') || '');
  const storyBehindSong = String(formData.get('story_behind_song') || '');

  const noteTitle = String(formData.get('note_title') || '');
  const noteBody = String(formData.get('note_body') || '');
  const noteVisibility = String(formData.get('note_visibility') || 'private');

  const { data: ownedSong, error: ownedSongError } = await supabase
    .from('songs')
    .select('id, owner_user_id')
    .eq('id', songId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (ownedSongError || !ownedSong) {
    throw new Error('Song not found or not owned by you.');
  }

  const { error: songUpdateError } = await supabase
    .from('songs')
    .update({
      title_working: titleWorking || null,
      title_final: titleFinal || null,
      hook_line: hookLine || null,
      summary: summary || null,
      current_stage: currentStage,
      status,
      song_origin: songOrigin,
      updated_at: new Date().toISOString(),
    })
    .eq('id', songId)
    .eq('owner_user_id', user.id);

  if (songUpdateError) {
    throw new Error(`Song update failed: ${songUpdateError.message}`);
  }

  if (versionId) {
    const { error: versionUpdateError } = await supabase
      .from('song_versions')
      .update({
        stage: versionStage,
        title: versionTitle || null,
        lyrics: lyrics || null,
        arrangement_notes: arrangementNotes || null,
        story_behind_song: storyBehindSong || null,
      })
      .eq('id', versionId)
      .eq('song_id', songId);

    if (versionUpdateError) {
      throw new Error(`Version update failed: ${versionUpdateError.message}`);
    }
  }

  if (writerNoteId) {
    const { error: noteUpdateError } = await supabase
      .from('writer_notes')
      .update({
        title: noteTitle || null,
        body: noteBody || null,
        visibility: noteVisibility,
      })
      .eq('id', writerNoteId)
      .eq('song_id', songId);

    if (noteUpdateError) {
      throw new Error(`Writer note update failed: ${noteUpdateError.message}`);
    }
  } else if (noteTitle || noteBody) {
    const { error: noteInsertError } = await supabase
      .from('writer_notes')
      .insert({
        song_id: songId,
        author_user_id: user.id,
        title: noteTitle || null,
        body: noteBody || null,
        visibility: noteVisibility,
        note_type: 'process',
      });

    if (noteInsertError) {
      throw new Error(`Writer note insert failed: ${noteInsertError.message}`);
    }
  }

  revalidatePath(`/songs/${slug}`);
  revalidatePath('/songs');
  revalidatePath('/listen');
  revalidatePath('/studio');
  revalidatePath(`/studio/songs/${slug}/edit`);

  redirect(`/songs/${slug}`);
}
export type TranscriptSaveState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export async function saveSongTranscript(
  _previousState: TranscriptSaveState,
  formData: FormData
): Promise<TranscriptSaveState> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { status: 'error', message: 'Supabase is not available.' };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { status: 'error', message: 'You must be signed in.' };
    }

    const slug = String(formData.get('slug') || '');
    const songId = String(formData.get('song_id') || '');
    const attachmentId = String(formData.get('attachment_id') || '');
    const songVersionId = String(formData.get('song_version_id') || '');
    const transcriptId = String(formData.get('transcript_id') || '');
    const transcriptText = String(formData.get('transcript_text') || '').trim();
    const isReviewed = formData.get('is_reviewed') === 'on';

    if (!songId || !attachmentId) {
      return { status: 'error', message: 'A song and audio attachment are required.' };
    }

    if (!transcriptText) {
      return { status: 'error', message: 'Enter or paste a transcript before saving.' };
    }

    const { data: ownedSong, error: ownedSongError } = await supabase
      .from('songs')
      .select('id')
      .eq('id', songId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (ownedSongError || !ownedSong) {
      return {
        status: 'error',
        message: ownedSongError?.message || 'Song not found or not owned by you.',
      };
    }

    const { data: attachment, error: attachmentError } = await supabase
      .from('attachments')
      .select('id, song_id, song_version_id, file_type')
      .eq('id', attachmentId)
      .eq('song_id', songId)
      .eq('file_type', 'audio')
      .maybeSingle();

    if (attachmentError || !attachment) {
      return {
        status: 'error',
        message: attachmentError?.message || 'Audio attachment not found for this song.',
      };
    }

    const now = new Date().toISOString();
    const transcriptPayload = {
      song_id: songId,
      song_version_id: songVersionId || attachment.song_version_id || null,
      attachment_id: attachmentId,
      transcript_text: transcriptText,
      transcript_source: 'manual',
      language_code: 'en',
      is_reviewed: isReviewed,
      reviewed_at: isReviewed ? now : null,
      reviewed_by: isReviewed ? user.id : null,
      created_by: user.id,
      updated_at: now,
    };

    if (transcriptId) {
      const { error } = await supabase
        .from('song_transcripts')
        .update({
          transcript_text: transcriptPayload.transcript_text,
          transcript_source: transcriptPayload.transcript_source,
          language_code: transcriptPayload.language_code,
          is_reviewed: transcriptPayload.is_reviewed,
          reviewed_at: transcriptPayload.reviewed_at,
          reviewed_by: transcriptPayload.reviewed_by,
          updated_at: transcriptPayload.updated_at,
        })
        .eq('id', transcriptId)
        .eq('song_id', songId);

      if (error) {
        return { status: 'error', message: `Transcript update failed: ${error.message}` };
      }
    } else {
      const { error } = await supabase.from('song_transcripts').insert(transcriptPayload);

      if (error) {
        return { status: 'error', message: `Transcript insert failed: ${error.message}` };
      }
    }

    revalidatePath(`/studio/songs/${slug}/edit`);
    revalidatePath('/studio');

    return { status: 'success', message: 'Transcript saved successfully.' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Transcript save failed.',
    };
  }
}
