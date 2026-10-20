export const NEW_CONTENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Creation, not edits or the legacy manual flag, starts the seven-day window. */
export function isNewContent(createdAt?: string | null, now = Date.now()): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  const age = now - created;
  return Number.isFinite(created) && age >= 0 && age < NEW_CONTENT_WINDOW_MS;
}