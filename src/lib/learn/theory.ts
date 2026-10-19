import type { SynthParams } from '../types.js'
import type { Notation } from './notation.js'

// Music theory for the lessons: note names, intervals, scales and chords, all as
// MIDI note numbers (60 is middle C), plus the quiz questions built from them.

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const

export const MIDDLE_C = 60

// Steps above the root, in half steps.
export const INTERVALS: { name: string; short: string; steps: number }[] = [
  { name: 'Half step (minor 2nd)', short: 'm2', steps: 1 },
  { name: 'Whole step (major 2nd)', short: 'M2', steps: 2 },
  { name: 'Minor 3rd', short: 'm3', steps: 3 },
  { name: 'Major 3rd', short: 'M3', steps: 4 },
  { name: 'Perfect 4th', short: 'P4', steps: 5 },
  { name: 'Tritone', short: 'TT', steps: 6 },
  { name: 'Perfect 5th', short: 'P5', steps: 7 },
  { name: 'Minor 6th', short: 'm6', steps: 8 },
  { name: 'Major 6th', short: 'M6', steps: 9 },
  { name: 'Minor 7th', short: 'm7', steps: 10 },
  { name: 'Major 7th', short: 'M7', steps: 11 },
  { name: 'Octave', short: 'P8', steps: 12 }
]

export type ScaleId = 'blues' | 'major' | 'minor' | 'pentatonic'

// Each scale as the steps between its notes, root to the octave above.
export const SCALES: Record<ScaleId, { label: string; pattern: number[] }> = {
  blues: { label: 'Blues', pattern: [3, 2, 1, 1, 3, 2] },
  major: { label: 'Major', pattern: [2, 2, 1, 2, 2, 2, 1] },
  minor: { label: 'Natural minor', pattern: [2, 1, 2, 2, 1, 2, 2] },
  pentatonic: { label: 'Major pentatonic', pattern: [2, 2, 3, 2, 3] }
}

export type ChordId = '7' | 'dim' | 'maj' | 'min'

// Each chord as half steps above its root.
export const CHORDS: Record<ChordId, { label: string; steps: number[] }> = {
  '7': { label: 'Dominant 7th', steps: [0, 4, 7, 10] },
  dim: { label: 'Diminished', steps: [0, 3, 6] },
  maj: { label: 'Major', steps: [0, 4, 7] },
  min: { label: 'Minor', steps: [0, 3, 7] }
}

export const isBlack = (midi: number): boolean => [1, 3, 6, 8, 10].includes(mod12(midi))

export function chordNotes(root: number, chord: ChordId): number[] {
  return CHORDS[chord].steps.map((s) => root + s)
}

// The triad built on each degree of the major scale: a note, the one two scale
// notes above it and the one two above that, so every chord stays in the key.
export function keyChords(root: number): { name: string; notes: number[]; numeral: string }[] {
  const scale = scaleNotes(root, 'major').slice(0, 7)
  const at = (i: number) => (scale[i % 7] ?? root) + 12 * Math.floor(i / 7)
  const numerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
  return scale.map((note, i) => {
    const notes = [note, at(i + 2), at(i + 4)]
    const third = (notes[1] ?? note) - note
    const fifth = (notes[2] ?? note) - note
    const quality = fifth === 6 ? 'dim' : third === 3 ? 'm' : ''
    return { name: noteName(note, false) + quality, notes, numeral: numerals[i] ?? '' }
  })
}

// "C4" for middle C; `octave: false` leaves the number off.
export function noteName(midi: number, octave = true): string {
  const name = NOTE_NAMES[mod12(midi)] ?? '?'
  return octave ? `${name}${Math.floor(midi / 12) - 1}` : name
}

// The scale's notes from `root` up to the octave above, both included.
export function scaleNotes(root: number, scale: ScaleId): number[] {
  const notes = [root]
  for (const step of SCALES[scale].pattern) notes.push((notes.at(-1) ?? root) + step)
  return notes
}

// Seconds per beat at `bpm`.
export const beatSeconds = (bpm: number): number => 60 / bpm

const mod12 = (n: number): number => ((n % 12) + 12) % 12

// A quiz question. `play` is what to listen to: each group of notes sounds
// together, one group after another.
export interface Question {
  answer: string
  choices: string[]
  explain: string
  // Seconds between the groups it plays (0.7 when left out).
  gap?: number
  play?: number[][]
  prompt: string
  // Each group's sound, in place of the piano.
  sounds?: Partial<SynthParams>[]
  // Music to read, shown with the question.
  staff?: Notation
}

type Random = () => number

const pick = <T>(items: readonly T[], random: Random): T => {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) throw new Error('Nothing to pick from')
  return item
}

// A beat for the rhythm grid: per drum, which of a bar's 16 steps it plays on.
export type Beat = Record<string, number[]>

// Hear a chord: major or minor?
export function chordQuestion(random: Random = Math.random): Question {
  const chord: ChordId = random() < 0.5 ? 'maj' : 'min'
  const root = 55 + Math.floor(random() * 10)
  const notes = chordNotes(root, chord)
  return {
    answer: CHORDS[chord].label,
    choices: [CHORDS.maj.label, CHORDS.min.label],
    explain: `${noteName(root, false)}${chord === 'min' ? 'm' : ''}: ${notes.map((n) => noteName(n, false)).join(' ')}. The middle note decides it.`,
    play: [...notes.map((n) => [n]), notes],
    prompt: 'Listen to the chord, played one note at a time and then together. Major or minor?'
  }
}

