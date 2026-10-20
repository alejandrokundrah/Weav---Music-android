const STORAGE_KEY = "weav.samples.hidden.v1";

let hidden: Set<string> | null = null;

function load(): Set<string> {
  if (hidden) return hidden;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    hidden = new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    hidden = new Set();
  }
  return hidden;
}

export function getHiddenSongIds(): ReadonlySet<string> {
  return load();
}

export function hideSong(songId: string): void {
  const ids = load();
  ids.add(songId);
  try {
    // Bounded so a long-lived install cannot grow this forever.
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-1000)));
  } catch {
    // Still hidden for this session.
  }
}
