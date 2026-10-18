import { describe, expect, it } from 'vitest'

import {
  arpNote,
  arpQuestion,
  backingAt,
  chordAt,
  effectQuestion,
  endingQuestion,
  EXAMPLE_MELODY,
  HOOK,
  hookAt,
  MELODY_CELLS,
  MELODY_ROWS,
  melodyAt,
  randomMelody,
  SECTIONS,
  type SketchSection,
  sketchTips
} from './arrange.js'

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const sketch = (parts: SketchSection['parts'][]): SketchSection[] =>
  SECTIONS.map((name, i) => ({ name, parts: parts[i] ?? [] }))

describe('backing', () => {
  it('plays a backbeat with hats on the 8ths', () => {
    const at = (step: number) => backingAt('drums', step, chordAt(0)).map((h) => h.drum)
    expect(at(0)).toStrictEqual(['kick', 'hat'])
    expect(at(4)).toStrictEqual(['snare', 'hat'])
    expect(at(1)).toStrictEqual([])
  })

  it('puts the bass on the chord root, two octaves down', () => {
    expect(backingAt('bass', 0, chordAt(1))).toStrictEqual([{ length: 6, midi: 31 }])
    expect(backingAt('bass', 6, chordAt(0))).toStrictEqual([{ length: 2, midi: 48 }])
  })

  it('holds each chord for its bar', () => {
    expect(backingAt('chords', 0, chordAt(2)).map((h) => h.midi)).toStrictEqual([57, 60, 64])
    expect(backingAt('chords', 3, chordAt(2))).toStrictEqual([])
    expect(chordAt(5).name).toBe('G')
  })

  it('plays the hook bar by bar, over and over', () => {
    expect(hookAt(0, 0)).toStrictEqual([{ length: 2, midi: 76 }])
    expect(hookAt(4, 0)).toStrictEqual(hookAt(0, 0))
    for (const [, step, , length] of HOOK) expect(step + length).toBeLessThanOrEqual(16)
  })
})

describe('melodies', () => {
  it('hold a note through the rests after it, up to a beat', () => {
    expect(melodyAt(EXAMPLE_MELODY, 0)).toStrictEqual([{ length: 4, midi: MELODY_ROWS[2] }])
    expect(melodyAt(EXAMPLE_MELODY, 1)).toStrictEqual([])
    expect(melodyAt(EXAMPLE_MELODY, 2)).toStrictEqual([])
    expect(melodyAt(EXAMPLE_MELODY, 6)).toStrictEqual([{ length: 2, midi: MELODY_ROWS[2] }])
  })

  it('come out at random as real melodies that end at home', () => {
    const random = seeded(11)
    for (let i = 0; i < 100; i++) {
      const melody = randomMelody(random)
      expect(melody).toHaveLength(MELODY_CELLS)
      expect([0, 5]).toContain(melody.at(-1))
      for (const row of melody) if (row !== null) expect(MELODY_ROWS[row]).toBeDefined()
      expect(melody.filter((r) => r !== null).length).toBeGreaterThan(4)
    }
  })
})

describe('the arp lab', () => {
  it('steps through the held notes in the pattern', () => {
    const notes = [60, 64, 67]
    expect([0, 1, 2, 3].map((i) => arpNote(notes, 'up', i))).toStrictEqual([60, 64, 67, 60])
    expect([0, 1, 2].map((i) => arpNote(notes, 'down', i))).toStrictEqual([67, 64, 60])
    expect([0, 1, 2, 3].map((i) => arpNote(notes, 'updown', i))).toStrictEqual([60, 64, 67, 64])
    expect(notes).toContain(arpNote(notes, 'random', 0, () => 0.99))
  })
})

describe('song sketch tips', () => {
  it('praise a song that builds and drops', () => {
    const good = sketch([
      ['chords'],
      ['chords', 'bass', 'drums'],
      ['melody', 'chords', 'bass', 'drums'],
      ['melody', 'chords'],
      ['melody', 'chords', 'bass', 'drums'],
      ['chords']
    ])
    expect(sketchTips(good)).toStrictEqual([])
  })

  it('point out a flat song with no melody', () => {
    const tips = sketchTips(sketch(SECTIONS.map(() => ['chords', 'bass', 'drums'])))
    expect(tips.some((t) => t.includes('sounds the same'))).toBe(true)
    expect(tips.some((t) => t.includes('melody'))).toBe(true)
    expect(tips.some((t) => t.includes('breakdown'))).toBe(true)
  })

  it('point out a small chorus, a full intro and silence', () => {
    const tips = sketchTips(
      sketch([
        ['melody', 'chords', 'bass', 'drums'],
        ['melody', 'chords', 'bass'],
        ['chords'],
        [],
        ['chords'],
        ['chords']
      ])
    )
    expect(tips.some((t) => t.includes('chorus should be the biggest'))).toBe(true)
    expect(tips.some((t) => t.includes('starting smaller'))).toBe(true)
    expect(tips.some((t) => t.startsWith('Breakdown: nothing plays'))).toBe(true)
  })
})

describe('questions', () => {
  it('put the effect on the note they say', () => {
    const random = seeded(5)
    for (let i = 0; i < 20; i++) {
      const q = effectQuestion('reverb', { fx_reverb_mix: 0.7 }, { sustain: 0 }, random)
      const wet = q.answer === 'The first' ? 0 : 1
      expect(q.sounds?.[wet]?.fx_reverb_mix).toBe(0.7)
      expect(q.sounds?.[1 - wet]?.fx_reverb_mix).toBeUndefined()
    }
  })

  it('play the arp the way the answer says', () => {
    const random = seeded(9)
    for (let i = 0; i < 30; i++) {
      const q = arpQuestion(random)
      const notes = (q.play ?? []).map((g) => g[0] ?? 0)
      const rising = (notes[1] ?? 0) > (notes[0] ?? 0)
      expect(q.choices).toContain(q.answer)
      expect(rising).toBe(q.answer !== 'Down')
    }
  })

  it('end a finished tune on C', () => {
    const random = seeded(2)
    for (let i = 0; i < 30; i++) {
      const q = endingQuestion(random)
      const last = q.play?.at(-1)?.[0] ?? 0
      expect(last % 12 === 0).toBe(q.answer === 'Finished')
    }
  })
})
