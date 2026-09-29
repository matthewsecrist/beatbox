import type { BeatTracks } from './library_items.js'
import type { DrumPattern, DrumStep, Loop, SynthParams, TrackId } from './types.js'

import { STEPS } from './drums/engine.js'
import { TRACKS } from './drums/kits.js'
import { BEAT_SPECS, LOOP_SPECS } from './library_items.js'
import { STEP } from './song.svelte.js'
import { FACTORY_PRESETS } from './synth/factory_presets.js'
import { loopFromNotes } from './synth/notes.js'
import { BEATS_PER_BAR } from './transport.js'

// Premade loops and beats for the Loop Browser, built from the content in
// `library_items.ts` (which documents its notation). A loop becomes a pad's loop
// at the song tempo; a beat becomes one drum pattern.

export type LibraryBeat = LibraryCommon & {
  tracks: BeatTracks
  type: 'Beat'
}

export type LibraryItem = LibraryBeat | LibraryLoop

export type LibraryLoop = LibraryCommon & {
  // [midi, start, length], start and length in beats.
  notes: [number, number, number][]
  params: Partial<SynthParams>
  // Factory preset it plays with.
  sound: string
  type: 'Loop'
}

interface LibraryCommon {
  bars: number
  genre: string
  instrument: string
  name: string
}

const PITCH_CLASS: Record<string, number> = { A: 9, B: 11, C: 0, D: 2, E: 4, F: 5, G: 7 }
const NOTE = /^([A-G])(#|b)?(-?\d)$/
const STEP_BEATS = BEATS_PER_BAR / STEPS

// Reads a loop score (see `library_items.ts`) into notes; throws on a bad note or
// a bar that isn't 16 steps, so a typo fails as soon as the module loads.
export function parseScore(score: string): Pick<LibraryLoop, 'bars' | 'notes'> {
  const bars = score.split('|').map((bar) => bar.trim().split(/\s+/))
  const notes: [number, number, number][] = []
  let held: [number, number, number][] = []
  // Held notes marked `~`: they overlap the next note, so it glides from them.
  let sliding = false
  bars.forEach((steps, b) => {
    if (steps.length !== STEPS) throw new Error(`Bar ${b + 1} has ${steps.length} steps: ${score}`)
    steps.forEach((step, s) => {
      if (step === '-') {
        for (const note of held) note[2] += STEP_BEATS
        return
      }
      const slide = step.endsWith('~')
      const token = slide ? step.slice(0, -1) : step
      const next = token === '.' ? [] : token.split('+').map((name) => pitch(name, score))
      // A slide overlaps the next note by half a step (not a repeat of its own
      // pitch, which would cut the new note short).
      if (sliding && next.length) {
        for (const note of held) if (!next.includes(note[0])) note[2] += STEP_BEATS / 2
      }
      held = []
      sliding = slide
      for (const midi of next) {
        const note: [number, number, number] = [midi, (b * STEPS + s) * STEP_BEATS, STEP_BEATS]
        notes.push(note)
        held.push(note)
      }
    })
  })
  return { bars: bars.length, notes }
}

// MIDI note number of a note name (`A3`, `C#4`, `Bb2`).
function pitch(name: string, score: string): number {
  const [, letter = '', accidental, octave = ''] = NOTE.exec(name) ?? []
  const pc = PITCH_CLASS[letter]
  if (pc === undefined) throw new Error(`Bad note “${name}”: ${score}`)
  return 12 * (Number(octave) + 1) + pc + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)
}

// What each beat mark plays (see `library_items.ts`); unlisted marks are errors.
const BEAT_MARKS: Record<string, Partial<DrumStep>> = {
  '2': { on: true, ratchet: 2 },
  '3': { on: true, ratchet: 3 },
  '4': { on: true, ratchet: 4 },
  '.': { on: false },
  '?': { on: true, probability: 0.5 },
  o: { on: true, velocity: 0.5 },
  x: { on: true },
  X: { accent: true, on: true }
}

export const LIBRARY: LibraryItem[] = [
  ...LOOP_SPECS.map(({ score, sound, ...spec }): LibraryLoop => {
    const preset = FACTORY_PRESETS.find((p) => p.name === sound)
    if (!preset) throw new Error(`No factory preset “${sound}”`)
    return { ...spec, ...parseScore(score), params: preset.params, sound, type: 'Loop' }
  }),
  ...BEAT_SPECS.map((spec): LibraryBeat => {
    const beat: LibraryBeat = { ...spec, bars: 1, instrument: 'Drums', type: 'Beat' }
    beatPattern(beat) // a bad mark or length fails as soon as the module loads
    return beat
  })
]

// Sidebar filters: each picks items by one label.
export const FACETS = [
  { key: 'type', label: 'Type', value: (i: LibraryItem) => i.type },
  { key: 'genre', label: 'Genre', value: (i: LibraryItem) => i.genre },
  { key: 'instrument', label: 'Instrument', value: (i: LibraryItem) => i.instrument },
  { key: 'length', label: 'Length', value: (i: LibraryItem) => barsLabel(i.bars) }
] as const

export type FacetKey = (typeof FACETS)[number]['key']

// A facet's labels, in alphabetical order, with how many items have each.
export function facetOptions(value: (item: LibraryItem) => string): [string, number][] {
  const counts = new Map<string, number>()
  for (const item of LIBRARY) counts.set(value(item), (counts.get(value(item)) ?? 0) + 1)
  return [...counts].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
}

export const barsLabel = (bars: number): string => `${bars} bar${bars === 1 ? '' : 's'}`

export function beatPattern({ name, tracks }: LibraryBeat): DrumPattern {
  const row = (line = '.'.repeat(STEPS)): DrumPattern[TrackId] => {
    if (line.length !== STEPS) throw new Error(`${name}: “${line}” isn't ${STEPS} steps`)
    return [...line].map((mark) => {
      const step = BEAT_MARKS[mark]
      if (!step) throw new Error(`${name}: unknown beat mark “${mark}” in “${line}”`)
      return { ...STEP, ...step }
    })
  }
  return Object.fromEntries(TRACKS.map(({ id }) => [id, row(tracks[id])])) as DrumPattern
}

// Items matching the search (name, genre, instrument or sound) and, in every
// facet with something picked, one of the picked labels.
export function filterLibrary(
  items: LibraryItem[],
  query: string,
  picked: Partial<Record<FacetKey, string[]>>
): LibraryItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((item) => {
    const text = [item.name, item.genre, item.instrument, item.type === 'Loop' ? item.sound : '']
      .join(' ')
      .toLowerCase()
    return (
      words.every((w) => text.includes(w)) &&
      FACETS.every(({ key, value }) => {
        const labels = picked[key]
        return !labels?.length || labels.includes(value(item))
      })
    )
  })
}

// The loop for pad `slot`, at the song tempo `bpm`.
export function libraryLoop({ bars, notes, params }: LibraryLoop, slot: number, bpm: number): Loop {
  return loopFromNotes(
    { bpm, events: [], length: 0, params, slot },
    {
      beats: bars * BEATS_PER_BAR,
      notes: notes.map(([midi, start, length], id) => ({ id, length, midi, start }))
    },
    bpm
  )
}
