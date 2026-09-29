import { getContext } from './audio.js'

export const BEATS_PER_BAR = 4
const LOOKAHEAD = 0.1

// From `beat` on, `bpm` beats per minute; null is the song tempo.
export interface TempoChange {
  beat: number
  bpm: null | number
}

// Shared tempo and beat grid. Instruments `acquire` the transport while they play;
// the first one starts the grid at beat 0 and the last `release` stops it. Beats
// map to audio-clock times through an anchor, re-set on tempo changes so the
// current beat position carries over: everything scheduled by beat stays in sync.
//
// The tempo is the song's (`setBpm`), unless a tempo map (`setTempo`) gives some
// stretch of beats its own: the arrangement's sections with a tempo of their own.
export interface Transport {
  acquire(id: string): void
  beatAt(t: number): number
  // The tempo playing now.
  readonly bpm: number
  // Back to the song tempo from now on, with no changes to come.
  clearTempo(): void
  metronome(fromBeat: null | number): void
  nextBar(t?: number): number
  now(): number
  release(id: string): void
  readonly running: boolean
  // The song tempo.
  setBpm(value: number): void
  // Replaces the tempo changes to come: from each change's beat, its tempo.
  setTempo(changes: TempoChange[]): void
  timeAt(beat: number): number
}

export function createTransport(getCtx: () => BaseAudioContext = getContext): Transport {
  let songBpm = 110
  let running = false
  // From `anchorBeat` (at `anchorTime`) the tempo is `anchorBpm`, until each of
  // `changes` (all on later beats, in order) takes over on its beat.
  let anchorTime = 0
  let anchorBeat = 0
  let anchorBpm: null | number = null
  let changes: TempoChange[] = []
  const users = new Set<string>()

  // Metronome: clicks every beat while enabled (loop recording).
  let nextClick = 0
  let clickTimer: ReturnType<typeof setInterval> | undefined

  const now = () => getCtx().currentTime
  const rate = (bpm: null | number) => bpm ?? songBpm

  // The stretch of the grid playing at audio time `t`: where it starts, and its tempo.
  function segmentAt(t: number): { beat: number; bpm: null | number; time: number } {
    let segment = { beat: anchorBeat, bpm: anchorBpm, time: anchorTime }
    for (const change of changes) {
      const time = segment.time + ((change.beat - segment.beat) * 60) / rate(segment.bpm)
      if (time > t) break
      segment = { beat: change.beat, bpm: change.bpm, time }
    }
    return segment
  }

  function beatAt(t: number): number {
    const segment = segmentAt(t)
    return segment.beat + ((t - segment.time) * rate(segment.bpm)) / 60
  }

  function timeAt(beat: number): number {
    let segment = { beat: anchorBeat, bpm: anchorBpm, time: anchorTime }
    for (const change of changes) {
      if (change.beat > beat) break
      const time = segment.time + ((change.beat - segment.beat) * 60) / rate(segment.bpm)
      segment = { beat: change.beat, bpm: change.bpm, time }
    }
    return segment.time + ((beat - segment.beat) * 60) / rate(segment.bpm)
  }

  // Moves the anchor to now, keeping every beat from now on where it was, so the
  // tempo can change from here without moving what's already scheduled.
  function reanchor() {
    if (!running) return
    const t = now()
    const segment = segmentAt(t)
    anchorBeat = beatAt(t)
    anchorTime = t
    anchorBpm = segment.bpm
    changes = changes.filter((c) => c.beat > anchorBeat)
  }

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
        anchorBpm = null
        changes = []
      }
      users.add(id)
    },
    beatAt,
    get bpm() {
      return running ? rate(segmentAt(now()).bpm) : songBpm
    },
    clearTempo() {
      reanchor()
      anchorBpm = null
      changes = []
    },
    metronome,
    // First bar line at or after audio time `t`. Stopped: 0, where the grid starts
    // on the next acquire.
    nextBar(t = now()): number {
      if (!running) return 0
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
      reanchor()
      songBpm = value
    },

    setTempo(list: TempoChange[]) {
      reanchor()
      const sorted = [...list].sort((a, b) => a.beat - b.beat)
      // A change on the anchor's beat or before it takes over from the anchor.
      for (const change of sorted) if (change.beat <= anchorBeat) anchorBpm = change.bpm
      changes = sorted.filter((c) => c.beat > anchorBeat)
    },

    timeAt
  }
}

export const transport = createTransport()
