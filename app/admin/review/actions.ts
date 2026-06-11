"use server";

import { revalidatePath } from 'next/cache';
import { getServerAuthContext } from '@/lib/auth';

async function updateApproval(postId: string, status: 'approved' | 'rejected') {
  const { supabase, profile } = await getServerAuthContext();
  if (!supabase || !profile || !['owner', 'manager'].includes(profile.role)) {
    throw new Error('Only owners and managers can moderate public blog posts.');
  }

  const now = new Date().toISOString();

  const payload =
    status === 'approved'
      ? {
          approval_status: 'approved',
          approved_by: profile.id,
          approved_at: now,
          published_at: now
        }
      : {
          approval_status: 'rejected',
          approved_by: profile.id,
          approved_at: now
        };

  const { error } = await supabase.from('blog_posts').update(payload).eq('id', postId);

  if (error) throw error;

  revalidatePath('/admin/review');
}

export async function approveBlogPost(formData: FormData) {
  const postId = String(formData.get('postId') || '');
  if (!postId) throw new Error('Missing blog post id.');
  await updateApproval(postId, 'approved');
}

export async function rejectBlogPost(formData: FormData) {
  const postId = String(formData.get('postId') || '');
  if (!postId) throw new Error('Missing blog post id.');
  await updateApproval(postId, 'rejected');
}
