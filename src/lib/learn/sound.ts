import type { SynthParams } from '../types.js'

import { createSynth, type Synth } from '../synth/engine.js'
import { FACTORY_PRESETS } from '../synth/factory_presets.js'

// The lessons' instrument: one synth for every example, with a soft electric
// piano so notes and chords are easy to hear. Made on the first note (browsers
// only allow audio after a click), so only call these from event handlers.
const preset = (name: string): Partial<SynthParams> =>
  FACTORY_PRESETS.find((p) => p.name === name)?.params ?? {}

const PIANO = preset('Electric Piano')

// The sounds the lessons' loops play: drums made on the synth, a bass, the
// piano for chords and a pluck for melodies.
export const SOUNDS = {
  bass: preset('Sub Pluck Bass'),
  chords: PIANO,
  hat: preset('Noise Hat'),
  kick: preset('Synth Kick'),
  lead: preset('Pluck'),
  snare: preset('Synth Snare')
} satisfies Record<string, Partial<SynthParams>>

// Seconds of notes scheduled ahead of the audio clock.
const LOOKAHEAD = 0.1

let synth: null | Synth = null
let count = 0

// One note of a sequencer step. `channel` names the effects it plays through
// (each channel has its own); `length` is in steps.
export interface SeqNote {
  channel: string
  length: number
  midi: number
  sound?: Partial<SynthParams>
  velocity?: number
}

export interface Sequencer {
  start(): void
  stop(): void
}

// A key held down on a lesson keyboard, until noteUp.
export function noteDown(midi: number, sound?: Partial<SynthParams>): void {
  lessonSynth().noteOn(midi, undefined, `key:${midi}`, sound ?? null, 0.9)
}

export function noteUp(midi: number): void {
  synth?.noteOff(`key:${midi}`)
}

// Plays each group of notes together, one group after another `gap` seconds
// apart, each held for `length`; `sound` plays them with other settings in
// place of the piano (`sounds`: each group's own). Returns how many seconds it takes.
export function playGroups(
  groups: number[][],
  {
    gap = 0.55,
    length = 0.5,
    sound,
    sounds = []
  }: {
    gap?: number
    length?: number
    sound?: Partial<SynthParams>
    sounds?: Partial<SynthParams>[]
  } = {}
): number {
  const s = lessonSynth()
  const t0 = s.now() + 0.05
  groups.forEach((group, i) => {
    for (const midi of group) {
      const key = `learn:${count++}`
      s.noteOn(midi, t0 + i * gap, key, sounds[i] ?? sound ?? null, 0.9)
      s.noteOff(key, t0 + i * gap + length)
    }
  })
  return groups.length * gap
}

let sequencers = 0

// Plays `notesAt` each step (`stepBeats` long, read every step so the rate can
// change while it plays) at `bpm`, scheduled slightly ahead on the audio clock
// so it keeps time. `notesAt` gets the step and the beat it falls on. After
// `length` steps it starts over, or with `loop` off it stops and calls `onEnd`.
// `onStep` hears each step as it sounds, and -1 once stopped.
export function createSequencer({
  bpm,
  length = () => Infinity,
  loop = true,
  notesAt,
  onEnd,
  onStep,
  stepBeats = () => 0.25
}: {
  bpm: () => number
  length?: () => number
  loop?: boolean
  notesAt: (step: number, beat: number) => SeqNote[]
  onEnd?: () => void
  onStep?: (step: number) => void
  stepBeats?: () => number
}): Sequencer {
  const id = `seq${sequencers++}`
  let timer: ReturnType<typeof setInterval> | undefined
  const timeouts = new Set<ReturnType<typeof setTimeout>>()
  let step = 0
  let beat = 0
  let next = 0
  let tempo = 0

  // Runs `fn` when the audio clock reaches `t`.
  function at(t: number, fn: () => void) {
    const handle = setTimeout(
      () => {
        timeouts.delete(handle)
        fn()
      },
      Math.max(0, (t - lessonSynth().now()) * 1000)
    )
    timeouts.add(handle)
  }

  function schedule() {
    const s = lessonSynth()
    while (timer !== undefined && next < s.now() + LOOKAHEAD) {
      if (step >= length()) {
        if (!loop) {
          clearInterval(timer)
          timer = undefined
          at(next, () => {
            onStep?.(-1)
            onEnd?.()
          })
          return
        }
        step = 0
      }
      // Synced echoes follow the tempo.
      if (bpm() !== tempo) s.setTempo((tempo = bpm()))
      const seconds = (stepBeats() * 60) / tempo
      for (const n of notesAt(step, beat)) {
        const key = `${id}-${n.channel}:${count++}`
        s.noteOn(n.midi, next, key, n.sound ?? null, n.velocity ?? 0.9)
        s.noteOff(key, next + n.length * seconds * 0.95)
      }
      const current = step
      at(next, () => onStep?.(current))
      step++
      beat += stepBeats()
      next += seconds
    }
  }

  function stop() {
    clearInterval(timer)
    timer = undefined
    for (const handle of timeouts) clearTimeout(handle)
    timeouts.clear()
    synth?.cancelPending((key) => typeof key === 'string' && key.startsWith(id))
    onStep?.(-1)
  }

  function start() {
    stop()
    const s = lessonSynth()
    tempo = 0
    step = 0
    beat = 0
    next = s.now() + 0.06
    timer = setInterval(schedule, 25)
    schedule()
  }

  return { start, stop }
}

export function stopAll(): void {
  synth?.allNotesOff()
}

function lessonSynth(): Synth {
  synth ??= createSynth({ ...PIANO, volume: 0.6 })
  return synth
}
