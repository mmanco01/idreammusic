const FALLBACK_PATH = "/studio";
const LOCAL_ORIGIN = "https://idreammusic.local";

export function sanitizeNextPath(
  value: string | null | undefined,
  fallback = FALLBACK_PATH,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, LOCAL_ORIGIN);
    if (parsed.origin !== LOCAL_ORIGIN) return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