// Two notes one after the other: which is higher?
export function higherQuestion(random: Random = Math.random): Question {
  const first = 55 + Math.floor(random() * 18)
  const gap = 1 + Math.floor(random() * 7)
  const up = random() < 0.5
  const second = up ? first + gap : first - gap
  return {
    answer: up ? 'The second' : 'The first',
    choices: ['The first', 'The second'],
    explain: `${noteName(first)} then ${noteName(second)}: ${gap} half ${gap === 1 ? 'step' : 'steps'} ${up ? 'up' : 'down'}.`,
    play: [[first], [second]],
    prompt: 'Listen to the two notes. Which one is higher?'
  }
}

// Which note belongs to a major key?
export function inKeyQuestion(random: Random = Math.random): Question {
  const root = pick([60, 62, 64, 65, 67, 69], random)
  const notes = scaleNotes(root, 'major').slice(0, 7)
  const inScale = (n: number) => notes.some((m) => mod12(m) === mod12(n))
  // A major scale never has three notes in a row, so every one of its notes has a
  // neighbour outside it.
  const inKey = pick(notes.slice(1), random)
  const wrong = [inKey + 1, inKey - 1].find((n) => !inScale(n)) ?? inKey + 1
  const answer = noteName(inKey, false)
  return {
    answer,
    choices: shuffle([answer, noteName(wrong, false)], random),
    explain: `The ${noteName(root, false)} major scale is ${notes.map((n) => noteName(n, false)).join(' ')}.`,
    prompt: `Which of these notes is in the key of ${noteName(root, false)} major?`
  }
}

// Hear an interval and name it, from `choices` (half steps).
export function intervalQuestion(
  choices: number[] = [2, 4, 7, 12],
  random: Random = Math.random
): Question {
  const steps = pick(choices, random)
  const root = 55 + Math.floor(random() * 10)
  const name = (s: number) => INTERVALS.find((i) => i.steps === s)?.name ?? `${s} half steps`
  return {
    answer: name(steps),
    choices: choices.map(name),
    explain: `${noteName(root)} up to ${noteName(root + steps)} is ${steps} half steps: a ${name(steps).toLowerCase()}.`,
    play: [[root], [root + steps], [root, root + steps]],
    prompt: 'Listen: two notes, then both together. Which interval is it?'
  }
}

// Whether `grid` (per drum, a bar of steps on or off) plays exactly `target`'s
// steps on each of its drums.
export function matchesBeat(grid: Record<string, boolean[]>, target: Beat): boolean {
  return Object.entries(target).every(([drum, steps]) => {
    const row = grid[drum] ?? []
    return row.every((on, i) => on === steps.includes(i)) && steps.every((i) => row[i])
  })
}

// Hear a scale going up: major or minor?
export function scaleQuestion(random: Random = Math.random): Question {
  const scale: ScaleId = random() < 0.5 ? 'major' : 'minor'
  const root = 57 + Math.floor(random() * 8)
  return {
    answer: SCALES[scale].label,
    choices: [SCALES.major.label, SCALES.minor.label],
    explain:
      scale === 'major'
        ? 'Major: its 3rd note is 4 half steps above the root, so it sounds bright.'
        : 'Minor: its 3rd note is only 3 half steps above the root, so it sounds darker.',
    play: scaleNotes(root, scale).map((n) => [n]),
    prompt: 'Listen to the scale. Is it major or minor?'
  }
}

export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const a = out[i]
    const b = out[j]
    if (a === undefined || b === undefined) continue
    out[i] = b
    out[j] = a
  }
  return out
}

// Spell a major or minor chord.
export function spellChordQuestion(random: Random = Math.random): Question {
  const root = pick([60, 62, 64, 65, 67, 69, 71], random)
  const chord: ChordId = random() < 0.5 ? 'maj' : 'min'
  const spell = (notes: number[]) => notes.map((n) => noteName(n, false)).join(' ')
  const answer = spell(chordNotes(root, chord))
  const other = spell(chordNotes(root, chord === 'maj' ? 'min' : 'maj'))
  const sus = spell([root, root + 5, root + 7])
  return {
    answer,
    choices: shuffle([answer, other, sus], random),
    explain: `${CHORDS[chord].label}: the root, ${chord === 'maj' ? '4 half steps up, then 3' : '3 half steps up, then 4'} more: ${answer}.`,
    play: [chordNotes(root, chord)],
    prompt: `Which notes make ${noteName(root, false)} ${CHORDS[chord].label.toLowerCase()}?`
  }
}

// Which note is `steps` half steps above a random white key?
export function stepAboveQuestion(random: Random = Math.random): Question {
  const whites = [60, 62, 64, 65, 67, 69, 71]
  const root = pick(whites, random)
  const steps = random() < 0.5 ? 1 : 2
  const answer = noteName(root + steps, false)
  const wrong = [root - 1, root + (steps === 1 ? 2 : 1), root + 3].map((m) => noteName(m, false))
  return {
    answer,
    choices: shuffle([answer, ...wrong], random),
    explain: `Count ${steps === 1 ? 'one key' : 'two keys'} up from ${noteName(root, false)}, black keys included: ${answer}.`,
    play: [[root], [root + steps]],
    prompt: `Which note is a ${steps === 1 ? 'half' : 'whole'} step above ${noteName(root, false)}?`
  }
}
