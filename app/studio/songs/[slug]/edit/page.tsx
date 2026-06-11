import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { saveSongEdits } from './actions';

export default async function EditSongPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select(`
      id,
      slug,
      title_working,
      title_final,
      hook_line,
      summary,
      current_stage,
      status,
      song_origin,
      owner_user_id,
      song_versions (
        id,
        version_number,
        stage,
        title,
        lyrics,
        arrangement_notes,
        story_behind_song,
        is_stage_primary,
        created_at
      ),
      writer_notes (
        id,
        title,
        body,
        visibility,
        created_at
      )
    `)
    .eq('slug', slug)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (songError || !song) {
    notFound();
  }

  const versions = [...(song.song_versions ?? [])].sort(
    (a: any, b: any) => a.version_number - b.version_number
  );

  const primaryVersion =
    versions.find((v: any) => v.is_stage_primary) ?? versions[0] ?? null;

  const latestNote =
    [...(song.writer_notes ?? [])].sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] ?? null;

  return (
    <section className="section">
      <div className="container">
        <div className="card">
          <div className="eyebrow">Owner edit</div>
          <h1 className="h2">Edit Song</h1>
          <p className="copy" style={{ maxWidth: 820 }}>
            Update stage, visibility, origin, version details, and writer notes for this song.
          </p>

          <div className="button-row" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <Link href={`/songs/${slug}`} className="button">
              Back to song
            </Link>
          </div>

          <form action={saveSongEdits} className="card-grid">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="song_id" value={song.id} />
            <input type="hidden" name="version_id" value={primaryVersion?.id ?? ''} />
            <input type="hidden" name="writer_note_id" value={latestNote?.id ?? ''} />

            <div className="card">
              <div className="eyebrow">Song</div>
              <h2 className="h2">Song metadata</h2>

              <label className="copy">Working title</label>
              <input
                name="title_working"
                defaultValue={song.title_working ?? ''}
                className="input"
              />

              <label className="copy">Final title</label>
              <input
                name="title_final"
                defaultValue={song.title_final ?? ''}
                className="input"
              />

              <label className="copy">Hook line</label>
              <input
                name="hook_line"
                defaultValue={song.hook_line ?? ''}
                className="input"
              />

              <label className="copy">Summary</label>
              <textarea
                name="summary"
                defaultValue={song.summary ?? ''}
                className="textarea"
                rows={4}
              />

              <label className="copy">Current stage</label>
              <select
                name="current_stage"
                defaultValue={song.current_stage ?? 'spark'}
                className="input"
              >
                <option value="spark">Spark</option>
                <option value="draft">Draft</option>
                <option value="final">Final</option>
              </select>

              <label className="copy">How It Arrived</label>
              <select
                name="song_origin"
                defaultValue={song.song_origin ?? 'other'}
                className="input"
              >
                <option value="dream">Dream</option>
                <option value="comment">Comment</option>
                <option value="thought">Thought</option>
                <option value="road">Road</option>
                <option value="conversation">Conversation</option>
                <option value="prayer">Prayer</option>
                <option value="memory">Memory</option>
                <option value="image">Image</option>
                <option value="riff">Riff</option>
                <option value="title">Title</option>
                <option value="journal">Journal</option>
                <option value="performance">Performance</option>
                <option value="other">Other</option>
              </select>

              <label className="copy">Visibility / status</label>
              <select
                name="status"
                defaultValue={song.status ?? 'private'}
                className="input"
              >
                <option value="private">Private</option>
                <option value="shared">Shared</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="card">
              <div className="eyebrow">Primary version</div>
              <h2 className="h2">Version details</h2>

              {primaryVersion ? (
                <>
                  <div className="pillRow" style={{ marginBottom: '1rem' }}>
                    <span className="pill">Version {primaryVersion.version_number}</span>
                    <span className="pill">{primaryVersion.stage}</span>
                    {primaryVersion.is_stage_primary ? (
                      <span className="pill">primary</span>
                    ) : null}
                  </div>

                  <label className="copy">Version stage</label>
                  <select
                    name="version_stage"
                    defaultValue={primaryVersion.stage ?? 'spark'}
                    className="input"
                  >
                    <option value="spark">Spark</option>
                    <option value="draft">Draft</option>
                    <option value="final">Final</option>
                  </select>

                  <label className="copy">Version title</label>
                  <input
                    name="version_title"
                    defaultValue={primaryVersion.title ?? ''}
                    className="input"
                  />

                  <label className="copy">Lyrics</label>
                  <textarea
                    name="lyrics"
                    defaultValue={primaryVersion.lyrics ?? ''}
                    className="textarea"
                    rows={10}
                  />

                  <label className="copy">Arrangement notes</label>
                  <textarea
                    name="arrangement_notes"
                    defaultValue={primaryVersion.arrangement_notes ?? ''}
                    className="textarea"
                    rows={6}
                  />

                  <label className="copy">Story behind the song</label>
                  <textarea
                    name="story_behind_song"
                    defaultValue={primaryVersion.story_behind_song ?? ''}
                    className="textarea"
                    rows={6}
                  />
                </>
              ) : (
                <p className="copy">No version found for this song yet.</p>
              )}
            </div>

            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="eyebrow">Writer note</div>
              <h2 className="h2">Comments / process notes</h2>

              <label className="copy">Note title</label>
              <input
                name="note_title"
                defaultValue={latestNote?.title ?? ''}
                className="input"
              />

              <label className="copy">Note body</label>
              <textarea
                name="note_body"
                defaultValue={latestNote?.body ?? ''}
                className="textarea"
                rows={8}
              />

              <label className="copy">Note visibility</label>
              <select
                name="note_visibility"
                defaultValue={latestNote?.visibility ?? 'private'}
                className="input"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div className="button-row">
                <button type="submit" className="button primary">
                  Save changes
                </button>
                <Link href={`/songs/${slug}`} className="button">
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}