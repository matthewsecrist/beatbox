import { getContext } from './audio.js'

export const BEATS_PER_BAR = 4
const LOOKAHEAD = 0.1

// Shared tempo and beat grid. Instruments `acquire` the transport while they play;
// the first one starts the grid at beat 0 and the last `release` stops it. Beats
// map to audio-clock times through an anchor, re-set on tempo changes so the
// current beat position carries over: everything scheduled by beat stays in sync.
export interface Transport {
  acquire(id: string): void
  beatAt(t: number): number
  readonly bpm: number
  metronome(fromBeat: null | number): void
  nextBar(t?: number): number
  now(): number
  release(id: string): void
  readonly running: boolean
  setBpm(value: number): void
  timeAt(beat: number): number
}

export function createTransport(getCtx: () => BaseAudioContext = getContext): Transport {
  let bpm = 110
  let running = false
  let anchorTime = 0
  let anchorBeat = 0
  const users = new Set<string>()

  // Metronome: clicks every beat while enabled (loop recording).
  let nextClick = 0
  let clickTimer: ReturnType<typeof setInterval> | undefined

  const now = () => getCtx().currentTime
  const beatAt = (t: number): number => anchorBeat + ((t - anchorTime) * bpm) / 60
  const timeAt = (beat: number): number => anchorTime + ((beat - anchorBeat) * 60) / bpm

  function click(t: number, accent: boolean) {
    const ctx = getCtx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = accent ? 1760 : 1320
    g.gain.setValueAtTime(accent ? 0.3 : 0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
    o.connect(g).connect(ctx.destination)
    o.onended = () => g.disconnect()
    o.start(t)
    o.stop(t + 0.05)
  }

  // Click every beat from `fromBeat` (null turns it off).
  function metronome(fromBeat: null | number) {
    clearInterval(clickTimer)
    clickTimer = undefined
    if (fromBeat === null) return
    nextClick = Math.max(fromBeat, Math.ceil(beatAt(now())))
    scheduleClicks()
    clickTimer = setInterval(scheduleClicks, 25)
  }

  function scheduleClicks() {
    while (timeAt(nextClick) < now() + LOOKAHEAD) {
      click(timeAt(nextClick), nextClick % BEATS_PER_BAR === 0)
      nextClick++
    }
  }

  return {
    acquire(id: string) {
      if (!running) {
        running = true
        anchorTime = now() + 0.05
        anchorBeat = 0
      }
      users.add(id)
    },
    beatAt,
    get bpm() {
      return bpm
    },
    metronome,
    // First bar line at or after audio time `t` (beat 0 right after the grid starts).
    nextBar(t = now()): number {
      return Math.max(0, Math.ceil(beatAt(t) / BEATS_PER_BAR - 1e-9) * BEATS_PER_BAR)
    },

    now,

    release(id: string) {
      users.delete(id)
      if (users.size === 0) {
        running = false
        metronome(null)
      }
    },

    get running() {
      return running
    },

    setBpm(value: number) {
      if (running) {
        const t = now()
        anchorBeat = beatAt(t)
        anchorTime = t
      }
      bpm = value
    },

    timeAt
  }
}

export const transport = createTransport()
