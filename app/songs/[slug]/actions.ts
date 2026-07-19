'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

export async function submitSongResponse(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase is not available.');
  }

  const songId = cleanText(formData.get('song_id'), 100);
  const submittedTitle = cleanText(formData.get('title'), 200);
  const submittedAuthorName = cleanText(
    formData.get('author_name'),
    150,
  );
  const responseText = cleanText(formData.get('excerpt'), 10000);

  if (!songId) {
    throw new Error('A song is required.');
  }

  if (!responseText) {
    throw new Error('Please enter a response before submitting.');
  }

  /*
   * A visitor may or may not be logged in.
   * Do not reject the response when no user session exists.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const metadataName =
    typeof user?.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : typeof user?.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : typeof user?.user_metadata?.name === 'string'
          ? user.user_metadata.name
          : '';

  const emailName = user?.email
    ? user.email.split('@')[0]
    : '';

  const authorName =
    submittedAuthorName ||
    metadataName ||
    emailName ||
    'Anonymous listener';

  const title = submittedTitle || 'Listener response';

  const responseSlug = `listener-response-${Date.now()}-${randomUUID().slice(
    0,
    8,
  )}`;

  /*
   * Look up the song slug so the correct public song page can
   * be refreshed after submission.
   */
  const { data: song } = await (supabase as any)
    .from('public_song_cards')
    .select('id, slug')
    .eq('id', songId)
    .maybeSingle();

  const { error: insertError } = await (supabase as any)
    .from('blog_posts')
    .insert({
      song_id: songId,

      /*
       * Store the real user ID when signed in.
       * Store null for an anonymous visitor.
       */
      author_user_id: user?.id ?? null,

      author_name: authorName,
      author_email: user?.email ?? null,

      title,
      slug: responseSlug,

      /*
       * Both are populated because body is required in your table,
       * while the song page displays excerpt.
       */
      excerpt: responseText,
      body: responseText,

      post_type: 'listener_response',
      approval_status: 'pending',

      published_at: null,
      approved_at: null,
      approved_by: null,
    });

  if (insertError) {
    console.error('submitSongResponse error', insertError);

    throw new Error(insertError.message);
  }

  if (song?.slug) {
    revalidatePath(`/songs/${song.slug}`);
  }

  revalidatePath('/songs');
  revalidatePath('/listen');
  revalidatePath('/studio');
}
