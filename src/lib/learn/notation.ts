import type { Question } from './theory.js'

import { shuffle } from './theory.js'

// Sheet music for the Reading lessons: spelling notes for a key, where they sit
// on a staff, what each note length looks like, laying a line of music out in
// bars, and the quiz questions about reading it. Lengths are in beats (a
// quarter note is 1), with 4 beats to a bar.

export type Clef = 'bass' | 'treble'

export type KeySig = 'C' | 'D' | 'F' | 'G'
// What a staff shows.
export interface Notation {
  clef: Clef
  key?: KeySig
  notes: StaffNote[]
  // Show the 4/4 time signature (the first line of a piece).
  time?: boolean
}

// A note or, without `midi`, a rest.
export interface StaffNote {
  beats: number
  midi?: number
}

type Random = () => number

export const BEATS_PER_BAR = 4

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const WHITE = [0, 2, 4, 5, 7, 9, 11]

// The letters a key's signature sharpens or flattens, and where each sign sits
// on each clef's staff (steps up from the bottom line).
export const KEY_SIGS: Record<
  KeySig,
  { flat: boolean; letters: string[]; places: Record<Clef, number[]> }
> = {
  C: { flat: false, letters: [], places: { bass: [], treble: [] } },
  D: { flat: false, letters: ['F', 'C'], places: { bass: [6, 3], treble: [8, 5] } },
  F: { flat: true, letters: ['B'], places: { bass: [2], treble: [4] } },
  G: { flat: false, letters: ['F'], places: { bass: [6], treble: [8] } }
}

export type Accidental = '' | '♭' | '♮' | '♯'

export interface Spelled {
  // The sign written before it: none when the key signature already says so.
  accidental: Accidental
  letter: string
  octave: number
  // Letter steps up from C0, so each line and space of a staff is one step.
  step: number
}

const mod12 = (n: number): number => ((n % 12) + 12) % 12

// How a note is written in `key`: black keys are sharps, or flats in a flat key.
export function spell(midi: number, key: KeySig = 'C'): Spelled {
  const sig = KEY_SIGS[key]
  const pc = mod12(midi)
  const octave = Math.floor(midi / 12) - 1
  let index = WHITE.indexOf(pc)
  let alter = 0
  if (index < 0) {
    alter = sig.flat ? -1 : 1
    index = WHITE.indexOf(pc - alter)
  }
  const letter = LETTERS[index] ?? 'C'
  const signed = sig.letters.includes(letter) ? (sig.flat ? -1 : 1) : 0
  const accidental: Accidental =
    alter === signed ? '' : alter === 1 ? '♯' : alter === -1 ? '♭' : '♮'
  return { accidental, letter, octave, step: octave * 7 + index }
}

// The bottom line's step: E4 on the treble staff, G2 on the bass staff.
const BOTTOM_LINE: Record<Clef, number> = { bass: 2 * 7 + 4, treble: 4 * 7 + 2 }

// Where a note sits: steps up from the bottom line (even on a line, odd in a
// space; the five lines are 0, 2, 4, 6 and 8).
export const staffPosition = (midi: number, clef: Clef, key: KeySig = 'C'): number =>
  spell(midi, key).step - BOTTOM_LINE[clef]

export interface NoteValue {
  beats: number
  name: string
  rest: string
}

// The short extra lines a note above or below the staff needs.
export function ledgerLines(position: number): number[] {
  const lines: number[] = []
  for (let p = -2; p >= position; p -= 2) lines.push(p)
  for (let p = 10; p <= position; p += 2) lines.push(p)
  return lines
}

// The note lengths the lessons use, longest first.
export const NOTE_VALUES: NoteValue[] = [
  { beats: 4, name: 'Whole note', rest: 'Whole rest' },
  { beats: 3, name: 'Dotted half note', rest: 'Dotted half rest' },
  { beats: 2, name: 'Half note', rest: 'Half rest' },
  { beats: 1.5, name: 'Dotted quarter note', rest: 'Dotted quarter rest' },
  { beats: 1, name: 'Quarter note', rest: 'Quarter rest' },
  { beats: 0.5, name: 'Eighth note', rest: 'Eighth rest' },
  { beats: 0.25, name: 'Sixteenth note', rest: 'Sixteenth rest' }
]

export interface Shape {
  // The undotted length it's drawn as.
  base: number
  dot: boolean
  // Flags on the stem: one for an eighth, two for a sixteenth.
  flags: number
  hollow: boolean
  stem: boolean
}

// How a note of `beats` is drawn.
export function noteShape(beats: number): Shape {
  const dot = [0.75, 1.5, 3].includes(beats)
  const base = dot ? (beats * 2) / 3 : beats
  return {
    base,
    dot,
    flags: base === 0.5 ? 1 : base === 0.25 ? 2 : 0,
    hollow: base >= 2,
    stem: base < 4
  }
}

