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