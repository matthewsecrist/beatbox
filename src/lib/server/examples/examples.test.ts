import { expect, test } from 'vitest'

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

test('an unknown slug is no example', () => {
  expect(getExample('nope')).toBeNull()
})
