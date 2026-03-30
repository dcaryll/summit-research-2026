/**
 * Warns on tab close / refresh when the study has unsaved in-memory progress.
 * Browsers usually show a generic message; custom wording is not reliable.
 */
export function registerBeforeUnloadIfInProgress(shouldWarn: boolean) {
  if (!shouldWarn) return () => {}
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault()
    e.returnValue = ''
  }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}

export function confirmLeaveActiveStudy(): boolean {
  return window.confirm(
    'Leave this study? Your answers from this session will be lost and are not saved until you finish. You can start again from study selection.'
  )
}

export function confirmLeaveQualifyingFlow(): boolean {
  return window.confirm(
    'Go back? Your answers on these questions will be lost. You can start Help me choose again from study selection.'
  )
}
