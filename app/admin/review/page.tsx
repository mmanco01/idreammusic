import Link from 'next/link';
import { getPendingBlogPosts } from '@/lib/data';
import { getServerAuthContext } from '@/lib/auth';
import { approveBlogPost, rejectBlogPost } from '@/app/admin/review/actions';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

export default async function ReviewQueuePage() {
  const { user, profile } = await getServerAuthContext();
  const canReview = profile?.role === 'owner' || profile?.role === 'manager';

  if (!user) {
    return (
      <section className="section-tight">
        <div className="container pageStack">
          <div className="card">
            <div className="eyebrow">Manager lane</div>
            <h1 className="h2">Blog approval queue</h1>
            <p className="copy">Sign in with an owner or manager account to work the review queue.</p>
            <Link className="button primary" href="/auth/sign-in?next=/admin/review">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!canReview) {
    return (
      <section className="section-tight">
        <div className="container pageStack">
          <div className="card">
            <div className="eyebrow">Manager lane</div>
            <h1 className="h2">Blog approval queue</h1>
            <p className="copy">
              This page is reserved for owner and manager accounts. Promote your profile role in Supabase if this is
              your site-owner login.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const pendingPosts = await getPendingBlogPosts();

  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Manager lane</div>
            <h1 className="h2">Blog approval queue</h1>
            <p className="copy" style={{ maxWidth: 760 }}>
              Public blog posts stay pending until you approve them here. Approving stamps the reviewer and publish
              date into Supabase.
            </p>
          </div>
        </div>

        {pendingPosts.length ? (
          pendingPosts.map((post) => (
            <div className="card" key={post.id}>
              <div className="pillRow" style={{ marginBottom: '.8rem' }}>
                <span className="pill">{post.approval_status}</span>
                <span className="pill">{post.post_type}</span>
                {post.song_title ? <span className="pill">{post.song_title}</span> : null}
              </div>
              <h2 className="h3">{post.title}</h2>
              <p className="copy">{post.excerpt || 'No excerpt yet.'}</p>
              <div className="commentMeta" style={{ marginTop: '.8rem' }}>
                <span>{post.author_name || 'Unknown author'}</span>
                <span>•</span>
                <span>{formatDate(post.created_at)}</span>
              </div>
              <div className="button-row">
                <form action={approveBlogPost}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button className="button primary" type="submit">
                    Approve
                  </button>
                </form>
                <form action={rejectBlogPost}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button className="button" type="submit">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))
        ) : (
          <div className="card">
            <h2 className="h3">Queue is clear</h2>
            <p className="copy">No pending blog posts are waiting on approval right now.</p>
          </div>
        )}
      </div>
    </section>
  );
}
