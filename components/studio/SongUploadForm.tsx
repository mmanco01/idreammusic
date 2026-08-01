"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { SongStage, Visibility } from "@/lib/types";

type MuseOption = {
  slug: string;
  name: string;
  label: string;
};

type Props = {
  defaultMuseSlug?: string;
  lockedMuse?: boolean;
  museOptions: MuseOption[];
  existingSongId?: string | null;
  initialStage?: SongStage;
};

type DuplicateSong = {
  id: string;
  slug: string;
  title: string;
  current_stage: string | null;
  status: string | null;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function sanitizeFileName(name: string) {
  const clean = name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  return clean.replace(/-+/g, "-");
}

function normalizeSongTitle(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function SongUploadForm({
  defaultMuseSlug,
  lockedMuse = false,
  museOptions,
  existingSongId = null,
  initialStage = "spark",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<SongStage>(initialStage);
  const [museSlug, setMuseSlug] = useState(
    defaultMuseSlug || museOptions[0]?.slug || "",
  );
  const [hookLine, setHookLine] = useState("");
  const [summary, setSummary] = useState("");
  const [writerNote, setWriterNote] = useState("");
  const [noteVisibility, setNoteVisibility] =
    useState<Visibility>("private");
  const [sharePublicly, setSharePublicly] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [status, setStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);

  const [duplicateSong, setDuplicateSong] =
    useState<DuplicateSong | null>(null);
  const [allowDuplicateTitle, setAllowDuplicateTitle] = useState(false);

  const selectedMuse = useMemo(
    () => museOptions.find((option) => option.slug === museSlug),
    [museOptions, museSlug],
  );

  useEffect(() => {
    setStage(initialStage);
  }, [initialStage]);

  useEffect(() => {
    setDuplicateSong(null);
    setAllowDuplicateTitle(false);
  }, [title]);

  useEffect(() => {
    if (!hasSupabaseEnv()) return;

    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setIsSignedIn(Boolean(data.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function findDuplicateSong(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    proposedTitle: string,
  ): Promise<DuplicateSong | null> {
    const titleKey = normalizeSongTitle(proposedTitle);

    if (!titleKey) {
      return null;
    }

    const { data: ownedSongs, error } = await supabase
      .from("songs")
      .select(
        "id, slug, title_working, title_final, current_stage, status, created_at",
      )
      .eq("owner_user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Duplicate-song check failed: ${error.message}`);
    }

    const match = (ownedSongs ?? []).find((song) => {
      const workingKey = normalizeSongTitle(song.title_working ?? "");
      const finalKey = normalizeSongTitle(song.title_final ?? "");

      return workingKey === titleKey || finalKey === titleKey;
    });

    if (!match) {
      return null;
    }

    return {
      id: match.id,
      slug: match.slug,
      title:
        match.title_final ||
        match.title_working ||
        proposedTitle ||
        "Untitled song",
      current_stage: match.current_stage ?? null,
      status: match.status ?? null,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      setStatus("error");
      setMessage(
        "Supabase is not configured yet. Add your public URL and anon key first.",
      );
      return;
    }

    if (!file) {
      setStatus("error");
      setMessage("Choose an audio file before uploading.");
      return;
    }

    try {
      setStatus("saving");
      setMessage("");
      setDuplicateSong(null);

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("error");
        setMessage("Sign in first, then come right back to upload.");
        return;
      }

      const { data: creatorProfile, error: creatorProfileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (creatorProfileError) {
        console.warn(
          "Unable to load the signed-in creator name:",
          creatorProfileError.message,
        );
      }

      const creatorName = creatorProfile?.display_name?.trim() || null;

      let songId = existingSongId;
      let songSlug: string | null = null;
      let resolvedMuseSlug = museSlug;

      if (existingSongId) {
        const { data: existingSong, error: existingSongError } =
          await supabase
            .from("songs")
            .select(
              `
                id,
                slug,
                muse_id,
                owner_user_id,
                muses (
                  id,
                  slug,
                  name
                )
              `,
            )
            .eq("id", existingSongId)
            .eq("owner_user_id", user.id)
            .is("deleted_at", null)
            .single();

        if (existingSongError || !existingSong) {
          throw (
            existingSongError ||
            new Error("Could not load the existing song.")
          );
        }

        songSlug = existingSong.slug;

        const songMuse = existingSong.muses?.[0];

        if (songMuse?.slug) {
          resolvedMuseSlug = songMuse.slug;
          setMuseSlug(songMuse.slug);
        }

        const { data: currentVersions, error: versionsError } =
          await supabase
            .from("song_versions")
            .select("version_number")
            .eq("song_id", existingSongId)
            .order("version_number", { ascending: false })
            .limit(1);

        if (versionsError) {
          throw versionsError;
        }

        const nextVersionNumber =
          (currentVersions?.[0]?.version_number ?? 0) + 1;

        // One song should have only one primary version, regardless of stage.
        const { error: clearPrimaryError } = await supabase
          .from("song_versions")
          .update({ is_stage_primary: false })
          .eq("song_id", existingSongId)
          .eq("is_stage_primary", true);

        if (clearPrimaryError) {
          throw clearPrimaryError;
        }

        const { data: version, error: versionError } = await supabase
          .from("song_versions")
          .insert({
            song_id: existingSongId,
            version_number: nextVersionNumber,
            stage,
            title,
            lyrics: summary || null,
            visibility: sharePublicly ? "public" : "private",
            is_stage_primary: true,
            arrangement_notes: `Added as a ${stage} version from the song page.`,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (versionError || !version) {
          throw (
            versionError || new Error("Could not create the new version.")
          );
        }

        const storagePath = `${resolvedMuseSlug}/${user.id}/${existingSongId}/${Date.now()}-${sanitizeFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from("song-assets")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "audio/mpeg",
          });

        if (uploadError) {
          throw uploadError;
        }

        const { error: attachmentError } = await supabase
          .from("attachments")
          .insert({
            song_id: existingSongId,
            song_version_id: version.id,
            uploaded_by: user.id,
            file_type: "audio",
            bucket: "song-assets",
            storage_path: storagePath,
            mime_type: file.type || "audio/mpeg",
            title,
          });

        if (attachmentError) {
          throw attachmentError;
        }

        if (writerNote.trim()) {
          const { error: noteError } = await supabase
            .from("writer_notes")
            .insert({
              song_id: existingSongId,
              song_version_id: version.id,
              author_user_id: user.id,
              title: `${title} note`,
              body: writerNote.trim(),
              visibility: noteVisibility,
            });

          if (noteError) {
            throw noteError;
          }
        }

        const { error: songUpdateError } = await supabase
          .from("songs")
          .update({
            current_stage: stage,
            title_final: stage === "final" ? title : undefined,
            summary: summary || undefined,
            hook_line: hookLine || undefined,
            status: sharePublicly ? "published" : "private",
            published_at: sharePublicly
              ? new Date().toISOString()
              : undefined,
          })
          .eq("id", existingSongId)
          .eq("owner_user_id", user.id);

        if (songUpdateError) {
          throw songUpdateError;
        }
      } else {
        if (!allowDuplicateTitle) {
          const duplicate = await findDuplicateSong(
            supabase,
            user.id,
            title,
          );

          if (duplicate) {
            setDuplicateSong(duplicate);
            setStatus("idle");
            return;
          }
        }

        const { data: muse, error: museError } = await supabase
          .from("muses")
          .select("id, name")
          .eq("slug", museSlug)
          .single();

        if (museError || !muse) {
          throw new Error(
            "Could not find that Muse in Supabase. Run the seed file first.",
          );
        }

        const baseSlug =
          slugify(title || file.name.replace(/\.[^.]+$/, "")) || "song";
        const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
        const now = new Date().toISOString();

        const { data: insertedSong, error: songError } = await supabase
          .from("songs")
          .insert({
            owner_user_id: user.id,
            title_working: title,
            title_final: stage === "final" ? title : null,
            slug: uniqueSlug,
            current_stage: stage,
            status: sharePublicly ? "published" : "private",
            songwriter_name: creatorName,
            muse_id: muse.id,
            summary: summary || null,
            hook_line: hookLine || null,
            published_at: sharePublicly ? now : null,
          })
          .select("id, slug")
          .single();

        if (songError || !insertedSong) {
          throw songError || new Error("Could not create the song record.");
        }

        songId = insertedSong.id;
        songSlug = insertedSong.slug;

        const { error: stageError } = await supabase
          .from("song_stages")
          .insert({
            song_id: songId,
            stage,
            is_current: true,
          });

        if (stageError) {
          throw stageError;
        }

        const { data: version, error: versionError } = await supabase
          .from("song_versions")
          .insert({
            song_id: songId,
            version_number: 1,
            stage,
            title,
            visibility: sharePublicly ? "public" : "private",
            is_stage_primary: true,
            arrangement_notes: `Uploaded from the ${muse.name} Muse page.`,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (versionError || !version) {
          throw (
            versionError || new Error("Could not create the first version.")
          );
        }

        const storagePath = `${museSlug}/${user.id}/${songId}/${Date.now()}-${sanitizeFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from("song-assets")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "audio/mpeg",
          });

        if (uploadError) {
          throw uploadError;
        }

        const { error: attachmentError } = await supabase
          .from("attachments")
          .insert({
            song_id: songId,
            song_version_id: version.id,
            uploaded_by: user.id,
            file_type: "audio",
            bucket: "song-assets",
            storage_path: storagePath,
            mime_type: file.type || "audio/mpeg",
            title,
          });

        if (attachmentError) {
          throw attachmentError;
        }

        if (writerNote.trim()) {
          const { error: noteError } = await supabase
            .from("writer_notes")
            .insert({
              song_id: songId,
              song_version_id: version.id,
              author_user_id: user.id,
              title: `${title} note`,
              body: writerNote.trim(),
              visibility: noteVisibility,
            });

          if (noteError) {
            throw noteError;
          }
        }
      }

      setStatus("success");
      setMessage(
        existingSongId
          ? "Version added. Opening the song page now…"
          : "Upload complete. Opening the song page now…",
      );

      router.push(`/songs/${songSlug}`);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Upload failed.",
      );
    }
  }

  const isExistingSongFlow = Boolean(existingSongId);

  return (
    <div className="card formCard">
      <div className="eyebrow">
        {isExistingSongFlow ? "Add version" : "Upload a song"}
      </div>

      <h2 className="h3">
        {isExistingSongFlow
          ? `Add a ${stage} version`
          : selectedMuse
            ? `Catch a song in ${selectedMuse.name}`
            : "Share your music"}
      </h2>

      <p className="copy">
        {isExistingSongFlow
          ? "This adds a new version to the existing song instead of creating a new song."
          : "Authenticated users can upload directly here. The app checks for an existing song with the same title before creating a new master song."}
      </p>

      {!hasSupabaseEnv() ? (
        <div className="statusMessage statusError">
          Add your Supabase URL and anon key to turn uploads on in this
          build.
        </div>
      ) : null}

      {hasSupabaseEnv() && !isSignedIn ? (
        <div className="statusMessage">
          You are not signed in yet.{" "}
          <Link
            className="textLink"
            href={`/auth/sign-in?next=${encodeURIComponent(pathname)}`}
          >
            Sign in here
          </Link>{" "}
          and then come right back to upload.
        </div>
      ) : null}

      {duplicateSong ? (
        <div
          className="statusMessage statusError"
          style={{ marginTop: "1rem" }}
        >
          <strong>
            “{duplicateSong.title}” already exists in your catalog.
          </strong>

          <div style={{ marginTop: "0.45rem" }}>
            Existing stage:{" "}
            {duplicateSong.current_stage || "unknown"} · Status:{" "}
            {duplicateSong.status || "unknown"}
          </div>

          <div
            className="button-row"
            style={{ marginTop: "0.8rem" }}
          >
            <Link
              className="button primary"
              href={`/studio/capture?song=${duplicateSong.id}&stage=${stage}`}
            >
              Add this as a new version
            </Link>

            <Link
              className="button"
              href={`/studio/songs/${duplicateSong.slug}/edit`}
            >
              Open existing song
            </Link>

            <button
              className="button"
              type="button"
              onClick={() => {
                setAllowDuplicateTitle(true);
                setDuplicateSong(null);
                setStatus("idle");
                setMessage(
                  "Duplicate-title override enabled. Submit again to create a separate song.",
                );
              }}
            >
              Create separate song anyway
            </button>
          </div>
        </div>
      ) : null}

      <form className="form-grid" onSubmit={handleSubmit}>
        {!lockedMuse && !isExistingSongFlow ? (
          <label>
            <span className="fieldLabel">Muse</span>
            <select
              value={museSlug}
              onChange={(event) => setMuseSlug(event.target.value)}
              required
            >
              {museOptions.map((muse) => (
                <option key={muse.slug} value={muse.slug}>
                  {muse.name} — {muse.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div>
            <span className="fieldLabel">Muse</span>
            <div className="pillRow">
              <span className="pill">
                {selectedMuse?.name ?? museSlug}
              </span>
              {selectedMuse?.label ? (
                <span className="pill">{selectedMuse.label}</span>
              ) : null}
            </div>
          </div>
        )}

        <label>
          <span className="fieldLabel">Stage</span>
          <select
            value={stage}
            onChange={(event) =>
              setStage(event.target.value as SongStage)
            }
            disabled={isExistingSongFlow && initialStage !== "spark"}
          >
            <option value="spark">Spark</option>
            <option value="draft">First draft</option>
            <option value="final">Final song</option>
          </select>
        </label>

        <label className="full">
          <span className="fieldLabel">Song title</span>
          <input
            type="text"
            required
            placeholder="Midnight Harbor"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label>
          <span className="fieldLabel">Hook line</span>
          <input
            type="text"
            placeholder="Optional one-line spark"
            value={hookLine}
            onChange={(event) => setHookLine(event.target.value)}
          />
        </label>

        <label>
          <span className="fieldLabel">Short summary</span>
          <input
            type="text"
            placeholder="Optional one-sentence description"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </label>

        <label className="full">
          <span className="fieldLabel">Music file</span>
          <input
            type="file"
            accept="audio/*"
            required
            onChange={(event) =>
              setFile(event.target.files?.[0] ?? null)
            }
          />
        </label>

        <label className="full">
          <span className="fieldLabel">Writer note</span>
          <textarea
            rows={5}
            placeholder="Optional process note, dream note, or context for listeners."
            value={writerNote}
            onChange={(event) => setWriterNote(event.target.value)}
          />
        </label>

        <label>
          <span className="fieldLabel">Writer note visibility</span>
          <select
            value={noteVisibility}
            onChange={(event) =>
              setNoteVisibility(event.target.value as Visibility)
            }
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>

        <label className="checkboxRow">
          <input
            type="checkbox"
            checked={sharePublicly}
            onChange={(event) =>
              setSharePublicly(event.target.checked)
            }
          />
          <span>
            {isExistingSongFlow
              ? "Show this version publicly right away"
              : "Show this upload publicly on the Muse page right away"}
          </span>
        </label>

        <div className="full button-row">
          <button
            className="button primary"
            type="submit"
            disabled={status === "saving" || !isSignedIn}
          >
            {status === "saving"
              ? "Uploading…"
              : isExistingSongFlow
                ? "Add version"
                : "Upload song"}
          </button>

          <Link
            className="button"
            href={`/auth/sign-in?next=${encodeURIComponent(pathname)}`}
          >
            Need to sign in?
          </Link>
        </div>
      </form>

      {message ? (
        <div
          className={`statusMessage ${
            status === "error" ? "statusError" : "statusSuccess"
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
