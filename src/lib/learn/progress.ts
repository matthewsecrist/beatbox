// Quiz results for the Learn section, kept in this browser only: each lesson's
// best score. Storage can be missing or blocked (private windows), so every read
// and write is allowed to fail, and the lessons work without it.
const KEY = 'beatbox:learn'

export type Progress = Record<string, { score: number; total: number }>

export function loadProgress(): Progress {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return saved && typeof saved === 'object' ? (saved as Progress) : {}
  } catch {
    return {}
  }
}

// Keeps the lesson's best score; returns the progress as saved.
export function saveResult(slug: string, score: number, total: number): Progress {
  const progress = loadProgress()
  const best = progress[slug]
  if (!best || score / total > best.score / best.total) progress[slug] = { score, total }
  try {
    localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    // Not saved: the score still shows until the page is left.
  }
  return progress
}
