import Link from 'next/link';
import { getServerAuthContext } from '@/lib/auth';
import { getMySongs } from '@/lib/data';

export default async function StudioPage() {
  const { user, profile } = await getServerAuthContext();
  const mySongs = user ? await getMySongs(user.id) : [];

  return (
    <section className="section">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Creator Studio</div>
            <h1 className="h2">Work the current</h1>
            <p className="copy" style={{ maxWidth: 760 }}>
              This is the working side of iDreamMusic: fast Muse uploads, versioned drafting, final-song publishing,
              writer notes you can mark private or public, and a blog queue that only goes live after your approval.
            </p>
          </div>
          {!user ? (
            <Link className="button primary" href="/auth/sign-in?next=/studio">
              Sign in to upload
            </Link>
          ) : null}
        </div>

        <div className="stage-grid">
          <div className="stage-card">
            <h3 className="h3">Upload</h3>
            <p className="copy">
              Go straight to the Muse page or use the capture screen to upload a new spark, first draft, or final cut.
            </p>
            <Link className="button" href="/studio/capture">
              New upload
            </Link>
          </div>
          <div className="stage-card">
            <h3 className="h3">Build</h3>
            <p className="copy">Each upload creates the first version row and the stage timeline automatically.</p>
          </div>
          <div className="stage-card">
            <h3 className="h3">Release</h3>
            <p className="copy">
              Owner and manager accounts can review pending public blog stories before they go live.
            </p>
            <Link className="button" href="/admin/review">
              Review queue
            </Link>
          </div>
        </div>

        {user ? (
          <div className="card">
            <div className="eyebrow">Signed in as</div>
            <h2 className="h3">{profile?.display_name || user.email}</h2>
            <p className="copy">Your latest uploads appear here.</p>

            {mySongs.length ? (
              <div className="song-grid" style={{ marginTop: '1rem' }}>
                {mySongs.map((song) => (
                  <article key={song.id} className="subsection">
                    <div className="pillRow" style={{ marginBottom: '.8rem' }}>
                      <span className="pill">{song.current_stage}</span>
                      {song.muse_slug ? <span className="pill">{song.muse_slug}</span> : null}
                    </div>
                    <h3 className="h3">
                      <Link href={`/songs/${song.slug}`}>{song.title}</Link>
                    </h3>
                    {song.summary ? <p className="copy">{song.summary}</p> : null}
                    {song.audio_url ? (
                      <audio controls preload="none" className="audioPlayer">
                        <source src={song.audio_url} />
                      </audio>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="copy" style={{ marginTop: '1rem' }}>
                You have not uploaded a song yet. Start at the capture page or any Muse page.
              </p>
            )}
          </div>
        ) : (
          <div className="card">
            <h2 className="h3">Not signed in yet</h2>
            <p className="copy">Sign in first, then use the Muse pages as direct upload entry points for your songs.</p>
          </div>
        )}
      </div>
    </section>
  );
}
