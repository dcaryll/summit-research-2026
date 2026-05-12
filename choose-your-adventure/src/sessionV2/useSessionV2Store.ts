import { useCallback, useSyncExternalStore } from 'react'
import {
  getSessionV2Snapshot,
  subscribeSessionV2,
  updateSessionV2,
  type SessionV2Snapshot
} from './crossWindowSessionStore'

/**
 * Shared v2 session: all windows/tabs on this origin see the same snapshot.
 * Use with `AppV2` + `?v=2` (and `?moderator=1` on moderator windows).
 */
export function useSessionV2Store(): readonly [
  SessionV2Snapshot,
  typeof updateSessionV2
] {
  const snap = useSyncExternalStore(
    subscribeSessionV2,
    getSessionV2Snapshot,
    getSessionV2Snapshot
  )
  const stableUpdate = useCallback((p: Parameters<typeof updateSessionV2>[0]) => {
    updateSessionV2(p)
  }, [])
  return [snap, stableUpdate] as const
}
