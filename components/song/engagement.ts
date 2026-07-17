export type EngagementEventType = "audio_play" | "video_click";  

type TrackEngagementInput = {
  songId: string;
  eventType: EngagementEventType;
  songVersionId?: string | null;
  attachmentId?: string | null;
  sourcePage?: string;
  targetUrl?: string | null;
  resourceKey?: string | null;
};

const SESSION_STORAGE_KEY = "idreammusic-engagement-session";

function simpleHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function getEngagementSessionId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

export async function trackSongEngagement({
  songId,
  eventType,
  songVersionId,
  attachmentId,
  sourcePage = "unknown",
  targetUrl,
  resourceKey,
}: TrackEngagementInput) {
  if (typeof window === "undefined") return;

  const sessionId = getEngagementSessionId();
  const resourceIdentity =
    resourceKey || attachmentId || songVersionId || targetUrl || "song";

  const eventKey = [
    sessionId,
    eventType,
    songId,
    simpleHash(resourceIdentity),
  ].join(":");

  const browserKey = `idm-counted:${eventKey}`;

  if (window.sessionStorage.getItem(browserKey)) {
    return;
  }

  window.sessionStorage.setItem(browserKey, "pending");

  try {
    const response = await fetch("/api/song-engagement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({
        song_id: songId,
        song_version_id: songVersionId || "",
        attachment_id: attachmentId || "",
        event_type: eventType,
        anonymous_session_id: sessionId,
        event_key: eventKey,
        source_page: sourcePage,
        target_url: targetUrl || "",
      }),
    });

    if (!response.ok) {
      window.sessionStorage.removeItem(browserKey);
    } else {
      window.sessionStorage.setItem(browserKey, "counted");
    }
  } catch {
    window.sessionStorage.removeItem(browserKey);
  }
}
