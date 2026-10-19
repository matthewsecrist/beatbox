import { describe, expect, it } from 'vitest'

import {
  BEATS_PER_BAR,
  countLabel,
  keySigQuestion,
  layout,
  ledgerLines,
  missingBeatsQuestion,
  noteShape,
  noteValueQuestion,
  spell,
  splitLines,
  staffNoteQuestion,
  staffPosition,
  totalBeats,
  TUNES,
  writtenName
} from './notation.js'

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

describe('spelling notes', () => {
  it('writes black keys as sharps, or flats in a flat key', () => {
    expect(spell(61)).toMatchObject({ accidental: '♯', letter: 'C', octave: 4 })
    expect(spell(70, 'F')).toMatchObject({ accidental: '', letter: 'B' })
    expect(spell(70)).toMatchObject({ accidental: '♯', letter: 'A' })
  })

  it('leaves out what the key signature already says, and cancels it with a natural', () => {
    expect(spell(66, 'G')).toMatchObject({ accidental: '', letter: 'F' })
    expect(spell(65, 'G')).toMatchObject({ accidental: '♮', letter: 'F' })
    expect(spell(73, 'D').accidental).toBe('')
    expect(spell(71, 'F')).toMatchObject({ accidental: '♮', letter: 'B' })
  })

  it('names notes as they sound', () => {
    expect(writtenName(66, 'D')).toBe('F♯')
    expect(writtenName(70, 'F')).toBe('B♭')
    expect(writtenName(60)).toBe('C')
  })
})

describe('the staff', () => {
  it('puts the lines where the rhymes say', () => {
    // Every Good Burger Deserves Fries; Good Burgers Don't Fall Apart.
    expect([64, 67, 71, 74, 77].map((m) => staffPosition(m, 'treble'))).toStrictEqual([
      0, 2, 4, 6, 8
    ])
    expect([43, 47, 50, 53, 57].map((m) => staffPosition(m, 'bass'))).toStrictEqual([0, 2, 4, 6, 8])
    // FACE in the treble spaces.
    expect([65, 69, 72, 76].map((m) => staffPosition(m, 'treble'))).toStrictEqual([1, 3, 5, 7])
  })

  it('gives middle C a ledger line on both staffs', () => {
    expect(staffPosition(60, 'treble')).toBe(-2)
    expect(staffPosition(60, 'bass')).toBe(10)
    expect(ledgerLines(-2)).toStrictEqual([-2])
    expect(ledgerLines(-5)).toStrictEqual([-2, -4])
    expect(ledgerLines(13)).toStrictEqual([10, 12])
    expect(ledgerLines(4)).toStrictEqual([])
  })

  it('draws a sharp on the same position as its letter', () => {
    expect(staffPosition(66, 'treble')).toBe(staffPosition(65, 'treble'))
  })
})

describe('note lengths', () => {
  it('know their shapes', () => {
    expect(noteShape(4)).toMatchObject({ dot: false, flags: 0, hollow: true, stem: false })
    expect(noteShape(2)).toMatchObject({ hollow: true, stem: true })
    expect(noteShape(3)).toMatchObject({ base: 2, dot: true })
    expect(noteShape(1.5)).toMatchObject({ base: 1, dot: true, hollow: false })
    expect(noteShape(0.5).flags).toBe(1)
    expect(noteShape(0.25).flags).toBe(2)
  })

  it('are counted 1 e & a', () => {
    expect([0, 0.25, 0.5, 0.75, 1, 3.5, 4, 5.25].map(countLabel)).toStrictEqual([
      '1',
      'e',
      '&',
      'a',
      '2',
      '&',
      '1',
      'e'
    ])
  })
})

describe('layout', () => {
  it('puts a bar line after every full bar', () => {
    const notes = [2, 2, 1, 1, 1, 1].map((beats) => ({ beats, midi: 71 }))
    const { bars, notes: placed } = layout(notes, 50)
    expect(bars).toHaveLength(2)
    expect(placed.map((p) => p.beat)).toStrictEqual([0, 2, 4, 5, 6, 7])
    expect(placed[2]?.x ?? 0).toBeGreaterThan(bars[0] ?? Infinity)
  })

  it('closes an unfinished bar too', () => {
    expect(layout([{ beats: 1, midi: 71 }], 50).bars).toHaveLength(1)
    expect(layout([], 50).bars).toHaveLength(1)
  })

  it('splits a piece into lines of whole bars', () => {
    const notes = Array.from({ length: 10 }, () => ({ beats: 1, midi: 60 }))
    const lines = splitLines(notes, 2)
    expect(lines.map((l) => l.offset)).toStrictEqual([0, 8])
    expect(lines.map((l) => l.notes.length)).toStrictEqual([8, 2])
  })
})

describe('tunes', () => {
  it.each(TUNES.map((t) => [t.name, t] as const))('%s fills whole bars', (_, tune) => {
    expect(totalBeats(tune.notes) % BEATS_PER_BAR).toBe(0)
    for (const line of splitLines(tune.notes, 1)) expect(totalBeats(line.notes)).toBe(BEATS_PER_BAR)
  })
})

describe('questions', () => {
  it('name staff notes from four letters', () => {
    const random = seeded(4)
    for (let i = 0; i < 100; i++) {
      const q = staffNoteQuestion(i % 2 ? 'bass' : 'treble', random)
      const midi = q.staff?.notes[0]?.midi ?? 0
      expect(q.answer).toBe(spell(midi).letter)
      expect(new Set(q.choices).size).toBe(4)
      expect(q.choices).toContain(q.answer)
    }
  })

  it('ask how long a note lasts, with the answer among the choices', () => {
    const random = seeded(8)
    for (let i = 0; i < 100; i++) {
      const q = noteValueQuestion(random)
      expect(q.choices).toContain(q.answer)
      expect(new Set(q.choices).size).toBe(q.choices.length)
    }
  })

  it('leave out as many beats as they say', () => {
    const random = seeded(6)
    for (let i = 0; i < 50; i++) {
      const q = missingBeatsQuestion(random)
      const missing = BEATS_PER_BAR - totalBeats(q.staff?.notes ?? [])
      expect(q.answer).toBe(missing === 1 ? '1 beat' : `${missing} beats`)
    }
  })

  it('show a note the key signature makes sharp', () => {
    const random = seeded(1)
    for (let i = 0; i < 30; i++) {
      const q = keySigQuestion(random)
      const midi = q.staff?.notes[0]?.midi ?? 0
      expect(q.answer).toBe(writtenName(midi, q.staff?.key))
      expect(spell(midi, q.staff?.key).accidental).toBe('')
    }
  })
})
