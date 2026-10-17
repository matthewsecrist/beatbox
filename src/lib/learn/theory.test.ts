import { describe, expect, it } from 'vitest'

import {
  chordNotes,
  chordQuestion,
  higherQuestion,
  inKeyQuestion,
  intervalQuestion,
  isBlack,
  keyChords,
  matchesBeat,
  noteName,
  type Question,
  scaleNotes,
  scaleQuestion,
  shuffle,
  spellChordQuestion,
  stepAboveQuestion
} from './theory.js'

// A repeatable stand-in for Math.random.
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const names = (notes: number[]) => notes.map((n) => noteName(n, false)).join(' ')

describe('notes', () => {
  it('names notes with their octave', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(69)).toBe('A4')
    expect(noteName(61, false)).toBe('C♯')
    expect(noteName(48)).toBe('C3')
  })

  it('knows the black keys', () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlack)).toStrictEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      true
    ])
  })
})

describe('scales and chords', () => {
  it('builds scales from their step patterns', () => {
    expect(names(scaleNotes(60, 'major'))).toBe('C D E F G A B C')
    expect(names(scaleNotes(69, 'minor'))).toBe('A B C D E F G A')
    expect(names(scaleNotes(67, 'major'))).toBe('G A B C D E F♯ G')
    expect(names(scaleNotes(60, 'pentatonic'))).toBe('C D E G A C')
    expect(names(scaleNotes(60, 'blues'))).toBe('C D♯ F F♯ G A♯ C')
  })

  it('builds chords from their root', () => {
    expect(names(chordNotes(60, 'maj'))).toBe('C E G')
    expect(names(chordNotes(69, 'min'))).toBe('A C E')
    expect(names(chordNotes(67, '7'))).toBe('G B D F')
  })

  it('finds the seven chords of a major key', () => {
    expect(keyChords(60).map((c) => c.name)).toStrictEqual([
      'C',
      'Dm',
      'Em',
      'F',
      'G',
      'Am',
      'Bdim'
    ])
    expect(keyChords(67).map((c) => c.name)).toStrictEqual([
      'G',
      'Am',
      'Bm',
      'C',
      'D',
      'Em',
      'F♯dim'
    ])
    expect(names(keyChords(60)[6]?.notes ?? [])).toBe('B D F')
  })
})

describe('quiz questions', () => {
  const makers: [string, (random: () => number) => Question][] = [
    ['higher', higherQuestion],
    ['step above', stepAboveQuestion],
    ['interval', (r) => intervalQuestion(undefined, r)],
    ['scale', scaleQuestion],
    ['in key', inKeyQuestion],
    ['chord', chordQuestion],
    ['spell chord', spellChordQuestion]
  ]

  it.each(makers)('%s questions always have their answer among distinct choices', (_, make) => {
    const random = seeded(7)
    for (let i = 0; i < 200; i++) {
      const q = make(random)
      expect(q.choices).toContain(q.answer)
      expect(new Set(q.choices).size).toBe(q.choices.length)
    }
  })

  it('asks which note is in a key with one in and one out', () => {
    const random = seeded(3)
    for (let i = 0; i < 100; i++) {
      const q = inKeyQuestion(random)
      const key = /key of (\S+) major/.exec(q.prompt)?.[1]
      const root = 60 + ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A'].indexOf(key ?? '')
      const scale = scaleNotes(root, 'major').map((n) => noteName(n, false))
      const wrong = q.choices.find((c) => c !== q.answer)
      expect(scale).toContain(q.answer)
      expect(scale).not.toContain(wrong)
    }
  })

  it('plays the notes it asks about', () => {
    const q = chordQuestion(() => 0.1)
    expect(q.answer).toBe('Major')
    expect(q.play?.at(-1)).toStrictEqual([56, 60, 63])
  })
})

describe('beats', () => {
  const row = (on: number[]) => Array.from({ length: 16 }, (_, i) => on.includes(i))

  it('matches a grid against a beat', () => {
    const target = { kick: [0, 8], snare: [4, 12] }
    expect(matchesBeat({ kick: row([0, 8]), snare: row([4, 12]) }, target)).toBe(true)
    expect(matchesBeat({ kick: row([0, 8, 9]), snare: row([4, 12]) }, target)).toBe(false)
    expect(matchesBeat({ kick: row([0]), snare: row([4, 12]) }, target)).toBe(false)
    expect(matchesBeat({ kick: row([0, 8]) }, target)).toBe(false)
  })
})

it('shuffles without losing anything', () => {
  const out = shuffle([1, 2, 3, 4, 5], seeded(1))
  expect([...out].sort()).toStrictEqual([1, 2, 3, 4, 5])
})
