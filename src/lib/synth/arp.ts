import type { Transport } from '../transport.js'
import type { ArpMode, ArpRate, ChordShape, Performance } from '../types.js'
import type { Synth } from './engine.js'

import { LOOKAHEAD } from './looper.js'

export const DEFAULT_PERFORMANCE: Performance = { arp: 'off', arp_rate: '1/16', chord: 'off' }

// Semitones above the key, per chord shape.
export const CHORDS: Record<ChordShape, number[]> = {
  '5': [0, 7, 12],
  '7': [0, 4, 7, 10],
  aug: [0, 4, 8],
  dim: [0, 3, 6],
  maj: [0, 4, 7],
  maj7: [0, 4, 7, 11],
  min: [0, 3, 7],
  min7: [0, 3, 7, 10],
  off: [0],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7]
}

// Arpeggiator step length in beats (quarter notes).
export const ARP_RATES: Record<ArpRate, number> = {
  '1/4': 1,
  '1/8': 1 / 2,
  '1/8t': 1 / 3,
  '1/16': 1 / 4,
  '1/16t': 1 / 6,
  '1/32': 1 / 8
}

export type ArpPattern = Exclude<ArpMode, 'off'>

const GATE = 0.5 // share of a step each arpeggiated note sounds
const LATE_PRESS = 0.03 // seconds: a first key this late still starts on the step it missed
const PREFIX = 'arp:'

export interface Arp {
  // Notes pressed or let go together (a chord) arrive as one call, so the
  // pattern starts with all of them.
  hold(notes: number[]): void
  release(notes: number[]): void
  releaseAll(): void
  set(pattern: ArpPattern, rate: ArpRate): void
  // Schedules the steps due before now + LOOKAHEAD and reports notes that have started.
  tick(): void
}

interface Pending {
  midi: number
  off: number
  on: number
}

// Notes one key plays: the chord built up from it, within MIDI range.
export const chordNotes = (midi: number, shape: ChordShape): number[] =>
  CHORDS[shape].map((i) => midi + i).filter((n) => n <= 127)

// One cycle of the pattern over the held notes, lowest first for up (random
// picks from the notes).
export function arpCycle(held: Iterable<number>, pattern: ArpPattern): number[] {
  const up = [...new Set(held)].sort((a, b) => a - b)
  if (pattern === 'down') return up.reverse()
  if (pattern === 'updown') return [...up, ...up.slice(1, -1).reverse()]
  return up
}

// Plays the held notes one at a time on the shared transport's grid, a step of
// `rate` apart. The first key held starts the pattern on the next step (right
// away when nothing else is playing); letting go of the last one stops it at
// once. `onnote` hears each note, with its exact on and off times, once it has
// started, so a loop recording gets exactly what played.
export function createArp(
  synth: Pick<Synth, 'cancelPending' | 'noteOff' | 'noteOn'>,
  transport: Pick<Transport, 'acquire' | 'beatAt' | 'now' | 'release' | 'timeAt'>,
  onnote: (midi: number, on: boolean, at: number) => void,
  random: () => number = Math.random
): Arp {
  let pattern: ArpPattern = 'up'
  let step = ARP_RATES[DEFAULT_PERFORMANCE.arp_rate]
  const held = new Set<number>()
  let running = false
  let nextBeat = 0
  let index = 0
  let last: number | undefined
  // Scheduled notes that haven't started yet.
  let pending: Pending[] = []

  function next(): number | undefined {
    const cycle = arpCycle(held, pattern)
    if (pattern !== 'random') return cycle[index++ % cycle.length]
    // Random never repeats a note while there's another to pick.
    const choices = cycle.length > 1 ? cycle.filter((n) => n !== last) : cycle
    last = choices[Math.floor(random() * choices.length)]
    return last
  }

  function report(now: number) {
    const due = pending.filter((n) => n.on <= now)
    if (!due.length) return
    pending = pending.filter((n) => n.on > now)
    for (const n of due) {
      onnote(n.midi, true, n.on)
      onnote(n.midi, false, n.off)
    }
  }

  function start() {
    transport.acquire(PREFIX)
    running = true
    index = 0
    last = undefined
    const now = transport.now()
    const prev = Math.floor(transport.beatAt(now) / step + 1e-9) * step
    nextBeat = Math.max(0, transport.timeAt(prev) >= now - LATE_PRESS ? prev : prev + step)
    tick()
  }

  // Notes already sounding play out their step; scheduled ones never start.
  function stop() {
    running = false
    synth.cancelPending((key) => typeof key === 'string' && key.startsWith(PREFIX))
    report(transport.now())
    pending = []
    transport.release(PREFIX)
  }

  function tick(): void {
    const now = transport.now()
    report(now)
    if (!running) return
    // After a stall (a background tab), skip the missed steps instead of bunching them.
    if (transport.timeAt(nextBeat) < now - LATE_PRESS) {
      nextBeat = Math.ceil(transport.beatAt(now) / step - 1e-9) * step
    }
    while (transport.timeAt(nextBeat) < now + LOOKAHEAD) {
      const midi = next()
      if (midi === undefined) break
      const on = transport.timeAt(nextBeat)
      const off = transport.timeAt(nextBeat + step * GATE)
      const key = PREFIX + String(midi)
      synth.noteOn(midi, on, key)
      synth.noteOff(key, off)
      pending.push({ midi, off, on })
      nextBeat += step
    }
  }

  return {
    hold(notes: number[]): void {
      for (const n of notes) held.add(n)
      if (held.size && !running) start()
    },
    release(notes: number[]): void {
      for (const n of notes) held.delete(n)
      if (!held.size && running) stop()
    },
    releaseAll(): void {
      held.clear()
      if (running) stop()
    },
    // A new rate takes over from the next step, moved onto its own grid.
    set(nextPattern: ArpPattern, rate: ArpRate): void {
      pattern = nextPattern
      const length = ARP_RATES[rate]
      if (length === step) return
      step = length
      if (running) nextBeat = Math.ceil(nextBeat / step - 1e-9) * step
    },
    tick
  }
}
