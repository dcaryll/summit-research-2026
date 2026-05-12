export type AppViewMode = 'participant' | 'moderator'

/**
 * Participant-facing UI (default): study flow only, no moderator notes or CSV export.
 * Moderator tools: add `?moderator=1` or `?view=moderator` to the URL (same build, same data).
 * Multi-window sync: add `?v=2` for the v2 shell (shared session across tabs/windows on this origin).
 * v2 participant URL does not start a study from the grid (so the moderator can enter the ID first);
 * add `&solo=1` on the participant URL for local self-serve testing without a moderator window.
 */
export function getAppViewModeFromLocation(): AppViewMode {
  if (typeof window === 'undefined') return 'participant'
  const p = new URLSearchParams(window.location.search)
  if (p.get('moderator') === '1' || p.get('view') === 'moderator') return 'moderator'
  return 'participant'
}