const EPSILON = 1e-6

export interface Layout {
  // x of each bar line, the last one closing the line.
  bars: number[]
  notes: Placed[]
  width: number
}

export interface Placed {
  // The beat it starts on, from the start of the line.
  beat: number
  index: number
  note: StaffNote
  x: number
}

// Counting out loud: "1", "e", "&", "a" for each quarter of a beat.
export function countLabel(beat: number): string {
  const inBar = (((beat % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR) + EPSILON
  const whole = Math.floor(inBar)
  const part = Math.round((inBar - whole) * 4)
  return part === 0 ? String(whole + 1) : (['', 'e', '&', 'a'][part] ?? '')
}

// Lays notes out from `x0`, each taking room for its length, with a bar line
// after every full bar.
export function layout(notes: StaffNote[], x0: number): Layout {
  const placed: Placed[] = []
  const bars: number[] = []
  let x = x0
  let beat = 0
  notes.forEach((note, index) => {
    const room = 20 + note.beats * 22
    placed.push({ beat, index, note, x: x + 10 })
    x += room
    beat += note.beats
    if (Math.abs(beat / BEATS_PER_BAR - Math.round(beat / BEATS_PER_BAR)) < EPSILON) {
      bars.push(x)
      x += 8
    }
  })
  if (!bars.length || (bars.at(-1) ?? 0) < x - 8) bars.push(x)
  return { bars, notes: placed, width: (bars.at(-1) ?? x) + 6 }
}

// Splits a piece into lines of `barsPerLine` bars, with each line's offset into
// the notes.
export function splitLines(
  notes: StaffNote[],
  barsPerLine: number
): { notes: StaffNote[]; offset: number }[] {
  const lines: { notes: StaffNote[]; offset: number }[] = []
  let current: StaffNote[] = []
  let offset = 0
  let beats = 0
  notes.forEach((note, i) => {
    current.push(note)
    beats += note.beats
    if (beats >= barsPerLine * BEATS_PER_BAR - EPSILON) {
      lines.push({ notes: current, offset })
      current = []
      offset = i + 1
      beats = 0
    }
  })
  if (current.length) lines.push({ notes: current, offset })
  return lines
}

export const totalBeats = (notes: StaffNote[]): number => notes.reduce((t, n) => t + n.beats, 0)

// A note's name, like "F♯" (or "B♭" in a flat key).
export function writtenName(midi: number, key: KeySig = 'C'): string {
  const black = !WHITE.includes(mod12(midi))
  return spell(midi, key).letter + (black ? (KEY_SIGS[key].flat ? '♭' : '♯') : '')
}

// The white keys each clef's quiz uses: the staff and a ledger line either side.
const RANGES: Record<Clef, [number, number]> = { bass: [40, 60], treble: [60, 81] }

export function randomNatural(clef: Clef, random: Random = Math.random): number {
  const [low, high] = RANGES[clef]
  const whites: number[] = []
  for (let m = low; m <= high; m++) if (WHITE.includes(mod12(m))) whites.push(m)
  return whites[Math.floor(random() * whites.length)] ?? low
}

// A note on the staff: what's it called?
export function staffNoteQuestion(clef: Clef, random: Random = Math.random): Question {
  const midi = randomNatural(clef, random)
  const answer = spell(midi).letter
  const others = shuffle(
    LETTERS.filter((l) => l !== answer),
    random
  ).slice(0, 3)
  const position = staffPosition(midi, clef)
  const where =
    position < 0 || position > 8
      ? 'on a ledger line or just past the staff'
      : position % 2 === 0
        ? `on line ${position / 2 + 1} from the bottom`
        : `in space ${(position + 1) / 2} from the bottom`
  return {
    answer,
    choices: shuffle([answer, ...others], random),
    explain: `It sits ${where} of the ${clef} staff: ${answer}.`,
    prompt: `What is this note called on the ${clef} clef?`,
    staff: { clef, notes: [{ beats: 4, midi }] }
  }
}

const beatsText = (beats: number): string =>
  beats === 0.5
    ? 'Half a beat'
    : beats === 0.25
      ? 'A quarter of a beat'
      : `${beats} ${beats === 1 ? 'beat' : 'beats'}`

export interface Tune {
  clef: Clef
  key: KeySig
  name: string
  notes: StaffNote[]
}

// A note the key signature changes: what's it called?
export function keySigQuestion(random: Random = Math.random): Question {
  const key: KeySig = random() < 0.5 ? 'G' : 'D'
  const options: [number, string][] =
    key === 'G'
      ? [
          [66, 'F'],
          [78, 'F']
        ]
      : [
          [66, 'F'],
          [73, 'C']
        ]
  const [midi, letter] = options[Math.floor(random() * options.length)] ?? [66, 'F']
  const answer = `${letter}♯`
  return {
    answer,
    choices: shuffle([answer, letter, `${letter}♭`], random),
    explain: `The ♯ on the ${letter} line at the start (the key signature of ${key} major) makes every ${letter} sharp, so this is ${answer}.`,
    prompt: 'Look at the start of the staff. What is this note called?',
    staff: { clef: 'treble', key, notes: [{ beats: 4, midi }] }
  }
}

// A bar with beats missing: how many?
export function missingBeatsQuestion(random: Random = Math.random): Question {
  const missing = random() < 0.5 ? 1 : 2
  const pool = [2, 1, 1, 0.5, 0.5]
  const notes: StaffNote[] = []
  let left = BEATS_PER_BAR - missing
  while (left > EPSILON) {
    const fits = pool.filter((b) => b <= left + EPSILON)
    const beats = fits[Math.floor(random() * fits.length)] ?? 1
    notes.push({ beats, midi: 72 - 2 * Math.floor(random() * 3) })
    left -= beats
  }
  return {
    answer: beatsText(missing),
    choices: ['1 beat', '2 beats', '3 beats'],
    explain: `The notes add up to ${BEATS_PER_BAR - missing} beats, so ${missing === 1 ? '1 beat is' : '2 beats are'} missing from the bar of 4.`,
    prompt: 'This bar should last 4 beats. How many beats are missing?',
    staff: { clef: 'treble', notes, time: true }
  }
}

// A note length: how many beats?
export function noteValueQuestion(random: Random = Math.random): Question {
  const values = NOTE_VALUES.filter((v) => v.beats !== 1.5)
  const value = values[Math.floor(random() * values.length)] ?? values[0]
  const beats = value?.beats ?? 1
  const rest = random() < 0.25 && beats !== 3
  const choices = shuffle(
    [
      beats,
      ...shuffle(
        values.map((v) => v.beats).filter((b) => b !== beats),
        random
      ).slice(0, 3)
    ],
    random
  ).sort((a, b) => b - a)
  return {
    answer: beatsText(beats),
    choices: choices.map(beatsText),
    explain: `That’s a ${(rest ? value?.rest : value?.name)?.toLowerCase()}: ${beatsText(beats).toLowerCase()}.`,
    prompt: `How long does this ${rest ? 'rest' : 'note'} last?`,
    staff: { clef: 'treble', notes: [rest ? { beats } : { beats, midi: 71 }] }
  }
}

// [midi, beats] pairs, for writing tunes compactly.
const tune = (pairs: [number, number][]): StaffNote[] =>
  pairs.map(([midi, beats]) => ({ beats, midi }))

// Old tunes (all public domain) to sight-read, easiest first.
export const TUNES: Tune[] = [
  {
    clef: 'treble',
    key: 'C',
    name: 'Twinkle, Twinkle, Little Star',
    notes: tune([
      [60, 1],
      [60, 1],
      [67, 1],
      [67, 1],
      [69, 1],
      [69, 1],
      [67, 2],
      [65, 1],
      [65, 1],
      [64, 1],
      [64, 1],
      [62, 1],
      [62, 1],
      [60, 2]
    ])
  },
  {
    clef: 'treble',
    key: 'C',
    name: 'Mary Had a Little Lamb',
    notes: tune([
      [64, 1],
      [62, 1],
      [60, 1],
      [62, 1],
      [64, 1],
      [64, 1],
      [64, 2],
      [62, 1],
      [62, 1],
      [62, 2],
      [64, 1],
      [67, 1],
      [67, 2],
      [64, 1],
      [62, 1],
      [60, 1],
      [62, 1],
      [64, 1],
      [64, 1],
      [64, 1],
      [64, 1],
      [62, 1],
      [62, 1],
      [64, 1],
      [62, 1],
      [60, 4]
    ])
  },
  {
    clef: 'treble',
    key: 'D',
    name: 'Ode to Joy (in D major)',
    notes: tune([
      [66, 1],
      [66, 1],
      [67, 1],
      [69, 1],
      [69, 1],
      [67, 1],
      [66, 1],
      [64, 1],
      [62, 1],
      [62, 1],
      [64, 1],
      [66, 1],
      [66, 1.5],
      [64, 0.5],
      [64, 2],
      [66, 1],
      [66, 1],
      [67, 1],
      [69, 1],
      [69, 1],
      [67, 1],
      [66, 1],
      [64, 1],
      [62, 1],
      [62, 1],
      [64, 1],
      [66, 1],
      [64, 1.5],
      [62, 0.5],
      [62, 2]
    ])
  },
  {
    clef: 'bass',
    key: 'C',
    name: 'Bass clef warm-up',
    notes: tune([
      [48, 1],
      [50, 1],
      [52, 1],
      [53, 1],
      [55, 2],
      [55, 2],
      [57, 1],
      [57, 1],
      [55, 1],
      [53, 1],
      [52, 1],
      [50, 1],
      [48, 2]
    ])
  }
]
