"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import {
  clearSparkCaptureDraft,
  loadSparkCaptureDraft,
  saveSparkCaptureDraft,
  type SparkCaptureDraft,
} from "@/lib/spark-capture-draft";

type MuseOption = {
  slug: string;
  name: string;
  label: string;
};

type Props = {
  museOptions: MuseOption[];
  defaultMuseSlug?: string;
  returnPath?: string;
};

type CaptureFile = {
  id: string;
  file: File;
  source: "upload" | "recording";
  previewUrl?: string;
};

type CaptureNote = {
  id: string;
  title: string;
  body: string;
};

type CaptureStatus = "idle" | "saving" | "success" | "error";

type AttachmentDatabaseType = "audio" | "pdf" | "doc";

const AUDIO_MAX_MB = readPositiveNumber(
  process.env.NEXT_PUBLIC_SPARK_AUDIO_MAX_MB,
  50,
);
const DOCUMENT_MAX_MB = readPositiveNumber(
  process.env.NEXT_PUBLIC_SPARK_DOCUMENT_MAX_MB,
  25,
);
const AUDIO_MAX_BYTES = AUDIO_MAX_MB * 1024 * 1024;
const DOCUMENT_MAX_BYTES = DOCUMENT_MAX_MB * 1024 * 1024;

const ALLOWED_AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "m4a",
  "aac",
  "flac",
  "webm",
  "ogg",
]);

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "txt",
  "rtf",
]);

const ACCEPTED_FILE_TYPES = [
  "audio/*",
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".webm",
  ".ogg",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".rtf",
].join(",");

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
  return clean.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isAudioFile(file: File) {
  return (
    file.type.startsWith("audio/") ||
    ALLOWED_AUDIO_EXTENSIONS.has(fileExtension(file.name))
  );
}

function isDocumentFile(file: File) {
  return ALLOWED_DOCUMENT_EXTENSIONS.has(fileExtension(file.name));
}

function attachmentDatabaseType(file: File): AttachmentDatabaseType {
  if (isAudioFile(file)) return "audio";
  return fileExtension(file.name) === "pdf" ? "pdf" : "doc";
}

function attachmentLabel(file: File) {
  if (isAudioFile(file)) return "Audio";
  if (fileExtension(file.name) === "pdf") return "PDF";
  return "Document";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

function recordingExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function chooseRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/webm",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function createUntitledSparkTitle() {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  return `Untitled Spark — ${date}`;
}

function validateCaptureFile(file: File): string | null {
  if (!isAudioFile(file) && !isDocumentFile(file)) {
    return `${file.name} is not a supported audio, PDF, Word, text, or RTF file.`;
  }

  const maxBytes = isAudioFile(file) ? AUDIO_MAX_BYTES : DOCUMENT_MAX_BYTES;
  const maxMb = isAudioFile(file) ? AUDIO_MAX_MB : DOCUMENT_MAX_MB;

  if (file.size > maxBytes) {
    return `${file.name} is ${formatBytes(file.size)}. The maximum ${
      isAudioFile(file) ? "audio" : "document"
    } file size is ${maxMb} MB.`;
  }

  return null;
}

function createPreviewUrl(file: File) {
  return isAudioFile(file) ? URL.createObjectURL(file) : undefined;
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function uploadFileWithProgress({
  file,
  bucket,
  storagePath,
  accessToken,
  onProgress,
}: {
  file: File;
  bucket: string;
  storagePath: string;
  accessToken: string;
  onProgress: (percent: number) => void;
}) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!projectUrl || !anonKey) {
    throw new Error("Supabase upload settings are not configured.");
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const objectUrl = `${projectUrl}/storage/v1/object/${encodeURIComponent(
      bucket,
    )}/${encodeStoragePath(storagePath)}`;

    xhr.open("POST", objectUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.setRequestHeader("Cache-Control", "max-age=3600");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror = () => reject(new Error("The upload connection failed."));
    xhr.onabort = () => reject(new Error("The upload was cancelled."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      let detail = xhr.responseText || xhr.statusText || "Upload failed.";
      try {
        const parsed = JSON.parse(xhr.responseText) as {
          message?: string;
          error?: string;
        };
        detail = parsed.message || parsed.error || detail;
      } catch {
        // Keep the raw response when it is not JSON.
      }

      reject(new Error(detail));
    };

    xhr.send(file);
  });
}

