import type { ChordShape, SynthParams } from '../types.js'

import { arpCycle, type ArpPattern, chordNotes } from '../synth/arp.js'
import { noteName, type Question, shuffle } from './theory.js'

// The building blocks of the later lessons' loops (backing parts, a hook, the
// melody grid's notes), the song sketch's feedback, and their quiz questions.
// Steps are 16th notes, 16 to a bar.

type Random = () => number

export const STEPS_PER_BAR = 16

export interface Chord {
  name: string
  root: number
  shape: ChordShape
}

const C: Chord = { name: 'C', root: 60, shape: 'maj' }
const A_MINOR: Chord = { name: 'Am', root: 57, shape: 'min' }

// The four chords behind countless pop songs, a bar each.
export const PROGRESSION: Chord[] = [
  C,
  { name: 'G', root: 55, shape: 'maj' },
  A_MINOR,
  { name: 'F', root: 53, shape: 'maj' }
]

export const chordAt = (bar: number): Chord => PROGRESSION[bar % PROGRESSION.length] ?? C

export type Drum = 'hat' | 'kick' | 'snare'
// One note a part plays on a step; `length` in steps.
export interface Hit {
  drum?: Drum
  length: number
  midi: number
}

export type Part = 'bass' | 'chords' | 'drums' | 'melody'

const DRUM_NOTES: Record<Drum, number> = { hat: 72, kick: 48, snare: 60 }
const drum = (d: Drum): Hit => ({ drum: d, length: 1, midi: DRUM_NOTES[d] })

// What a backing part plays on `step` (0-15) of a bar over `chord`.
export function backingAt(part: Exclude<Part, 'melody'>, step: number, chord: Chord): Hit[] {
  if (part === 'drums') {
    const hits: Hit[] = []
    if (step === 0 || step === 8 || step === 10) hits.push(drum('kick'))
    if (step === 4 || step === 12) hits.push(drum('snare'))
    if (step % 2 === 0) hits.push(drum('hat'))
    return hits
  }
  if (part === 'bass') {
    // Root notes locked to the kick, with a bounce up an octave.
    const bass: Record<number, [number, number]> = { 0: [0, 6], 6: [12, 2], 8: [0, 2], 10: [0, 6] }
    const note = bass[step]
    return note ? [{ length: note[1], midi: chord.root - 24 + note[0] }] : []
  }
  return step === 0 ? chordNotes(chord.root, chord.shape).map((midi) => ({ length: 16, midi })) : []
}

// A four-bar hook over PROGRESSION, as [bar, step, midi, length].
export const HOOK: [number, number, number, number][] = [
  [0, 0, 76, 2],
  [0, 2, 79, 2],
  [0, 4, 76, 4],
  [0, 8, 72, 4],
  [0, 12, 74, 4],
  [1, 0, 74, 2],
  [1, 2, 79, 2],
  [1, 4, 74, 4],
  [1, 8, 71, 4],
  [1, 12, 74, 4],
  [2, 0, 72, 2],
  [2, 2, 76, 2],
  [2, 4, 72, 4],
  [2, 8, 69, 8],
  [3, 0, 69, 2],
  [3, 2, 72, 2],
  [3, 4, 77, 4],
  [3, 8, 76, 4],
  [3, 12, 74, 4]
]

export function hookAt(bar: number, step: number): Hit[] {
  return HOOK.filter(([b, s]) => b === bar % 4 && s === step).map(([, , midi, length]) => ({
    length,
    midi
  }))
}

// The melody grid: 16 columns of 8th notes (two bars), one note per column at
// most, on rows of the C major pentatonic scale, lowest first. Row 0 and row 5
// are C, home.
export const MELODY_ROWS = [72, 74, 76, 79, 81, 84, 86, 88]
export const MELODY_CELLS = 16
// The backing under it: C, then A minor.
export const MELODY_CHORDS: Chord[] = [C, A_MINOR]
export type Melody = (null | number)[]

// A short catchy idea, repeated with a change at the end.
export const EXAMPLE_MELODY: Melody = [
  2,
  null,
  3,
  2,
  1,
  null,
  0,
  null,
  2,
  null,
  3,
  2,
  4,
  3,
  5,
  null
]

// A song sketch: which parts play in each section.
export interface SketchSection {
  name: string
  parts: Part[]
}

// The arp lab: the notes of the step at `index` of a pattern over `notes`.
export function arpNote(
  notes: number[],
  pattern: ArpPattern,
  index: number,
  random: Random = Math.random
): number | undefined {
  const cycle = arpCycle(notes, pattern)
  if (pattern === 'random') return cycle[Math.floor(random() * cycle.length)]
  return cycle[index % cycle.length]
}

// The note a melody plays on a 16th step, held until the next note (or two
// steps when the next column is the end).
export function melodyAt(melody: Melody, step: number): Hit[] {
  if (step % 2) return []
  const cell = step / 2
  const row = melody[cell]
  if (row === null || row === undefined) return []
  let length = 2
  while (cell + length / 2 < melody.length && melody[cell + length / 2] === null && length < 4)
    length += 2
  const midi = MELODY_ROWS[row]
  return midi === undefined ? [] : [{ length, midi }]
}

