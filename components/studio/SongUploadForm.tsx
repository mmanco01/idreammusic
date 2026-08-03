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
  existingSongId: string;
  initialStage?: SongStage;
};

function sanitizeFileName(name: string) {
  const clean = name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  return clean.replace(/-+/g, "-");
}

export function SongUploadForm({
  defaultMuseSlug,
  lockedMuse = false,
  museOptions,
  existingSongId,
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

  const selectedMuse = useMemo(
    () => museOptions.find((option) => option.slug === museSlug),
    [museOptions, museSlug],
  );

  useEffect(() => {
    setStage(initialStage);
  }, [initialStage]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      setStatus("error");
      setMessage(
        "Supabase is not configured yet. Add your public URL and anon key first.",
      );
      return;
    }

    if (!existingSongId) {
      setStatus("error");
      setMessage("New songs now begin in the unified Spark Capture flow.");
      router.push("/studio/capture");
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

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("error");
        setMessage("Sign in first, then come right back to upload.");
        return;
      }

      let songSlug: string | null = null;
      let resolvedMuseSlug = museSlug;

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

      setStatus("success");
      setMessage("Version added. Opening the song page now…");

      router.push(`/songs/${songSlug}`);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Upload failed.",
      );
    }
  }

  return (
    <div className="card formCard">
      <div className="eyebrow">Add version</div>

      <h2 className="h3">Add a {stage} version</h2>

      <p className="copy">
        This adds a new version to the existing song instead of creating a new song.
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

      <form className="form-grid" onSubmit={handleSubmit}>
        {!lockedMuse ? (
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
            disabled={initialStage !== "spark"}
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
          <span>Show this version publicly right away</span>
        </label>

        <div className="full button-row">
          <button
            className="button primary"
            type="submit"
            disabled={status === "saving" || !isSignedIn}
          >
            {status === "saving" ? "Uploading…" : "Add version"}
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
