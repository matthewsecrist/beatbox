import type { SynthParams } from '../types.js'

import { createSynth, type Synth } from '../synth/engine.js'
import { FACTORY_PRESETS } from '../synth/factory_presets.js'

// The lessons' instrument: one synth for every example, with a soft electric
// piano so notes and chords are easy to hear. Made on the first note (browsers
// only allow audio after a click), so only call these from event handlers.
const PIANO = FACTORY_PRESETS.find((p) => p.name === 'Electric Piano')?.params

let synth: null | Synth = null
let count = 0

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

export function stopAll(): void {
  synth?.allNotesOff()
}

function lessonSynth(): Synth {
  synth ??= createSynth({ ...PIANO, volume: 0.6 })
  return synth
}
