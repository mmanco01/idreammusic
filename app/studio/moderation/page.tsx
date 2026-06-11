import { redirect } from 'next/navigation';
import { getPendingBlogPosts } from '@/lib/data';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { approveBlogPost, rejectBlogPost } from './actions';

export default async function ModerationPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/auth/sign-in');

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('app_role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['owner', 'manager'].includes(profile.app_role)) {
    redirect('/studio');
  }

  const posts = await getPendingBlogPosts();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Listener response moderation</h1>
        <p className="text-sm opacity-75">Approve the responses you want to publish on song pages.</p>
      </header>

      {posts.length ? (
        <div className="space-y-5">
          {posts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{post.title}</h2>
                <p className="text-sm opacity-70">
                  Song: {post.song_title || 'Unknown song'}
                  {post.author_name ? ` • From: ${post.author_name}` : ''}
                </p>
                <p className="text-sm whitespace-pre-wrap">{post.excerpt || 'No excerpt provided.'}</p>
              </div>

              <div className="flex gap-3">
                <form action={approveBlogPost}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button className="rounded-xl border border-white/10 px-4 py-2">Approve</button>
                </form>
                <form action={rejectBlogPost}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button className="rounded-xl border border-white/10 px-4 py-2">Reject</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm opacity-70">No pending listener responses right now.</p>
      )}
    </div>
  );
}
