'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function requireOwnerOrManager() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not available.');
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('app_role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['owner', 'manager'].includes(profile.app_role)) {
    throw new Error('You do not have permission to moderate responses.');
  }

  return supabase;
}

export async function approveBlogPost(formData: FormData) {
  const postId = String(formData.get('postId') ?? '').trim();
  if (!postId) throw new Error('Missing post id.');

  const supabase = await requireOwnerOrManager();

  const { error } = await supabase
    .from('blog_posts')
    .update({ approval_status: 'approved', published_at: new Date().toISOString() })
    .eq('id', postId);

  if (error) {
    console.error('approveBlogPost error', error);
    throw new Error('Could not approve the response.');
  }

  revalidatePath('/studio/moderation');
  revalidatePath('/songs');
}

export async function rejectBlogPost(formData: FormData) {
  const postId = String(formData.get('postId') ?? '').trim();
  if (!postId) throw new Error('Missing post id.');

  const supabase = await requireOwnerOrManager();

  const { error } = await supabase
    .from('blog_posts')
    .update({ approval_status: 'rejected' })
    .eq('id', postId);

  if (error) {
    console.error('rejectBlogPost error', error);
    throw new Error('Could not reject the response.');
  }

  revalidatePath('/studio/moderation');
}
