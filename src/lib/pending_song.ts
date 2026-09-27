import type { SongDoc } from './types.js'

// A signed-out visitor's unsaved song, kept in the browser while they sign in:
// the magic link may open in another tab, so it's in localStorage (shared by the
// site's tabs), and the page picks it up once they're signed in.

const KEY = 'beatbox:pending-song'
// Older than this and it's dropped: the sign-in was abandoned.
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface PendingSong {
  name: string
  song: SongDoc
}

interface Stored extends PendingSong {
  keptAt: number
}

// Keeps the song; false if the browser won't store it (private mode, full storage).
export function keepPendingSong(
  pending: PendingSong,
  storage: Storage = localStorage,
  now = Date.now()
): boolean {
  try {
    storage.setItem(KEY, JSON.stringify({ ...pending, keptAt: now } satisfies Stored))
    return true
  } catch {
    return false
  }
}

// Returns the kept song, if there's a recent one, and forgets it.
export function takePendingSong(
  storage: Storage = localStorage,
  now = Date.now()
): null | PendingSong {
  let raw: null | string
  try {
    raw = storage.getItem(KEY)
    storage.removeItem(KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const stored = JSON.parse(raw) as unknown
    if (!isStored(stored) || now - stored.keptAt > MAX_AGE_MS) return null
    return { name: stored.name, song: stored.song }
  } catch {
    return null
  }
}

// Only a loose check that it's the shape we wrote; the server validates the song
// when it's saved.
function isStored(value: unknown): value is Stored {
  if (typeof value !== 'object' || value === null) return false
  const { keptAt, name, song } = value as Partial<Record<keyof Stored, unknown>>
  if (typeof keptAt !== 'number' || typeof name !== 'string') return false
  if (typeof song !== 'object' || song === null) return false
  const { arrangement, loops } = song as Partial<Record<keyof SongDoc, unknown>>
  return Array.isArray(arrangement) && Array.isArray(loops)
}
