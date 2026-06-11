import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { getSongBySlug } from '@/lib/data';
import { submitSongResponse } from './actions';

const SONG_ORIGIN_LABELS: Record<string, string> = {
  dream: 'Dreamborn',
  comment: 'Comment-born',
  thought: 'Thought-born',
  road: 'Road-born',
  conversation: 'Conversation-born',
  prayer: 'Prayer-born',
  memory: 'Memory-born',
  image: 'Image-born',
  riff: 'Riff-born',
  title: 'Title-born',
  journal: 'Journal-born',
  performance: 'Performance-born',
  other: 'Other arrival',
};

function ApprovedPosts({
  posts,
}: {
  posts: Array<{
    id: string;
    title?: string | null;
    excerpt?: string | null;
    author_name?: string | null;
    published_at?: string | null;
  }>;
}) {
  if (!posts?.length) {
    return <p className="copy">No listener responses yet.</p>;
  }

  return (
    <div className="song-grid">
      {posts.map((post) => (
        <article key={post.id} className="subsection">
          <h3 className="h3">{post.title || 'Listener response'}</h3>

          {(post.author_name || post.published_at) && (
            <div className="pillRow" style={{ marginBottom: '0.8rem' }}>
              {post.author_name ? <span className="pill">by {post.author_name}</span> : null}
              {post.published_at ? (
                <span className="pill">
                  {new Date(post.published_at).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          )}

          <p className="copy" style={{ whiteSpace: 'pre-wrap' }}>
            {post.excerpt || ''}
          </p>
        </article>
      ))}
    </div>
  );
}

function SongResponseForm({ songId }: { songId: string }) {
  const fieldStyle: CSSProperties = {
    width: '100%',
    padding: '0.95rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(5,12,24,0.45)',
    color: 'rgba(255,255,255,0.92)',
    outline: 'none',
  };

  const labelStyle: CSSProperties = {
    display: 'block',
    marginBottom: '0.45rem',
    fontSize: '0.95rem',
    fontWeight: 600,
  };

  const buttonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.85rem 1.1rem',
    borderRadius: '999px',
    border: '1px solid rgba(214, 176, 72, 0.35)',
    background: 'rgba(214, 176, 72, 0.12)',
    color: '#f7e6b0',
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <form action={submitSongResponse}>
      <input type="hidden" name="song_id" value={songId} />

      <div style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <label htmlFor="title" style={labelStyle}>
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Optional title"
            style={fieldStyle}
          />
        </div>

        <div>
          <label htmlFor="author_name" style={labelStyle}>
            Your name
          </label>
          <input
            id="author_name"
            name="author_name"
            type="text"
            placeholder="Optional"
            style={fieldStyle}
          />
        </div>

        <div>
          <label htmlFor="excerpt" style={labelStyle}>
            Your response
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={6}
            placeholder="Share what this song stirred in you..."
            style={{ ...fieldStyle, resize: 'vertical' }}
            required
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p className="copy" style={{ margin: 0 }}>
            Responses are reviewed before appearing publicly.
          </p>

          <button type="submit" style={buttonStyle}>
            Submit for review
          </button>
        </div>
      </div>
    </form>
  );
}

function ActionLink({
  href,
  children,
  accent = false,
}: {
  href: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.8rem 1rem',
        borderRadius: '999px',
        border: accent
          ? '1px solid rgba(214, 176, 72, 0.35)'
          : '1px solid rgba(255,255,255,0.12)',
        background: accent ? 'rgba(214, 176, 72, 0.12)' : 'rgba(255,255,255,0.04)',
        color: accent ? '#f7e6b0' : 'rgba(255,255,255,0.92)',
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  );
}

function getVersionAudio(version: any) {
  if (!version) return null;

  if (version.audio_url) {
    return {
      url: version.audio_url,
      mimeType: version.audio_mime_type || 'audio/mpeg',
      title: version.audio_title || null,
    };
  }

  const audioAttachment =
    version.attachments?.find((item: any) => item.file_type === 'audio') ??
    version.attachments?.[0];

  if (!audioAttachment) return null;

  return {
    url: audioAttachment.public_url || null,
    mimeType: audioAttachment.mime_type || 'audio/mpeg',
    title: audioAttachment.title || null,
  };
}

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const song = await getSongBySlug(slug);

  if (!song) notFound();

  const versions = [...(song.versions ?? [])].sort(
    (a: any, b: any) => a.version_number - b.version_number
  );

  const primaryVersion =
    versions.find((v: any) => v.is_stage_primary) ?? versions[0];

  const primaryVersionAudio = getVersionAudio(primaryVersion);

  const hasDraft = versions.some((v: any) => v.stage === 'draft');
  const hasFinal = versions.some((v: any) => v.stage === 'final');

  return (
    <section className="section">
      <div className="container">
        <div className="card">
          <div className="eyebrow">Song in the current</div>

          <div className="pillRow" style={{ marginBottom: '1rem' }}>
            <span className="pill">{song.muse_slug ?? 'unassigned'}</span>
            <span className="pill">{song.current_stage ?? 'unknown'}</span>
            {song.song_origin ? (
              <span className="pill">
                {SONG_ORIGIN_LABELS[song.song_origin] ?? song.song_origin}
              </span>
            ) : null}
            {primaryVersion ? (
              <span className="pill">Version {primaryVersion.version_number}</span>
            ) : null}
          </div>

          <h1
            className="h2"
            style={{
              fontSize: 'clamp(2.4rem, 5vw, 4.5rem)',
              lineHeight: 1.02,
              marginBottom: '0.8rem',
            }}
          >
            {song.title || 'Untitled song'}
          </h1>

          {song.hook_line ? (
            <div className="quote-panel" style={{ maxWidth: 760 }}>
              {song.hook_line}
            </div>
          ) : null}

          <p className="copy" style={{ maxWidth: 760 }}>
            {song.summary || 'Early spark. More details coming soon.'}
          </p>

          {song.muse_slug === 'veiled' ? (
            <p className="copy" style={{ marginTop: '0.8rem', maxWidth: 760 }}>
              This song is currently held in The Veiled Muse — Not-aMused-Yet — until its deeper current becomes clear.
            </p>
          ) : null}

          <div className="pillRow" style={{ marginTop: '1.2rem' }}>
            <Link href={`/studio/songs/${song.slug}/edit`} className="button">
              Edit Song
            </Link>

            {!hasDraft ? (
              <ActionLink href={`/studio/capture?song=${song.id}&stage=draft`}>
                Add Draft
              </ActionLink>
            ) : null}

            {!hasFinal ? (
              <ActionLink
                href={`/studio/capture?song=${song.id}&stage=final`}
                accent
              >
                Add Final
              </ActionLink>
            ) : null}
          </div>
        </div>

        <div className="section-tight" />

        <div className="two-col">
          <div className="card">
            <div className="eyebrow">Listen</div>
            <h2 className="h2">Current audio</h2>

            {primaryVersionAudio?.url ? (
              <audio controls preload="none" className="audioPlayer">
                <source
                  src={primaryVersionAudio.url}
                  type={primaryVersionAudio.mimeType}
                />
                Your browser does not support this audio file.
              </audio>
            ) : song.audio_url ? (
              <audio controls preload="none" className="audioPlayer">
                <source
                  src={song.audio_url}
                  type={song.attachments?.[0]?.mime_type || 'audio/mpeg'}
                />
                Your browser does not support this audio file.
              </audio>
            ) : (
              <p className="copy">No audio uploaded yet.</p>
            )}
          </div>

          <div className="card">
            <div className="eyebrow">Current version</div>
            <h2 className="h2">What is taking shape</h2>

            {primaryVersion ? (
              <div className="subsection">
                <div className="pillRow" style={{ marginBottom: '0.8rem' }}>
                  <span className="pill">Version {primaryVersion.version_number}</span>
                  <span className="pill">{primaryVersion.stage}</span>
                  {primaryVersion.is_stage_primary ? (
                    <span className="pill">primary</span>
                  ) : null}
                </div>

                <h3 className="h3">Arrangement notes</h3>
                <p className="copy" style={{ whiteSpace: 'pre-wrap' }}>
                  {primaryVersion.arrangement_notes || 'No arrangement notes yet.'}
                </p>

                <div className="divider" />

                <h3 className="h3">Lyrics</h3>
                <p className="copy" style={{ whiteSpace: 'pre-wrap' }}>
                  {primaryVersion.lyrics || 'No lyrics yet.'}
                </p>

                <div className="divider" />

                <h3 className="h3">Story behind the song</h3>
                <p className="copy" style={{ whiteSpace: 'pre-wrap' }}>
                  {primaryVersion.story_behind_song || 'No story added yet.'}
                </p>
              </div>
            ) : (
              <p className="copy">No version details yet.</p>
            )}
          </div>
        </div>

        <div className="section-tight" />

        <div className="card">
          <div className="eyebrow">Path through the current</div>
          <h2 className="h2">Version history</h2>

          {versions.length ? (
            <div className="song-grid">
              {versions.map((version: any) => {
                const versionAudio = getVersionAudio(version);

                return (
                  <article key={version.id} className="subsection">
                    <div className="pillRow" style={{ marginBottom: '0.8rem' }}>
                      <span className="pill">Version {version.version_number}</span>
                      <span className="pill">{version.stage}</span>
                      {version.is_stage_primary ? (
                        <span className="pill">primary</span>
                      ) : null}
                    </div>

                    <h3 className="h3">
                      {version.title || song.title || 'Untitled version'}
                    </h3>

                    {versionAudio?.url ? (
                      <audio
                        controls
                        preload="none"
                        className="audioPlayer"
                        style={{ marginTop: '0.8rem', marginBottom: '1rem' }}
                      >
                        <source src={versionAudio.url} type={versionAudio.mimeType} />
                        Your browser does not support this audio file.
                      </audio>
                    ) : (
                      <p className="copy" style={{ marginTop: '0.8rem' }}>
                        No audio attached to this version.
                      </p>
                    )}

                    {version.arrangement_notes ? (
                      <>
                        <div className="divider" />
                        <h4 className="h3" style={{ fontSize: '1rem' }}>Arrangement notes</h4>
                        <p className="copy" style={{ whiteSpace: 'pre-wrap' }}>
                          {version.arrangement_notes}
                        </p>
                      </>
                    ) : null}

                    {version.story_behind_song ? (
                      <>
                        <div className="divider" />
                        <h4 className="h3" style={{ fontSize: '1rem' }}>Story</h4>
                        <p className="copy" style={{ whiteSpace: 'pre-wrap' }}>
                          {version.story_behind_song}
                        </p>
                      </>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="copy">No versions yet.</p>
          )}
        </div>

        <div className="section-tight" />

        <div className="two-col">
          <div className="card">
            <div className="eyebrow">Community</div>
            <h2 className="h2">Listener responses</h2>
            <ApprovedPosts posts={song.posts ?? []} />
          </div>

          <div className="card">
            <div className="eyebrow">Share what it stirred</div>
            <h2 className="h2">Leave a response</h2>
            <SongResponseForm songId={song.id} />
          </div>
        </div>
      </div>
    </section>
  );
}