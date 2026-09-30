// Tap tempo: the tempo from the time between the last few taps. A pause longer
// than RESET_MS starts a new run of taps.

const RESET_MS = 2000
// Taps averaged over (so four gaps between them).
const TAPS = 5
const MIN_BPM = 60
const MAX_BPM = 200

export interface TapTempo {
  // Records a tap at `now` (ms). Returns the tempo so far, and whether it's the
  // first of this run of taps (a new undo step), or null on a run's first tap.
  tap(now: number): null | { bpm: number; first: boolean }
}

export function createTapTempo(): TapTempo {
  let taps: number[] = []

  function tap(now: number): null | { bpm: number; first: boolean } {
    const last = taps.at(-1)
    if (last === undefined || now - last > RESET_MS || now <= last) taps = []
    taps = [...taps, now].slice(-TAPS)
    const first = taps[0]
    if (first === undefined || taps.length < 2) return null
    const beat = (now - first) / (taps.length - 1)
    const bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(60000 / beat)))
    return { bpm, first: taps.length === 2 }
  }

  return { tap }
}
