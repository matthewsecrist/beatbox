import { expect, test } from 'vitest'

import { euclid } from './euclid.js'

const pattern = (on: boolean[]) => on.map((hit) => (hit ? 'x' : '.')).join('')

test('hits spread as the traditional Euclidean rhythms', () => {
  expect(pattern(euclid(3, 8))).toBe('x..x..x.') // tresillo
  expect(pattern(euclid(5, 8))).toBe('x.xx.xx.') // cinquillo
  expect(pattern(euclid(7, 16))).toBe('x..x.x.x..x.x.x.') // samba
  expect(pattern(euclid(4, 16))).toBe('x...x...x...x...')
})

test('no hits, every step, and more hits than steps', () => {
  expect(pattern(euclid(0, 8))).toBe('........')
  expect(pattern(euclid(8, 8))).toBe('xxxxxxxx')
  expect(pattern(euclid(9, 8))).toBe('xxxxxxxx')
})

test('rotation moves the hits later, wrapping round the cycle', () => {
  expect(pattern(euclid(3, 8, 1))).toBe('.x..x..x')
  expect(pattern(euclid(3, 8, 7))).toBe('..x..x.x')
})

test('a shorter cycle repeats to fill the bar, cut short if it does not fit', () => {
  expect(pattern(euclid(3, 8, 0, 16))).toBe('x..x..x.x..x..x.')
  expect(pattern(euclid(2, 5, 1, 16))).toBe('.x.x..x.x..x.x..')
})
