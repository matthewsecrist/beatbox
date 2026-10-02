import { expect, test } from 'vitest'

import { SongStore } from '../../song.svelte.js'
import { EXAMPLES, getExample, listExamples } from './index.js'

test('Midnight Arcade is an example with loops and an arrangement', () => {
  const example = getExample('midnight-arcade')

  expect(example?.name).toBe('Midnight Arcade')
  expect(example?.loops.length).toBeGreaterThan(0)
  expect(example?.arrangement.length).toBeGreaterThan(0)
})

test('examples are listed by slug and name, and have unique names', () => {
  expect(listExamples()).toContainEqual({ name: 'Midnight Arcade', slug: 'midnight-arcade' })
  expect(new Set(EXAMPLES.map((e) => e.name)).size).toBe(EXAMPLES.length)
})

test("every example's sections play only pads that have a loop and patterns it has", () => {
  for (const example of EXAMPLES) {
    const slots = new Set(example.loops.map((l) => l.slot))
    const patterns = example.drums?.patterns.length ?? 0
    for (const section of example.arrangement) {
      expect(
        section.pads.filter((p) => !slots.has(p)),
        `${example.name}: ${section.name}`
      ).toStrictEqual([])
      if (section.drums)
        expect(section.pattern, `${example.name}: ${section.name}`).toBeLessThan(patterns)
    }
  }
})

test('an unknown slug is no example', () => {
  expect(getExample('nope')).toBeNull()
})

test('examples keep their sections’ drum fills through validation', () => {
  const example = getExample('acid-house')
  const groove = example?.arrangement.find((s) => s.name === 'Groove')
  expect(groove?.fill).toBe(true)
  expect(example?.drums?.fills?.[groove?.pattern ?? -1]).toBeTruthy()
})

test.each([
  ['trap', 0, 53, { out: { duration: 0.75, semitones: -12 } }],
  ['midnight-arcade', 3, 76, { in: { duration: 0.5, semitones: -2 } }]
])('%s preserves its expressive note bends when opened', (slug, slot, midi, bend) => {
  const example = getExample(slug)
  if (!example) throw new Error(`Missing example ${slug}`)
  const store = new SongStore(example)
  const loop = store.loops.find((loop) => loop?.slot === slot)
  expect(loop?.events.find((event) => event.on && event.t === 0)).toStrictEqual({
    bend,
    midi,
    on: true,
    t: 0
  })
  expect(loop?.events.filter((event) => !event.on).every((event) => !event.bend)).toBe(true)
})
