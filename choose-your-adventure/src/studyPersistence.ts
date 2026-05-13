import { studyDisplayName } from './studyDisplayNames'

const DB_NAME = 'UserStudyDB'
const DB_VERSION = 1
const STORE_NAME = 'responses'

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        objectStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

export function getBackendApiEndpoint(): string | null {
  const url = (import.meta.env.VITE_API_ENDPOINT as string | undefined)?.trim()
  return url || null
}

export const saveResponseToBackend = async (data: {
  timestamp: string
  focusId: string
  answers: Record<string, string>
  participantId?: string
  durationMs?: number
}): Promise<boolean> => {
  const endpoint = getBackendApiEndpoint()
  if (!endpoint) {
    return true
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`)
    }

    console.log('Response saved to backend successfully')
    return true
  } catch (error) {
    console.error('Error saving to backend:', error)
    return false
  }
}

export const saveResponse = async (data: {
  timestamp: string
  focusId: string
  answers: Record<string, string>
  participantId?: string
  /** Wall time from study load to submit, when recorded by the client. */
  durationMs?: number
}) => {
  const backendSuccess = await saveResponseToBackend(data)

  try {
    const db = await initDB()
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(data)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error saving to IndexedDB:', error)
  }

  try {
    const backupKey = 'userStudyBackup'
    const existingBackup = localStorage.getItem(backupKey)
    const backupData = existingBackup ? JSON.parse(existingBackup) : []
    backupData.push({ ...data, id: Date.now() })
    const trimmedData = backupData.slice(-1000)
    localStorage.setItem(backupKey, JSON.stringify(trimmedData))
  } catch (error) {
    console.error('Error saving to localStorage backup:', error)
  }

  if (!backendSuccess) {
    try {
      const pendingKey = 'userStudyPending'
      const pending = localStorage.getItem(pendingKey)
      const pendingData = pending ? JSON.parse(pending) : []
      pendingData.push(data)
      localStorage.setItem(pendingKey, JSON.stringify(pendingData))
    } catch (error) {
      console.error('Error saving pending response:', error)
    }
  }
}

export type StoredStudyResponse = {
  id?: number
  timestamp: string
  focusId: string
  answers: Record<string, string>
  participantId?: string
  durationMs?: number
}

export const getAllResponses = async (): Promise<StoredStudyResponse[]> => {
  try {
    const db = await initDB()
    const indexedDBData = await new Promise<StoredStudyResponse[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
    if (indexedDBData.length > 0) {
      try {
        localStorage.setItem('userStudyBackup', JSON.stringify(indexedDBData))
      } catch (e) {
        console.error('Error syncing study backup to localStorage:', e)
      }
      return indexedDBData
    }
  } catch (error) {
    console.error('Error reading study responses from IndexedDB:', error)
  }
  try {
    const raw = localStorage.getItem('userStudyBackup')
    if (raw) {
      const parsed = JSON.parse(raw) as StoredStudyResponse[]
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (e) {
    console.error('Error reading study backup from localStorage:', e)
  }
  return []
}

/** One row per `focusId` for moderator dashboard: completion counts and optional average duration. */
export type StudyAggregateRow = {
  focusId: string
  label: string
  completions: number
  avgDurationMs: number | null
}

export function aggregateStudyCompletions(responses: StoredStudyResponse[]): StudyAggregateRow[] {
  const byFocus = new Map<string, { count: number; durations: number[] }>()
  for (const r of responses) {
    const fid = (r.focusId || '').trim()
    if (!fid) continue
    let agg = byFocus.get(fid)
    if (!agg) {
      agg = { count: 0, durations: [] }
      byFocus.set(fid, agg)
    }
    agg.count += 1
    const d = r.durationMs
    if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
      agg.durations.push(d)
    }
  }
  return [...byFocus.entries()]
    .map(([focusId, { count, durations }]) => ({
      focusId,
      label: studyDisplayName(focusId),
      completions: count,
      avgDurationMs:
        durations.length === 0 ? null : durations.reduce((a, b) => a + b, 0) / durations.length
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

/** Human-readable duration from milliseconds (for averages). */
export function formatDurationMs(ms: number): string {
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (s === 0) return `${m} min`
  return `${m}m ${s}s`
}

function escapeCsvCell(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

type AnswerColumn = { focusId: string; answerKey: string }

function buildAnswerColumns(responses: StoredStudyResponse[]): AnswerColumn[] {
  const seen = new Set<string>()
  const out: AnswerColumn[] = []
  for (const r of responses) {
    const focusId = (r.focusId || '').trim()
    const keys = Object.keys(r.answers || {})
    for (const answerKey of keys) {
      const id = `${focusId}\u0000${answerKey}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push({ focusId, answerKey })
    }
  }
  out.sort((a, b) => {
    const fc = a.focusId.localeCompare(b.focusId)
    if (fc !== 0) return fc
    return a.answerKey.localeCompare(b.answerKey, undefined, { numeric: true })
  })
  return out
}

