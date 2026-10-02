import type { Transport } from '../transport.js'
import type { Loop, LoopEvent } from '../types.js'
import type { Synth } from './engine.js'

import { BEATS_PER_BAR } from '../transport.js'

// Loop recording/playback on the shared transport's beat grid. Notes are
// scheduled LOOKAHEAD seconds ahead from a ~25 ms timer, so playback stays tight
// while the main thread is busy. Loops are stored in seconds plus the tempo they
// were recorded at (`bpm`); playback converts to beats, so loops follow tempo
// changes and stay locked to the drums.
export const LOOKAHEAD = 0.1
const LATE_PRESS = 0.25 // beats (a 16th note)

export interface Player {
  readonly playing: boolean
  // Swaps in edited notes/length; a playing loop keeps its place in the bar.
  setLoop(next: PlayerLoop): void
  start(atBeat?: 'now' | number): void
  stop(): void
  stopAt(beat: number): void
  tick(): number
}

// Plays one loop ({ events, length, params, bpm }) on voices keyed `${prefix}${midi}`,
// from a bar line. Loops saved before tempo sync have no `bpm`; they're taken to be
// at the tempo in effect when they start. A one-shot (`once`) plays a single cycle
// from where it starts, then stops by itself.
export type PlayerLoop = Pick<Loop, 'bpm' | 'events' | 'length' | 'once' | 'params'>

export interface Recorder {
  finish(): null | Take
  note(midi: number, on: boolean, at?: number): void
  start(held?: number[], fromBeat?: number): void
  readonly startBeat: number
}

// A finished take: times in seconds at `bpm`.
export interface Take {
  bpm: number
  events: LoopEvent[]
  length: number
}

interface BeatEvent {
  beat: number
  midi: number
  on: boolean
}

export function createPlayer(
  synth: Pick<Synth, 'cancelPending' | 'noteOff' | 'noteOn' | 'setOwnParams'>,
  prefix: string,
  initial: PlayerLoop,
  transport: Pick<
    Transport,
    'acquire' | 'beatAt' | 'bpm' | 'nextBar' | 'now' | 'release' | 'timeAt'
  >
): Player {
  let loop = initial
  let lengthBeats = 0
  let events: (LoopEvent & { beat: number })[] = []
  let playing = false
  let startBeat = 0
  let cycleStart = 0
  let cursor = 0
  // Playback ends exactly on endBeat: the earlier of a stopAt() beat and, for a
  // one-shot, the end of its cycle.
  let endBeat = Infinity
  let stopBeat = Infinity
  let shotEnd = Infinity
  const setEnd = () => (endBeat = Math.min(stopBeat, shotEnd))
  const sounding = new Set<string>()

  // Converts the loop to beats; loops recorded before tempo sync (no bpm) are
  // taken to be at the current tempo.
  function load() {
    const toBeats = (loop.bpm ?? transport.bpm) / 60
    // Lengths are stored to the millisecond; snap to 1/192 beat so a loop doesn't
    // drift against the grid a little more on every cycle.
    lengthBeats = Math.max(1 / 192, Math.round(loop.length * toBeats * 192) / 192)
    events = loop.events.map((e) => ({ ...e, beat: e.t * toBeats }))
  }

  // Stops notes already scheduled or sounding, so the loop can be rescheduled.
  function silence(at?: number) {
    synth.cancelPending((key) => typeof key === 'string' && key.startsWith(prefix))
    for (const key of sounding) synth.noteOff(key, at)
    sounding.clear()
  }

  function finish() {
    for (const key of sounding) synth.noteOff(key, transport.timeAt(endBeat))
    sounding.clear()
    playing = false
    transport.release(prefix)
  }

  // Where the cycle playing now ends (a one-shot switched on mid-loop finishes it).
  function cycleEnd(): number {
    const into = Math.max(0, transport.beatAt(transport.now()) - startBeat)
    return startBeat + (Math.floor(into / lengthBeats) + 1) * lengthBeats
  }

  return {
    get playing(): boolean {
      return playing
    },
    setLoop(next: PlayerLoop): void {
      // Only the sound changed: notes already sounding take it on, nothing restarts.
      const sameNotes =
        next.events === loop.events && next.length === loop.length && next.bpm === loop.bpm
      const onceChanged = !!next.once !== !!loop.once
      loop = next
      if (sameNotes) {
        if (onceChanged && playing) {
          shotEnd = next.once ? cycleEnd() : Infinity
          setEnd()
        }
        return synth.setOwnParams(prefix, next.params)
      }
      if (!playing) return
      silence()
      load()
      // Pick up at the same point of the (possibly shorter) cycle.
      const now = transport.beatAt(transport.now())
      const into = Math.max(0, now - startBeat)
      const phase = lengthBeats > 0 ? into % lengthBeats : 0
      cycleStart = startBeat + into - phase
      cursor = events.findIndex((e) => cycleStart + e.beat >= Math.max(now, startBeat))
      if (cursor < 0) {
        cursor = 0
        cycleStart += lengthBeats
      }
      shotEnd = next.once ? cycleEnd() : Infinity
      setEnd()
      tick()
    },
    // Default: next bar line; 'now': current beat after acquiring the grid.
    // Already playing: cancel a pending stopAt() without changing phase or a one-shot's end.
    start(atBeat: 'now' | number = transport.nextBar()): void {
      stopBeat = Infinity
      setEnd()
      if (playing) return
      load()
      transport.acquire(prefix)
      playing = true
      startBeat = cycleStart = atBeat === 'now' ? transport.beatAt(transport.now()) : atBeat
      cursor = 0
      shotEnd = loop.once ? startBeat + lengthBeats : Infinity
      setEnd()
      tick()
    },
    // Stops now: releases held loop notes and silences any note scheduled but not
    // yet started, including ones whose note-off was already scheduled.
    stop(): void {
      if (!playing) return
      playing = false
      silence()
      transport.release(prefix)
    },
    // Stops on `beat` (a section boundary): notes before it still play, anything
    // held is released exactly on it.
    stopAt(beat: number): void {
      if (!playing) return
      stopBeat = beat
      setEnd()
    },
    tick
  }

  // Schedules everything due before now + LOOKAHEAD; returns loop position 0..1.
  function tick(): number {
    if (!playing) return 0
    const now = transport.now()
    // An empty loop schedules nothing but still stops on its stop beat.
    if (events.length === 0 && transport.timeAt(endBeat) < now + LOOKAHEAD) finish()
    while (events.length > 0) {
      const e = events[cursor]
      if (!e) break
      const beat = cycleStart + e.beat
      if (beat >= endBeat) {
        if (transport.timeAt(endBeat) < now + LOOKAHEAD) finish()
        break
      }
      const at = transport.timeAt(beat)
      if (at >= now + LOOKAHEAD) break
      const key = prefix + e.midi
      if (e.on) {
        synth.noteOn(e.midi, at, key, loop.params, e.velocity)
        sounding.add(key)
      } else {
        synth.noteOff(key, at)
        sounding.delete(key)
      }
      if (++cursor === events.length) {
        cursor = 0
        cycleStart += lengthBeats
      }
    }
    const into = transport.beatAt(now) - startBeat
    return !playing || into <= 0 ? 0 : (into % lengthBeats) / lengthBeats
  }
}

