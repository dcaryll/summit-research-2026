/** Human-readable study titles keyed by `focusId` (selector + stored response id). */
export const STUDY_DISPLAY_NAME: Record<string, string> = {
  'product-evaluation': 'Build your dream trial',
  'trying-products': 'Build your dream trial',
  'user-preferences': 'Personalize your Red Hat',
  'developer-program': 'Shape the Developer program',
  'developer-for-business': 'Shape the Developer program',
  'my-red-hat': 'Refine your intelligent dashboard',
  dashboard: 'Refine your intelligent dashboard',
  'my-trials': 'From testing to buying',
  'product-marketing': 'Improve our product navigation',
  'buying-products': 'Improve our product navigation',
  'content-discovery': 'How do you learn best?'
}

export function studyDisplayName(focusId: string): string {
  const fid = (focusId || '').trim()
  return STUDY_DISPLAY_NAME[fid] ?? fid.replace(/-/g, ' ')
}
