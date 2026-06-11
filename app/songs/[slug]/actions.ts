'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function submitSongResponse(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error('Supabase client is not available.');

  const song_id = String(formData.get('song_id') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const author_name = String(formData.get('author_name') || '').trim();
  const excerpt = String(formData.get('excerpt') || '').trim();

  if (!song_id) throw new Error('Missing song id.');
  if (!excerpt) throw new Error('Response is required.');

  const { error } = await supabase.from('blog_posts').insert({
    song_id,
    title: title || 'Listener response',
    excerpt,
    approval_status: 'pending',
    post_type: 'listener_response',
    author_name: author_name || null,
  });

  if (error) {
    console.error('submitSongResponse error', error);
    throw new Error(error.message);
  }

  revalidatePath('/songs/[slug]', 'page');
}