export function SparkCaptureForm({
  museOptions,
  defaultMuseSlug = "",
  returnPath = "/studio/capture",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const discardRecordingRef = useRef(false);
  const mountedRef = useRef(true);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSnapshotRef = useRef<SparkCaptureDraft | null>(null);

  const [title, setTitle] = useState("");
  const [sparkText, setSparkText] = useState("");
  const [museSlug, setMuseSlug] = useState(defaultMuseSlug);
  const [notes, setNotes] = useState<CaptureNote[]>([]);
  const [files, setFiles] = useState<CaptureFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );
  const [activeUploadLabel, setActiveUploadLabel] = useState("");
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [message, setMessage] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [createdSongSlug, setCreatedSongSlug] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");

  const selectedMuse = useMemo(
    () => museOptions.find((option) => option.slug === museSlug) ?? null,
    [museOptions, museSlug],
  );

  const currentCapturePath = returnPath || pathname || "/studio/capture";

  const signInHref = `/auth/sign-in?next=${encodeURIComponent(
    currentCapturePath,
  )}`;

  const hasCaptureContent = useMemo(
    () =>
      title.trim().length > 0 ||
      sparkText.trim().length > 0 ||
      notes.some((note) => note.title.trim() || note.body.trim()) ||
      files.length > 0,
    [files.length, notes, sparkText, title],
  );

  useEffect(() => {
    if (!hasSupabaseEnv()) return;

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setIsSignedIn(Boolean(data.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadSparkCaptureDraft()
      .then((draft) => {
        if (cancelled || !draft) return;

        const restoredFiles = draft.files.map((item) => {
          const previewUrl = createPreviewUrl(item.file);
          if (previewUrl) previewUrlsRef.current.add(previewUrl);

          return {
            id: item.id,
            file: item.file,
            source: item.source,
            previewUrl,
          } satisfies CaptureFile;
        });

        setTitle(draft.title);
        setSparkText(draft.sparkText);
        setMuseSlug(draft.museSlug || defaultMuseSlug);
        setNotes(draft.notes);
        setFiles(restoredFiles);
        setDraftNotice(
          "Recovered your unfinished Spark from this browser. It will remain here while you sign in.",
        );
      })
      .catch((error) => {
        console.warn("Unable to restore the local Spark draft:", error);
      })
      .finally(() => {
        if (!cancelled) setDraftReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [defaultMuseSlug]);

  useEffect(() => {
    if (!draftReady) return;

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }

    if (!hasCaptureContent) {
      draftSnapshotRef.current = null;
      void clearSparkCaptureDraft();
      return;
    }

    const snapshot: SparkCaptureDraft = {
      version: 1,
      savedAt: Date.now(),
      title,
      sparkText,
      museSlug,
      notes,
      files: files.map((item) => ({
        id: item.id,
        file: item.file,
        source: item.source,
      })),
    };

    draftSnapshotRef.current = snapshot;
    draftSaveTimerRef.current = setTimeout(() => {
      void saveSparkCaptureDraft(snapshot).catch((error) => {
        console.warn("Unable to save the local Spark draft:", error);
      });
    }, 500);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [draftReady, files, hasCaptureContent, museSlug, notes, sparkText, title]);

  useEffect(() => {
    if (!draftReady) return;

    const saveLatestDraft = () => {
      const draft = draftSnapshotRef.current;
      if (draft) void saveSparkCaptureDraft({ ...draft, savedAt: Date.now() });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveLatestDraft();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", saveLatestDraft);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", saveLatestDraft);
    };
  }, [draftReady]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      discardRecordingRef.current = true;

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
      stopMediaStream();
      clearRecordingTimer();
    };
  }, []);

  function clearRecordingTimer() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  async function persistCurrentDraft() {
    if (!hasCaptureContent) return;

    const draft: SparkCaptureDraft = {
      version: 1,
      savedAt: Date.now(),
      title,
      sparkText,
      museSlug,
      notes,
      files: files.map((item) => ({
        id: item.id,
        file: item.file,
        source: item.source,
      })),
    };

    draftSnapshotRef.current = draft;
    await saveSparkCaptureDraft(draft);
  }

  async function continueToSignIn() {
    try {
      await persistCurrentDraft();
      setDraftNotice(
        "Your unfinished Spark is saved in this browser. Sign in, then you will return here.",
      );
      router.push(signInHref);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? `Your Spark could not be stored on this device: ${error.message}`
          : "Your Spark could not be stored on this device.",
      );
    }
  }

  function addFiles(
    incomingFiles: File[],
    source: CaptureFile["source"],
  ) {
    const errors: string[] = [];
    const accepted: CaptureFile[] = [];

    incomingFiles.forEach((file) => {
      const error = validateCaptureFile(file);
      if (error) {
        errors.push(error);
        return;
      }

      const previewUrl = createPreviewUrl(file);
      if (previewUrl) previewUrlsRef.current.add(previewUrl);

      accepted.push({
        id: makeId("file"),
        file,
        source,
        previewUrl,
      });
    });

    if (accepted.length) {
      setFiles((current) => [...current, ...accepted]);
    }

    if (errors.length) {
      setStatus("error");
      setMessage(errors.join(" "));
    } else {
      setStatus("idle");
      setMessage("");
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []), "upload");
    event.target.value = "";
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const item = current.find((candidate) => candidate.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrlsRef.current.delete(item.previewUrl);
      }
      return current.filter((candidate) => candidate.id !== id);
    });

    setUploadProgress((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function addNote() {
    setNotes((current) => [
      ...current,
      { id: makeId("note"), title: "", body: "" },
    ]);
  }

  function updateNote(id: string, patch: Partial<Omit<CaptureNote, "id">>) {
    setNotes((current) =>
      current.map((note) => (note.id === id ? { ...note, ...patch } : note)),
    );
  }

  function removeNote(id: string) {
    setNotes((current) => current.filter((note) => note.id !== id));
  }

  async function startRecording() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatus("error");
      setMessage("This browser does not support direct microphone recording.");
      return;
    }

    try {
      setStatus("idle");
      setMessage("");
      recordedChunksRef.current = [];
      discardRecordingRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = chooseRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        if (!mountedRef.current) return;
        setStatus("error");
        setMessage(
          "The recording stopped because the browser reported a microphone error.",
        );
        setIsRecording(false);
        setIsPaused(false);
        clearRecordingTimer();
        stopMediaStream();
      };

      recorder.onstop = () => {
        const resolvedMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(recordedChunksRef.current, {
          type: resolvedMime,
        });
        const extension = recordingExtension(resolvedMime);
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const recordingFile = new File(
          [blob],
          `spark-recording-${stamp}.${extension}`,
          { type: resolvedMime },
        );

        if (
          mountedRef.current &&
          !discardRecordingRef.current &&
          blob.size > 0
        ) {
          addFiles([recordingFile], "recording");
        }

        discardRecordingRef.current = false;
        mediaRecorderRef.current = null;
        clearRecordingTimer();
        stopMediaStream();

        if (mountedRef.current) {
          setIsRecording(false);
          setIsPaused(false);
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      clearRecordingTimer();
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? `Microphone access failed: ${error.message}`
          : "Microphone access failed.",
      );
      stopMediaStream();
    }
  }

  function pauseOrResumeRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording") {
      recorder.pause();
      setIsPaused(true);
      clearRecordingTimer();
    } else if (recorder.state === "paused") {
      recorder.resume();
      setIsPaused(false);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  function resetCapture(skipConfirmation = false) {
    if (
      !skipConfirmation &&
      hasCaptureContent &&
      !window.confirm("Start over and remove everything currently entered?")
    ) {
      return;
    }

    if (isRecording) {
      discardRecordingRef.current = true;
      stopRecording();
    }

    files.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrlsRef.current.delete(item.previewUrl);
      }
    });

    setTitle("");
    setSparkText("");
    setMuseSlug(defaultMuseSlug);
    setNotes([]);
    setFiles([]);
    setUploadProgress({});
    setActiveUploadLabel("");
    setStatus("idle");
    setMessage("");
    setCreatedSongSlug(null);
    setRecordingSeconds(0);
    setDraftNotice("");
    draftSnapshotRef.current = null;
    void clearSparkCaptureDraft();
  }

  async function uploadCaptureFile({
    item,
    userId,
    songId,
    versionId,
    resolvedMuseSlug,
    accessToken,
    sortOrder,
  }: {
    item: CaptureFile;
    userId: string;
    songId: string;
    versionId: string;
    resolvedMuseSlug: string;
    accessToken: string;
    sortOrder: number;
  }) {
    const supabase = createClient();
    const bucket = "song-assets";
    const storagePath = `${resolvedMuseSlug}/${userId}/${songId}/${Date.now()}-${sortOrder}-${sanitizeFileName(
      item.file.name,
    )}`;

    setUploadProgress((current) => ({ ...current, [item.id]: 0 }));

    await uploadFileWithProgress({
      file: item.file,
      bucket,
      storagePath,
      accessToken,
      onProgress(percent) {
        setUploadProgress((current) => ({
          ...current,
          [item.id]: percent,
        }));
      },
    });

    const { error: attachmentError } = await supabase
      .from("attachments")
      .insert({
        song_id: songId,
        song_version_id: versionId,
        uploaded_by: userId,
        file_type: attachmentDatabaseType(item.file),
        bucket,
        storage_path: storagePath,
        mime_type: item.file.type || "application/octet-stream",
        title: item.file.name,
        description:
          item.source === "recording"
            ? "Recorded in Spark Capture"
            : "Added in Spark Capture",
        sort_order: sortOrder,
      });

    if (attachmentError) {
      await supabase.storage.from(bucket).remove([storagePath]);
      throw attachmentError;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      setStatus("error");
      setMessage("Supabase is not configured yet.");
      return;
    }

    if (!hasCaptureContent) {
      setStatus("error");
      setMessage("Add a title, thought, note, recording, or file first.");
      return;
    }

    if (isRecording) {
      setStatus("error");
      setMessage("Stop the recording before saving the Spark.");
      return;
    }

    const invalidFileMessages = files
      .map((item) => validateCaptureFile(item.file))
      .filter((value): value is string => Boolean(value));

    if (invalidFileMessages.length) {
      setStatus("error");
      setMessage(invalidFileMessages.join(" "));
      return;
    }

    setStatus("saving");
    setMessage("");
    setCreatedSongSlug(null);
    setActiveUploadLabel("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      try {
        await persistCurrentDraft();
        setStatus("idle");
        setMessage(
          "Your unfinished Spark is saved in this browser. Sign in to finish saving it to iDreamMusic.",
        );
        router.push(signInHref);
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? `Your Spark could not be stored on this device: ${error.message}`
            : "Your Spark could not be stored on this device.",
        );
      }
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

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

    if (!accessToken) {
      setStatus("error");
      setMessage("Your sign-in session could not be confirmed. Refresh and try again.");
      return;
    }

    const resolvedTitle = title.trim() || createUntitledSparkTitle();
    const uniqueSlug = `${slugify(resolvedTitle) || "untitled-spark"}-${Date.now().toString(36)}`;
    const firstNoteText = notes.find((note) => note.body.trim())?.body.trim();
    const summarySource = sparkText.trim() || firstNoteText || "";

    let songId: string | null = null;
    let songSlug: string | null = null;
    let versionCreated = false;

    try {
      let museId: string | null = null;

      if (museSlug) {
        const { data: muse, error: museError } = await supabase
          .from("muses")
          .select("id")
          .eq("slug", museSlug)
          .single();

        if (museError || !muse) {
          throw museError || new Error("The selected Muse could not be found.");
        }

        museId = muse.id;
      }

      const { data: insertedSong, error: songError } = await supabase
        .from("songs")
        .insert({
          owner_user_id: user.id,
          title_working: resolvedTitle,
          title_final: null,
          slug: uniqueSlug,
          current_stage: "spark",
          status: "private",
          songwriter_name: creatorName,
          muse_id: museId,
          summary: summarySource.slice(0, 500) || null,
          hook_line: null,
          published_at: null,
        })
        .select("id, slug")
        .single();

      if (songError || !insertedSong) {
        throw songError || new Error("Could not create the Spark record.");
      }

      songId = insertedSong.id;
      songSlug = insertedSong.slug;
      setCreatedSongSlug(songSlug);

      const { error: stageError } = await supabase.from("song_stages").insert({
        song_id: songId,
        stage: "spark",
        is_current: true,
      });

      if (stageError) throw stageError;

      const { data: version, error: versionError } = await supabase
        .from("song_versions")
        .insert({
          song_id: songId,
          version_number: 1,
          stage: "spark",
          title: resolvedTitle,
          lyrics: sparkText.trim() || null,
          visibility: "private",
          is_stage_primary: true,
          arrangement_notes: "Captured in expanded Spark Capture.",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (versionError || !version) {
        throw versionError || new Error("Could not create the first Spark version.");
      }

      versionCreated = true;

      const noteRows = notes
        .filter((note) => note.title.trim() || note.body.trim())
        .map((note, index) => ({
          song_id: songId,
          song_version_id: version.id,
          author_user_id: user.id,
          title: note.title.trim() || `Capture note ${index + 1}`,
          body: note.body.trim() || note.title.trim(),
          visibility: "private",
        }));

      if (noteRows.length) {
        const { error: notesError } = await supabase
          .from("writer_notes")
          .insert(noteRows);

        if (notesError) throw notesError;
      }

      const resolvedMuseSlug = selectedMuse?.slug || "unassigned";
      const failedUploads: string[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const item = files[index];
        setActiveUploadLabel(
          `Uploading ${index + 1} of ${files.length}: ${item.file.name}`,
        );

        try {
          await uploadCaptureFile({
            item,
            userId: user.id,
            songId: insertedSong.id,
            versionId: version.id,
            resolvedMuseSlug,
            accessToken,
            sortOrder: index,
          });
        } catch (error) {
          failedUploads.push(
            `${item.file.name}: ${
              error instanceof Error ? error.message : "upload failed"
            }`,
          );
        }
      }

      setActiveUploadLabel("");

      if (failedUploads.length) {
        setStatus("error");
        setMessage(
          `Your Spark was saved, but ${failedUploads.length} file${
            failedUploads.length === 1 ? "" : "s"
          } did not upload. ${failedUploads.join(" ")}`,
        );
        return;
      }

      setStatus("success");
      setMessage("Your Spark is safe. Opening it now…");
      draftSnapshotRef.current = null;
      await clearSparkCaptureDraft();
      router.push(`/studio/songs/${songSlug}/edit?capture=saved`);
      router.refresh();
    } catch (error) {
      if (songId && !versionCreated) {
        await supabase.from("songs").delete().eq("id", songId);
        setCreatedSongSlug(null);
      }

      setActiveUploadLabel("");
      setStatus("error");
      const prefix = versionCreated
        ? "The Spark was saved, but capture did not fully finish."
        : "The Spark could not be saved.";
      setMessage(
        `${prefix} ${
          error instanceof Error ? error.message : "Please try again."
        }`,
      );
    }
  }

  const recordingClock = `${String(
    Math.floor(recordingSeconds / 60),
  ).padStart(2, "0")}:${String(recordingSeconds % 60).padStart(2, "0")}`;

  if (!draftReady) {
    return (
      <div className="card formCard">
        <div className="eyebrow">Spark Capture</div>
        <h2 className="h2">Checking for an unfinished Spark…</h2>
        <p className="copy">
          Restoring anything this browser kept safe for you.
        </p>
      </div>
    );
  }

  return (
    <form className="card formCard" onSubmit={handleSubmit}>
      <div className="eyebrow">Catch first. Shape later.</div>
      <h2 className="h2">What did you catch?</h2>
      <p className="copy" style={{ maxWidth: 820 }}>
        Start with whatever you have—a title, thought, lyric, melody,
        recording, or document. Audio is optional.
      </p>

      {!hasSupabaseEnv() ? (
        <div className="statusMessage statusError">
          Supabase is not configured in this build.
        </div>
      ) : null}

      {hasSupabaseEnv() && !isSignedIn ? (
        <div className="statusMessage" style={{ marginTop: "1rem" }}>
          <strong>Sign in is required to save.</strong>{" "}
          Your unfinished Spark is stored only in this browser profile while you
          authenticate.
          <div className="button-row" style={{ marginTop: "0.75rem" }}>
            <button
              className="button primary button-small"
              type="button"
              onClick={() => void continueToSignIn()}
            >
              Save this Spark and sign in
            </button>
          </div>
        </div>
      ) : null}

      {draftNotice ? (
        <div className="statusMessage statusSuccess" style={{ marginTop: "1rem" }}>
          {draftNotice}
        </div>
      ) : null}

      <div className="form-grid">
        <label className="full">
          <span className="fieldLabel">
            Spark title <span style={{ opacity: 0.7 }}>(optional)</span>
          </span>
          <input
            id="spark-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="We will create an Untitled Spark if you leave this blank"
            disabled={status === "saving"}
          />
        </label>

        <label className="full">
          <span className="fieldLabel">
            Words, lyrics, story, chords, or thoughts
          </span>
          <textarea
            id="spark-text"
            value={sparkText}
            onChange={(event) => setSparkText(event.target.value)}
            rows={10}
            placeholder="A line, a title, a memory, a chord movement—anything is enough to begin."
            disabled={status === "saving"}
          />
        </label>
      </div>

      <div
        className="two-col"
        style={{ alignItems: "stretch", marginTop: "1rem" }}
      >
        <div className="card">
          <div className="eyebrow">Record something</div>
          <h3 className="h3">Use this device’s microphone</h3>
          <p className="copy">
            Record voice, humming, guitar, piano, or the room around you.
          </p>

          <div className="button-row" style={{ marginTop: "0.75rem" }}>
            {!isRecording ? (
              <button
                type="button"
                className="button primary"
                onClick={() => void startRecording()}
                disabled={status === "saving"}
              >
                Record
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="button"
                  onClick={pauseOrResumeRecording}
                >
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  className="button primary"
                  onClick={stopRecording}
                >
                  Stop and keep
                </button>
                <span className="pill" aria-live="polite">
                  {isPaused ? "Paused" : "Recording"} · {recordingClock}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">Add files</div>
          <h3 className="h3">Audio, PDF, Word, or text</h3>
          <p className="copy">
            Audio files up to {AUDIO_MAX_MB} MB. PDF, Word, text, and RTF
            files up to {DOCUMENT_MAX_MB} MB. You can add more than one.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={handleFileSelection}
            style={{ display: "none" }}
            disabled={status === "saving"}
          />

          <div className="button-row" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={status === "saving"}
            >
              Add recordings or files
            </button>
          </div>
        </div>
      </div>

      {files.length ? (
        <div
          style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}
        >
          {files.map((item, index) => {
            const progress = uploadProgress[item.id];

            return (
              <div key={item.id} className="subsection">
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    justifyContent: "space-between",
                    alignItems: "start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>
                      {index + 1}. {item.file.name}
                    </strong>
                    <div
                      className="copy"
                      style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}
                    >
                      {attachmentLabel(item.file)} · {formatBytes(item.file.size)} ·{" "}
                      {item.source === "recording"
                        ? "recorded here"
                        : "uploaded"}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => removeFile(item.id)}
                    disabled={status === "saving"}
                  >
                    Remove
                  </button>
                </div>

                {item.previewUrl ? (
                  <audio
                    controls
                    preload="metadata"
                    className="audioPlayer"
                    style={{ marginTop: "0.65rem", width: "100%" }}
                  >
                    <source src={item.previewUrl} type={item.file.type} />
                  </audio>
                ) : null}

                {typeof progress === "number" ? (
                  <div style={{ marginTop: "0.65rem" }}>
                    <progress
                      value={progress}
                      max={100}
                      style={{ width: "100%" }}
                    />
                    <div className="copy" style={{ fontSize: "0.8rem" }}>
                      {progress}% uploaded
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ marginTop: "1rem" }}>
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={addNote}
            disabled={status === "saving"}
          >
            Add another note
          </button>
        </div>

        {notes.length ? (
          <div
            style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}
          >
            {notes.map((note, index) => (
              <div key={note.id} className="subsection">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    alignItems: "center",
                  }}
                >
                  <strong>Note {index + 1}</strong>
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => removeNote(note.id)}
                    disabled={status === "saving"}
                  >
                    Remove
                  </button>
                </div>

                <div className="form-grid" style={{ marginTop: "0.65rem" }}>
                  <label className="full">
                    <span className="fieldLabel">
                      Note title <span style={{ opacity: 0.7 }}>(optional)</span>
                    </span>
                    <input
                      id={`note-title-${note.id}`}
                      value={note.title}
                      onChange={(event) =>
                        updateNote(note.id, { title: event.target.value })
                      }
                      disabled={status === "saving"}
                    />
                  </label>

                  <label className="full">
                    <span className="fieldLabel">Note</span>
                    <textarea
                      id={`note-body-${note.id}`}
                      rows={5}
                      value={note.body}
                      onChange={(event) =>
                        updateNote(note.id, { body: event.target.value })
                      }
                      disabled={status === "saving"}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <details className="subsection" style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          Optional organization
        </summary>
        <label style={{ display: "block", marginTop: "0.85rem" }}>
          <span className="fieldLabel">Muse</span>
          <select
            id="spark-muse"
            value={museSlug}
            onChange={(event) => setMuseSlug(event.target.value)}
            disabled={status === "saving"}
          >
            <option value="">Choose later</option>
            {museOptions.map((muse) => (
              <option key={muse.slug} value={muse.slug}>
                {muse.name} — {muse.label}
              </option>
            ))}
          </select>
        </label>
      </details>

      {activeUploadLabel ? (
        <div className="statusMessage" style={{ marginTop: "1rem" }}>
          {activeUploadLabel}
        </div>
      ) : null}

      {message ? (
        <div
          className={`statusMessage ${
            status === "error" ? "statusError" : "statusSuccess"
          }`}
          style={{ marginTop: "1rem" }}
          aria-live="polite"
        >
          {message}
          {createdSongSlug ? (
            <div style={{ marginTop: "0.65rem" }}>
              <Link
                className="button"
                href={`/studio/songs/${createdSongSlug}/edit`}
              >
                Open the saved Spark
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="button-row" style={{ marginTop: "1.25rem" }}>
        <button
          type="submit"
          className="button primary"
          disabled={status === "saving" || isRecording || !isSignedIn}
        >
          {status === "saving" ? "Saving your Spark…" : "Save My Spark"}
        </button>

        <button
          type="button"
          className="button"
          onClick={() => resetCapture()}
          disabled={status === "saving"}
        >
          Start Over
        </button>
      </div>
    </form>
  );
}