// A random melody that still sounds like one: mostly small steps, some rests,
// and it ends at home.
export function randomMelody(random: Random = Math.random): Melody {
  const top = MELODY_ROWS.length - 1
  let row = Math.floor(random() * 4) + 1
  const melody: Melody = []
  for (let i = 0; i < MELODY_CELLS - 1; i++) {
    if (i > 0 && random() < 0.3) {
      melody.push(null)
      continue
    }
    row = Math.max(0, Math.min(top, row + Math.round((random() - 0.5) * 4)))
    melody.push(row)
  }
  melody.push(row >= 3 ? 5 : 0)
  return melody
}

export const SECTIONS = ['Intro', 'Verse', 'Chorus', 'Breakdown', 'Chorus', 'Outro']

// Hear an arpeggio: up, down or up and down?
export function arpQuestion(random: Random = Math.random): Question {
  const patterns: [ArpPattern, string][] = [
    ['up', 'Up'],
    ['down', 'Down'],
    ['updown', 'Up and down']
  ]
  const [pattern, answer] = patterns[Math.floor(random() * patterns.length)] ?? ['up', 'Up']
  const root = 55 + Math.floor(random() * 8)
  const cycle = arpCycle([root, root + 4, root + 7, root + 12], pattern)
  return {
    answer,
    choices: patterns.map(([, label]) => label),
    explain: `That arp went ${answer.toLowerCase()}: ${cycle.map((n) => noteName(n, false)).join(' ')}.`,
    gap: 0.22,
    play: [...cycle, ...cycle].map((n) => [n]),
    prompt: 'Listen to the arpeggio. Which way does it go?'
  }
}

// Two notes, the same pitch, one dry and one with `effect` (named `label`):
// which one has it?
export function effectQuestion(
  label: string,
  effect: Partial<SynthParams>,
  dry: Partial<SynthParams>,
  random: Random = Math.random
): Question {
  const wetFirst = random() < 0.5
  return {
    answer: wetFirst ? 'The first' : 'The second',
    choices: ['The first', 'The second'],
    explain: `The ${wetFirst ? 'first' : 'second'} note had ${label} on it. Listen for the sound after the note ends.`,
    gap: 1.8,
    play: [[60], [60]],
    prompt: `You’ll hear a note twice. Which one has ${label}?`,
    sounds: wetFirst ? [{ ...dry, ...effect }, dry] : [dry, { ...dry, ...effect }]
  }
}

// A short tune in C: does it end at home?
export function endingQuestion(random: Random = Math.random): Question {
  const home = random() < 0.5
  const middle = shuffle([64, 67, 65, 62, 69], random).slice(0, 4)
  const last = home ? 60 : ([62, 65, 71][Math.floor(random() * 3)] ?? 62)
  return {
    answer: home ? 'Finished' : 'Unfinished',
    choices: ['Finished', 'Unfinished'],
    explain: home
      ? 'It ended on C, the home note of the key, so it sounds finished.'
      : `It ended on ${noteName(last, false)}, not C, so it sounds like it wants to keep going.`,
    play: [[48, 52, 55, 60], ...middle.map((n) => [n]), [last]],
    prompt: 'Listen to the tune (after the chord that sets the key). Does it sound finished?'
  }
}

// Tips on a sketch's shape; none when it builds and releases energy well.
export function sketchTips(sketch: SketchSection[]): string[] {
  const tips: string[] = []
  const count = (name: string) =>
    Math.max(0, ...sketch.filter((s) => s.name === name).map((s) => s.parts.length))
  const silent = sketch.filter((s) => s.parts.length === 0).map((s) => s.name)
  const same = sketch.every(
    (s) => [...s.parts].sort().join() === [...(sketch[0]?.parts ?? [])].sort().join()
  )

  if (silent.length)
    tips.push(
      `${[...new Set(silent)].join(' and ')}: nothing plays there yet. Give it at least one part.`
    )
  if (same && sketch.length > 1)
    tips.push(
      'Every section sounds the same, so nothing changes. Take some parts out of the quieter sections.'
    )
  if (count('Chorus') < Math.max(count('Verse'), count('Intro')))
    tips.push(
      'The chorus should be the biggest moment: give it at least as many parts as the verse.'
    )
  if (count('Intro') === 4)
    tips.push('Try starting smaller: an intro with just one or two parts leaves room to grow.')
  if (count('Breakdown') >= count('Chorus') && count('Chorus') > 0)
    tips.push(
      'Pull some parts out of the breakdown, so the last chorus hits harder when they come back.'
    )
  if (!sketch.some((s) => s.parts.includes('melody')))
    tips.push(
      'Add the melody somewhere (the chorus is a good place): it’s the part people remember.'
    )
  return tips
}
