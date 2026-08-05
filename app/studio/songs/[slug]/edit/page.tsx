import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/auth";
import { MUSE_OPTIONS } from "@/lib/muses";
import { saveSongEdits } from "./actions";
import { SongIntelligencePanel } from "@/components/studio/SongIntelligencePanel";
import { MuseChatPanel } from "@/components/studio/MuseChatPanel";
import { ProductionCreditsEditor } from "@/components/studio/ProductionCreditsEditor";
import { SongDangerZone } from "@/components/studio/SongDangerZone";
import { SparkSavedNextSteps } from "@/components/studio/SparkSavedNextSteps";
import { SongUnavailable } from "@/components/songs/SongUnavailable";
import { buildPublicAssetUrl } from "@/lib/storage";
import type { ProductionCreditRow } from "@/lib/production-credits";

export default async function EditSongPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    capture?: string;
    analysis?: string;
    muse?: string;
    question?: string;
    workspace?: string;
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const isFreshlyCaptured = query.capture === "saved";
  const showFreshCaptureHandoff =
    isFreshlyCaptured && query.workspace !== "open";
  const { user, profile, supabase } = await getServerAuthContext();

  if (!user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(`/studio/songs/${slug}/edit`)}`);
  }

  if (!supabase) {
    return <SongUnavailable isSignedIn />;
  }

  const { data: song, error: songError } = await (supabase as any)
    .from("songs")
    .select(`
      id,
      slug,
      title_working,
      title_final,
      hook_line,
      summary,
      songwriter_name,
      genre,
      current_stage,
      status,
      song_origin,
      owner_user_id,
      muse_id,
      deleted_at,
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
      attachments (
        id,
        title,
        storage_path,
        bucket,
        mime_type,
        song_version_id,
        file_type,
        created_at
      ),
      song_transcripts (
        id,
        attachment_id,
        song_version_id,
        transcript_text,
        is_reviewed,
        updated_at
      ),
      writer_notes (
        id,
        title,
        body,
        visibility,
        created_at
      )
    `)
    .eq("slug", slug)
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (songError || !song) {
    return <SongUnavailable isSignedIn />;
  }

  let assignedMuseSlug = "calliope";

  if (song.muse_id) {
    const { data: assignedMuse, error: museError } = await (supabase as any)
      .from("muses")
      .select("slug")
      .eq("id", song.muse_id)
      .maybeSingle();

    if (museError) {
      console.error("Unable to load assigned Muse:", museError);
    } else if (
      assignedMuse?.slug &&
      MUSE_OPTIONS.some((option) => option.slug === assignedMuse.slug)
    ) {
      assignedMuseSlug = assignedMuse.slug;
    }
  }

  const assignedMuse =
    MUSE_OPTIONS.find((option) => option.slug === assignedMuseSlug) ??
    MUSE_OPTIONS[0];
  const hasAssignedMuse = Boolean(song.muse_id);

  const requestedMuseSlug = MUSE_OPTIONS.some(
    (option) => option.slug === query.muse,
  )
    ? query.muse
    : undefined;
  const initialMuseQuestion = query.question?.trim() || undefined;

  const { data: engagementSummary } = await (supabase as any)
    .from("song_engagement_summaries")
    .select("audio_play_count, last_audio_play_at")
    .eq("song_id", song.id)
    .maybeSingle();

  const { data: audioPlayEvents } = await (supabase as any)
    .from("song_engagement_events")
    .select("user_id, anonymous_session_id, occurred_at")
    .eq("song_id", song.id)
    .eq("event_type", "audio_play");

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const uniqueListenerKeys = new Set(
    (audioPlayEvents ?? [])
      .map((event: any) => {
        if (event.user_id) {
          return `user:${event.user_id}`;
        }

        if (event.anonymous_session_id) {
          return `session:${event.anonymous_session_id}`;
        }

        return null;
      })
      .filter((value: string | null): value is string => Boolean(value)),
  );

  const audienceMetrics = {
    totalListens: Number(engagementSummary?.audio_play_count ?? 0),
    uniqueListeners: uniqueListenerKeys.size,
    recentListens: (audioPlayEvents ?? []).filter((event: any) => {
      const occurredAt = new Date(event.occurred_at).getTime();

      return !Number.isNaN(occurredAt) && occurredAt >= sevenDaysAgo;
    }).length,
    lastListenedAt: engagementSummary?.last_audio_play_at ?? null,
  };

  const versions = [...(song.song_versions ?? [])].sort(
    (a: any, b: any) => a.version_number - b.version_number,
  );

  const primaryVersion =
    versions.find((version: any) => version.is_stage_primary) ??
    versions[0] ??
    null;

  let productionCredits: ProductionCreditRow[] = [];

  if (primaryVersion?.id) {
    const { data: creditRows, error: creditError } =
      await (supabase as any)
        .from("song_version_credits")
        .select(
          "id, song_id, song_version_id, role_key, credit_value, is_public, sort_order",
        )
        .eq("song_id", song.id)
        .eq("song_version_id", primaryVersion.id)
        .order("sort_order", { ascending: true });

    if (creditError) {
      console.error(
        "Unable to load production credits:",
        creditError.message,
      );
    } else {
      productionCredits =
        (creditRows ?? []) as ProductionCreditRow[];
    }
  }

  const latestNote =
    [...(song.writer_notes ?? [])].sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    )[0] ?? null;

  const songTitle =
    song.title_final ||
    song.title_working ||
    primaryVersion?.title ||
    "Untitled song";

  const audioAttachments = (song.attachments ?? []).filter(
    (attachment: any) => attachment.file_type === "audio",
  );

  const supportingAttachments = (song.attachments ?? []).filter(
    (attachment: any) => attachment.file_type !== "audio",
  );

  const transcripts = song.song_transcripts ?? [];
  const transcriptCount = transcripts.length;
  const reviewedTranscriptCount = transcripts.filter(
    (transcript: any) => transcript.is_reviewed,
  ).length;
  const hasLyrics = Boolean(primaryVersion?.lyrics?.trim());
  const hasMeaningfulTitle = Boolean(
    songTitle.trim() && !/^Untitled Spark\s*[—-]/i.test(songTitle.trim()),
  );
  const hasCapturedText = Boolean(
    hasMeaningfulTitle ||
      primaryVersion?.lyrics?.trim() ||
      song.summary?.trim() ||
      song.hook_line?.trim() ||
      primaryVersion?.story_behind_song?.trim() ||
      (song.writer_notes ?? []).some((note: any) => note.body?.trim()) ||
      supportingAttachments.length,
  );

  const { data: latestAnalysis } = await (supabase as any)
    .from("ai_analysis_runs")
    .select("id, completed_at")
    .eq("song_id", song.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const recommendedNextMove = !latestAnalysis && audioAttachments.length && !transcriptCount
    ? "Transcribe the recording, review the words, and then run Song Intelligence."
    : !latestAnalysis && audioAttachments.length && !reviewedTranscriptCount
      ? "Review and correct the transcript before running Song Intelligence."
      : !latestAnalysis
        ? "Run Song Intelligence to understand the Spark, see provisional ratings, and discover the most useful Muse direction."
        : !audioAttachments.length
          ? "Add a recording when you are ready to strengthen the analysis with melody and performance evidence."
          : !hasLyrics
            ? "Separate the remembered or performed lyric from the transcript and save it as the working lyric."
            : String(song.current_stage || "").toLowerCase() !== "final"
              ? "Review Song Intelligence, choose one development task, and create the next version."
              : "Review Muse guidance and listener response before deciding whether the song needs another revision.";


  const recommendedAction = !latestAnalysis && audioAttachments.length && !transcriptCount
    ? { label: "Transcribe the recording", href: "#intelligence" }
    : !latestAnalysis && audioAttachments.length && !reviewedTranscriptCount
      ? { label: "Review the transcript", href: "#intelligence" }
      : !latestAnalysis
        ? { label: "Run Song Intelligence", href: "#intelligence" }
        : !hasLyrics
          ? { label: "Update the working lyric", href: "#song-details" }
          : String(song.current_stage || "").toLowerCase() !== "final"
            ? { label: "Choose the next development task", href: "#intelligence" }
            : { label: "Review Muse guidance", href: "#muses" };

  if (showFreshCaptureHandoff) {
    return (
      <section className="section">
        <div className="container pageStack">
          <SparkSavedNextSteps
            songId={song.id}
            slug={slug}
            songTitle={songTitle}
            museLabel={
              hasAssignedMuse
                ? `${assignedMuse?.name ?? "Muse"} — ${assignedMuse?.domain ?? "Creative partner"}`
                : "Muse direction pending"
            }
            firstAudioAttachmentId={audioAttachments[0]?.id ?? null}
            hasTranscript={transcripts.some(
              (transcript: any) =>
                transcript.attachment_id === audioAttachments[0]?.id,
            )}
            hasReviewedTranscript={transcripts.some(
              (transcript: any) =>
                transcript.attachment_id === audioAttachments[0]?.id &&
                transcript.is_reviewed,
            )}
            hasCapturedText={hasCapturedText}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container pageStack">
        <section
          id="overview"
          className="card"
          style={{
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(220, 182, 92, 0.5)",
            background:
              "radial-gradient(circle at top right, rgba(151, 106, 40, 0.16), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.08))",
          }}
        >
          <style>{`
            @media (min-width: 760px) {
              .work-song-title-one-line {
                white-space: nowrap;
              }
            }

            @media (max-width: 759px) {
              .work-song-title-one-line {
                white-space: normal;
              }
            }
          `}</style>

          <div className="eyebrow">Song workbench</div>

          <h1
            className="h2 work-song-title-one-line"
            style={{
              marginTop: "0.45rem",
              marginBottom: "1.15rem",
              fontSize: "clamp(2rem, 4vw, 3.45rem)",
              lineHeight: 1,
              opacity: 0.96,
            }}
          >
            Work the Song
          </h1>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 310px), 1fr))",
              gap: "1.25rem",
              alignItems: "end",
            }}
          >
            <div>
              <div className="eyebrow">Current song</div>

              <h2
                className="h2"
                style={{
                  marginTop: "0.35rem",
                  marginBottom: "0.7rem",
                  fontSize: "clamp(1.75rem, 3.2vw, 2.7rem)",
                  lineHeight: 1.05,
                }}
              >
                {songTitle}
              </h2>

              <div className="pillRow" style={{ marginTop: "0.7rem" }}>
                <span className="pill">
                  {hasAssignedMuse
                    ? `${assignedMuse?.name ?? "Muse"} — ${assignedMuse?.domain ?? "Creative partner"}`
                    : "Muse not yet assigned"}
                </span>
                <span className="pill">
                  {song.current_stage ?? "spark"}
                </span>
                <span className="pill">{song.status ?? "private"}</span>
                {primaryVersion ? (
                  <span className="pill">
                    Version {primaryVersion.version_number}
                  </span>
                ) : null}
              </div>

              {song.summary ? (
                <p
                  className="copy"
                  style={{ marginTop: "0.9rem", maxWidth: 780 }}
                >
                  {song.summary}
                </p>
              ) : null}
            </div>

            <div className="recommended-action" style={{ marginTop: 0 }}>
              <div className="recommended-action__eyebrow">Recommended next step</div>
              <h3 className="recommended-action__title">{recommendedAction.label}</h3>
              <p className="recommended-action__description" style={{ marginBottom: 0 }}>
                {recommendedNextMove}
              </p>
              <div className="recommended-action__controls">
                <a className="button primary" href={recommendedAction.href}>
                  {recommendedAction.label}
                </a>
              </div>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: "1rem" }}>
            <Link href="/studio" className="button secondary">
              Back to Studio
            </Link>

            <Link href={`/songs/${slug}`} className="button secondary">
              View public song page
            </Link>
          </div>
        </section>

        <nav
          aria-label="Song workbench sections"
          className="card"
          style={{
            position: "sticky",
            top: 72,
            zIndex: 20,
            padding: "0.65rem",
            border: "1px solid rgba(220, 182, 92, 0.32)",
            background: "rgba(9, 19, 35, 0.94)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            {[
              ["Overview", "#overview"],
              ["Song details", "#song-details"],
              ["Intelligence", "#intelligence"],
              ["Creative council", "#muses"],
              ["Share", "#share"],
              ["Credits", "#credits"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="button tertiary">
                {label}
              </a>
            ))}
          </div>
        </nav>

        <section className="card">
          <div className="eyebrow">At a glance</div>
          <h2 className="h2">Current creative state</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "0.8rem",
              marginTop: "0.8rem",
            }}
          >
            {[
              ["Assigned Muse", assignedMuse?.name ?? "Unassigned"],
              ["Origin", song.song_origin ?? "Not recorded"],
              ["Stage", song.current_stage ?? "spark"],
              ["Versions", versions.length],
              ["Recordings", audioAttachments.length],
              ["Transcripts", transcriptCount],
              ["Listens", audienceMetrics.totalListens],
              ["Unique listeners", audienceMetrics.uniqueListeners],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  padding: "0.9rem",
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="eyebrow">{label}</div>
                <div
                  className="h3"
                  style={{
                    marginTop: "0.35rem",
                    marginBottom: 0,
                    fontSize: "1.15rem",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="song-details" className="card">
          <div className="eyebrow">Song details</div>
          <h2 className="h2">Words, versions, notes, and status</h2>

          <p className="copy" style={{ maxWidth: 850 }}>
            Keep the creative workspace focused. Open only the area you
            need, make the change, and save the song.
          </p>

          <form action={saveSongEdits}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="song_id" value={song.id} />
            <input
              type="hidden"
              name="version_id"
              value={primaryVersion?.id ?? ""}
            />
            <input
              type="hidden"
              name="writer_note_id"
              value={latestNote?.id ?? ""}
            />

            <details
              open
              className="card"
              style={{ marginTop: "1rem" }}
            >
              <summary
                className="h3"
                style={{ cursor: "pointer" }}
              >
                Song identity and status
              </summary>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                  gap: "1rem",
                  marginTop: "1rem",
                }}
              >
                <div>
                  <label className="copy" htmlFor="title_working">
                    Working title
                  </label>
                  <input
                    id="title_working"
                    name="title_working"
                    defaultValue={song.title_working ?? ""}
                    className="input"
                  />

                  <label className="copy" htmlFor="title_final">
                    Final title
                  </label>
                  <input
                    id="title_final"
                    name="title_final"
                    defaultValue={song.title_final ?? ""}
                    className="input"
                  />

                  <label className="copy" htmlFor="hook_line">
                    Hook line
                  </label>
                  <input
                    id="hook_line"
                    name="hook_line"
                    defaultValue={song.hook_line ?? ""}
                    className="input"
                  />

                  <label className="copy" htmlFor="summary">
                    Summary
                  </label>
                  <textarea
                    id="summary"
                    name="summary"
                    defaultValue={song.summary ?? ""}
                    className="textarea"
                    rows={5}
                  />
                </div>

                <div>
                  <label className="copy" htmlFor="songwriter_name">
                    Songwriter
                  </label>
                  <input
                    id="songwriter_name"
                    name="songwriter_name"
                    defaultValue={
                      song.songwriter_name?.trim() ||
                      profile?.display_name?.trim() ||
                      ""
                    }
                    className="input"
                    placeholder="Your name or co-writers"
                  />

                  <label className="copy" htmlFor="genre">
                    Genre
                  </label>
                  <input
                    id="genre"
                    name="genre"
                    defaultValue={song.genre ?? ""}
                    className="input"
                    placeholder="Blues, Rock, Country..."
                  />

                  <label className="copy" htmlFor="current_stage">
                    Current stage
                  </label>
                  <select
                    id="current_stage"
                    name="current_stage"
                    defaultValue={song.current_stage ?? "spark"}
                    className="input"
                  >
                    <option value="spark">Spark</option>
                    <option value="draft">Draft</option>
                    <option value="final">Final</option>
                  </select>

                  <label className="copy" htmlFor="song_origin">
                    How it arrived
                  </label>
                  <select
                    id="song_origin"
                    name="song_origin"
                    defaultValue={song.song_origin ?? "other"}
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

                  <label className="copy" htmlFor="status">
                    Visibility / status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={song.status ?? "private"}
                    className="input"
                  >
                    <option value="private">Private</option>
                    <option value="shared">Shared</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </details>

            <details className="card" style={{ marginTop: "1rem" }}>
              <summary
                className="h3"
                style={{ cursor: "pointer" }}
              >
                Primary version, lyrics, and arrangement
              </summary>

              <div style={{ marginTop: "1rem" }}>
                {primaryVersion ? (
                  <>
                    <div
                      className="pillRow"
                      style={{ marginBottom: "1rem" }}
                    >
                      <span className="pill">
                        Version {primaryVersion.version_number}
                      </span>
                      <span className="pill">
                        {primaryVersion.stage}
                      </span>
                      {primaryVersion.is_stage_primary ? (
                        <span className="pill">primary</span>
                      ) : null}
                    </div>

                    <label className="copy" htmlFor="version_stage">
                      Version stage
                    </label>
                    <select
                      id="version_stage"
                      name="version_stage"
                      defaultValue={primaryVersion.stage ?? "spark"}
                      className="input"
                    >
                      <option value="spark">Spark</option>
                      <option value="draft">Draft</option>
                      <option value="final">Final</option>
                    </select>

                    <label className="copy" htmlFor="version_title">
                      Version title
                    </label>
                    <input
                      id="version_title"
                      name="version_title"
                      defaultValue={primaryVersion.title ?? ""}
                      className="input"
                    />

                    <label className="copy" htmlFor="lyrics">
                      Lyrics
                    </label>
                    <textarea
                      id="lyrics"
                      name="lyrics"
                      defaultValue={primaryVersion.lyrics ?? ""}
                      className="textarea"
                      rows={14}
                    />

                    <label
                      className="copy"
                      htmlFor="arrangement_notes"
                    >
                      Arrangement notes
                    </label>
                    <textarea
                      id="arrangement_notes"
                      name="arrangement_notes"
                      defaultValue={
                        primaryVersion.arrangement_notes ?? ""
                      }
                      className="textarea"
                      rows={7}
                    />

                    <label
                      className="copy"
                      htmlFor="story_behind_song"
                    >
                      Story behind the song
                    </label>
                    <textarea
                      id="story_behind_song"
                      name="story_behind_song"
                      defaultValue={
                        primaryVersion.story_behind_song ?? ""
                      }
                      className="textarea"
                      rows={7}
                    />
                  </>
                ) : (
                  <p className="copy">
                    No version found for this song yet.
                  </p>
                )}
              </div>
            </details>

            <details className="card" style={{ marginTop: "1rem" }}>
              <summary
                className="h3"
                style={{ cursor: "pointer" }}
              >
                Writer note and process history
              </summary>

              <div style={{ marginTop: "1rem" }}>
                <label className="copy" htmlFor="note_title">
                  Note title
                </label>
                <input
                  id="note_title"
                  name="note_title"
                  defaultValue={latestNote?.title ?? ""}
                  className="input"
                />

                <label className="copy" htmlFor="note_body">
                  Note body
                </label>
                <textarea
                  id="note_body"
                  name="note_body"
                  defaultValue={latestNote?.body ?? ""}
                  className="textarea"
                  rows={9}
                />

                <label
                  className="copy"
                  htmlFor="note_visibility"
                >
                  Note visibility
                </label>
                <select
                  id="note_visibility"
                  name="note_visibility"
                  defaultValue={
                    latestNote?.visibility ?? "private"
                  }
                  className="input"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </details>

            <div
              className="button-row"
              style={{ marginTop: "1rem" }}
            >
              <button type="submit" className="button primary">
                Save song details
              </button>

              <Link href={`/songs/${slug}`} className="button">
                Cancel changes
              </Link>
            </div>
          </form>
        </section>

        <section id="captured-materials" className="card">
          <div className="eyebrow">Captured materials</div>
          <h2 className="h2">Recordings, documents, and notes</h2>
          <p className="copy" style={{ maxWidth: 880 }}>
            Everything gathered during Spark Capture stays with this song.
          </p>

          <div
            className="two-col"
            style={{ alignItems: "start", marginTop: "1rem" }}
          >
            <div className="subsection">
              <h3 className="h3">Files</h3>
              {song.attachments?.length ? (
                <div className="stack-list">
                  {(song.attachments ?? []).map((attachment: any) => {
                    const assetUrl = buildPublicAssetUrl(
                      attachment.storage_path,
                      attachment.bucket || "song-assets",
                    );

                    return (
                      <div key={attachment.id}>
                        <strong>
                          {attachment.title ||
                            (attachment.file_type === "audio"
                              ? "Audio recording"
                              : "Captured document")}
                        </strong>
                        <div
                          className="copy"
                          style={{ fontSize: "0.86rem", marginTop: "0.2rem" }}
                        >
                          {attachment.file_type === "audio"
                            ? "Audio"
                            : attachment.file_type === "pdf"
                              ? "PDF"
                              : "Document"}
                          {attachment.created_at
                            ? ` · ${new Date(attachment.created_at).toLocaleDateString()}`
                            : ""}
                        </div>
                        {attachment.file_type === "audio" && assetUrl ? (
                          <audio
                            controls
                            preload="metadata"
                            className="audioPlayer"
                            style={{ marginTop: "0.55rem" }}
                          >
                            <source
                              src={assetUrl}
                              type={attachment.mime_type || "audio/mpeg"}
                            />
                          </audio>
                        ) : assetUrl ? (
                          <div style={{ marginTop: "0.55rem" }}>
                            <a
                              className="textLink"
                              href={assetUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open file
                            </a>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="copy">No recordings or documents yet.</p>
              )}
              {supportingAttachments.length ? (
                <p className="copy" style={{ fontSize: "0.86rem" }}>
                  {supportingAttachments.length} supporting document
                  {supportingAttachments.length === 1 ? "" : "s"} attached.
                </p>
              ) : null}
            </div>

            <div className="subsection">
              <h3 className="h3">Notes</h3>
              {song.writer_notes?.length ? (
                <div className="stack-list">
                  {[...(song.writer_notes ?? [])]
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
                    )
                    .map((note: any) => (
                      <div key={note.id}>
                        <strong>{note.title || "Capture note"}</strong>
                        <p
                          className="copy"
                          style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}
                        >
                          {note.body}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="copy">No additional notes yet.</p>
              )}
            </div>
          </div>
        </section>

        <section id="intelligence">
          <div
            className="card"
            style={{
              marginBottom: "1rem",
              border:
                "1px solid rgba(220, 182, 92, 0.38)",
              background:
                "linear-gradient(145deg, rgba(151, 106, 40, 0.12), rgba(255,255,255,0.025))",
            }}
          >
            <div className="eyebrow">Understand the song</div>
            <h2 className="h2">
              Recording, transcript, intelligence, audience, and tasks
            </h2>

            <p className="copy" style={{ maxWidth: 900 }}>
              Use the words, notes, documents, and recordings already saved
              with this song. Audio can add evidence, but it is not required
              before Song Intelligence can identify strengths, development
              opportunities, audience fit, Muse direction, and practical next
              steps.
            </p>
          </div>

          <SongIntelligencePanel
            songId={song.id}
            slug={slug}
            audioAttachments={audioAttachments}
            transcripts={song.song_transcripts ?? []}
            audienceMetrics={audienceMetrics}
            hasCapturedText={hasCapturedText}
            analysisStage={
              song.current_stage === "draft" || song.current_stage === "final"
                ? song.current_stage
                : "spark"
            }
          />
        </section>

        <section id="muses">
          <div
            className="card"
            style={{
              marginBottom: "1rem",
              border:
                "1px solid rgba(156, 137, 220, 0.46)",
              background:
                "linear-gradient(145deg, rgba(86, 67, 145, 0.15), rgba(255,255,255,0.025))",
            }}
          >
            <div className="eyebrow">Collaborate</div>
            <h2 className="h2">Your Creative Council</h2>

            <p className="copy" style={{ maxWidth: 900 }}>
              {hasAssignedMuse
                ? `Begin with ${assignedMuse?.name ?? "the assigned Muse"}, the song’s primary creative partner. Then invite another Muse to reveal how a different specialty changes the recommendation.`
                : "Song Intelligence can recommend the strongest lead Muse for this Spark. You can also choose any Muse directly when you are ready to collaborate."}
            </p>
          </div>

          <MuseChatPanel
            songId={song.id}
            songTitle={songTitle}
            defaultMuseSlug={assignedMuseSlug}
            initialMuseSlug={requestedMuseSlug}
            initialQuestion={initialMuseQuestion}
            museOptions={MUSE_OPTIONS}
          />
        </section>

        <section
          id="share"
          className="card"
          style={{
            border: "1px solid rgba(220, 182, 92, 0.42)",
            background:
              "linear-gradient(145deg, rgba(151, 106, 40, 0.12), rgba(255,255,255,0.025))",
          }}
        >
          <div className="eyebrow">Share and listen</div>
          <h2 className="h2">Let the song meet its listeners</h2>

          <p className="copy" style={{ maxWidth: 900 }}>
            This song is currently <strong>{song.status}</strong>. Use
            the song details section to change its visibility, then
            preview the public page and review how listeners respond.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "0.8rem",
              marginTop: "0.9rem",
            }}
          >
            {[
              ["Total listens", audienceMetrics.totalListens],
              ["Unique listeners", audienceMetrics.uniqueListeners],
              ["Last 7 days", audienceMetrics.recentListens],
              [
                "Last listened",
                audienceMetrics.lastListenedAt
                  ? new Date(
                      audienceMetrics.lastListenedAt,
                    ).toLocaleDateString()
                  : "Not yet",
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  padding: "0.9rem",
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  background: "rgba(0,0,0,0.12)",
                }}
              >
                <div className="eyebrow">{label}</div>
                <div
                  className="h3"
                  style={{ margin: "0.35rem 0 0" }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="button-row" style={{ marginTop: "1rem" }}>
            <Link
              href={`/songs/${slug}`}
              className="button primary"
            >
              Preview public song page
            </Link>

            <Link href="/listen" className="button">
              Open the Jukebox
            </Link>
          </div>
        </section>

        {primaryVersion ? (
          <ProductionCreditsEditor
            songId={song.id}
            songVersionId={primaryVersion.id}
            slug={slug}
            versionNumber={primaryVersion.version_number}
            existingCredits={productionCredits}
            defaultSongwriter={
              song.songwriter_name?.trim() ||
              profile?.display_name?.trim() ||
              null
            }
          />
        ) : (
          <section id="credits" className="card">
            <div className="eyebrow">Production credits</div>
            <h2 className="h2">
              Add a song version before adding credits
            </h2>
          </section>
        )}

        <SongDangerZone
          songId={song.id}
          songTitle={songTitle}
          currentStage={song.current_stage}
        />
      </div>
    </section>
  );
}