// Records note on/off events from `startBeat` (a bar line; notes played during a
// count-in land on beat 0). finish() rounds the take to whole bars, drops notes
// that start past the end and closes any still held at the loop edge.
export function createRecorder(
  transport: Pick<Transport, 'beatAt' | 'bpm' | 'nextBar' | 'now'>
): Recorder {
  let startBeat = 0
  let events: BeatEvent[] = []

  return {
    // Returns the take, or null when nothing usable was recorded (still counting
    // in, or no notes).
    finish(): null | Take {
      const elapsed = transport.beatAt(transport.now()) - startBeat
      if (elapsed <= 0) return null
      // Round to the nearest bar (a slightly late or early press lands on the bar
      // meant), but extend to keep notes deliberately played past that point. A note
      // within a 16th after the boundary is a late press on the next downbeat and
      // belongs to the next cycle.
      const rounded = Math.max(1, Math.round(elapsed / BEATS_PER_BAR)) * BEATS_PER_BAR
      const lastOn = Math.max(-1, ...events.filter((e) => e.on).map((e) => e.beat))
      const beats =
        lastOn >= rounded + LATE_PRESS
          ? Math.floor(lastOn / BEATS_PER_BAR + 1) * BEATS_PER_BAR
          : rounded
      const kept: BeatEvent[] = []
      const held = new Set<number>()
      // Timed notes arrive once they've started, possibly after later presses.
      for (const e of events.toSorted((a, b) => a.beat - b.beat)) {
        if (e.beat >= beats) continue
        // A timed note that began before the take has no start to end.
        if (!e.on && !held.has(e.midi)) continue
        kept.push(e)
        if (e.on) held.add(e.midi)
        else held.delete(e.midi)
      }
      for (const midi of held) kept.push({ beat: beats, midi, on: false })
      if (!kept.some((e) => e.on)) return null
      const sec = (b: number): number => round((b * 60) / transport.bpm)
      return {
        bpm: transport.bpm,
        events: kept.map((e) => ({ midi: e.midi, on: e.on, t: sec(e.beat) })),
        length: sec(beats)
      }
    },
    // A key press or release now; with `at` (audio time), a note that played
    // exactly then (the arpeggiator's), dropped if it came before the take.
    note(midi: number, on: boolean, at?: number): void {
      const beat = transport.beatAt(at ?? transport.now()) - startBeat
      if (at === undefined || beat >= 0) events.push({ beat: Math.max(0, beat), midi, on })
    },
    start(held: number[] = [], fromBeat = transport.nextBar()): void {
      startBeat = fromBeat
      events = held.map((midi) => ({ beat: 0, midi, on: true }))
    },
    // Beat the take starts on (the count-in ends here).
    get startBeat(): number {
      return startBeat
    }
  }
}

const round = (s: number): number => Math.round(s * 1000) / 1000
