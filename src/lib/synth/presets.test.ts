import { expect, test } from 'vitest'

import type { Loop } from '../types.js'

import { filterPresets, presetItems, presetPreviewLoop } from './presets.js'

test('preset search combines words and facets, with OR within a facet and untagged saved sounds', () => {
  const items = presetItems([{ id: 'mine', name: 'My Bass' }])
  const acid = items.find((item) => item.name === 'Acid Bass')
  expect(acid).toBeDefined()
  expect(filterPresets(items, '  ACID bass ', { source: ['Factory'] })).toEqual([acid])
  expect(filterPresets(items, 'Acid', { source: ['Saved'] })).toEqual([])
  expect(filterPresets(items, 'Acid', { instrument: ['Bass', 'Lead'] })).toEqual([acid])
  expect(filterPresets(items, 'Acid', { genre: ['Afrobeat'], instrument: ['Bass'] })).toEqual([])
  expect(
    filterPresets(items, 'my bass', { instrument: ['Unclassified'], source: ['Saved'] }).map(
      (item) => item.id
    )
  ).toEqual(['mine'])
  expect(filterPresets(items, ' ', {})).toEqual(items)
})

test('preset previews keep the selected score and timing without inheriting or changing its sound', () => {
  const selected: Loop = {
    bpm: 90,
    events: [
      { midi: 67, on: true, t: 0.5, velocity: 0.4 },
      { midi: 67, on: false, t: 1.5 }
    ],
    length: 2.667,
    params: { drive: 1, filter_cutoff: 50 },
    slot: 2
  }
  const params = { filter_cutoff: 8000 }
  expect(presetPreviewLoop(params, 120, selected, 60)).toEqual({ ...selected, params })
  expect(selected.params).toEqual({ drive: 1, filter_cutoff: 50 })
  expect(presetPreviewLoop(params, 120, null, 48)).toEqual({
    bpm: 120,
    events: [
      { midi: 48, on: true, t: 0 },
      { midi: 48, on: false, t: 1 }
    ],
    length: 2,
    params,
    slot: 0
  })
})