function answerColumnHeader(col: AnswerColumn): string {
  const label = studyDisplayName(col.focusId)
  return `${label} — ${col.answerKey}`
}

function resolveAnswerColumnHeaders(columns: AnswerColumn[]): string[] {
  const base = columns.map(answerColumnHeader)
  const counts = new Map<string, number>()
  for (const h of base) {
    counts.set(h, (counts.get(h) ?? 0) + 1)
  }
  return columns.map((col, i) => {
    const h = base[i]!
    if ((counts.get(h) ?? 0) <= 1) return h
    return `${studyDisplayName(col.focusId)} (${col.focusId}) — ${col.answerKey}`
  })
}

export const exportResponsesToCsv = async () => {
  try {
    const all = await getAllResponses()
    if (all.length === 0) {
      window.alert(
        'No responses found to export. Responses are saved when a participant finishes a study.'
      )
      return
    }
    const sorted = [...all].sort((a, b) =>
      (a.timestamp || '').localeCompare(b.timestamp || '')
    )
    const answerColumns = buildAnswerColumns(sorted)
    const answerHeaders = resolveAnswerColumnHeaders(answerColumns)
    const headers = ['timestamp', 'participantId', 'focusId', 'durationMs', ...answerHeaders]
    const rows: string[][] = [headers]
    for (const r of sorted) {
      const fid = (r.focusId || '').trim()
      rows.push([
        r.timestamp || '',
        r.participantId ?? '',
        r.focusId || '',
        r.durationMs != null && Number.isFinite(r.durationMs) ? String(Math.round(r.durationMs)) : '',
        ...answerColumns.map((col) =>
          col.focusId === fid ? (r.answers?.[col.answerKey] ?? '') : ''
        )
      ])
    }
    const csvBody = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
    const csvContent = `\uFEFF${csvBody}`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `summit-research-choose-your-adventure-responses-${new Date().toISOString().slice(0, 10)}.csv`
    )
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting study responses CSV:', error)
    window.alert('Could not export CSV. Check the console for details.')
  }
}

/** One pass of flushing queued failed API posts (same logic as App mount / online). */
export async function retryPendingResponsesOnce(): Promise<void> {
  try {
    if (!getBackendApiEndpoint()) return

    const pendingKey = 'userStudyPending'
    const pending = localStorage.getItem(pendingKey)
    if (!pending) return

    const pendingData = JSON.parse(pending)
    if (pendingData.length === 0) return

    const successful: number[] = []
    for (let i = 0; i < pendingData.length; i++) {
      const success = await saveResponseToBackend(pendingData[i])
      if (success) {
        successful.push(i)
      }
    }

    if (successful.length > 0) {
      const remaining = pendingData.filter((_: unknown, index: number) => !successful.includes(index))
      if (remaining.length > 0) {
        localStorage.setItem(pendingKey, JSON.stringify(remaining))
      } else {
        localStorage.removeItem(pendingKey)
      }
    }
  } catch (error) {
    console.error('Error retrying pending responses:', error)
  }
}
