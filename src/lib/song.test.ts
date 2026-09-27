import { expect, test, vi } from 'vitest'

import type { Loop, SongDoc } from './types.js'

import { STEPS, TRACKS } from './drums/engine.js'
import { DEFAULT_PATTERN, SongStore } from './song.svelte.js'

const loop = (slot: number, midi = 60): Loop => ({
  bpm: 120,
  events: [
    { midi, on: true, t: 0 },
    { midi, on: false, t: 1 }
  ],
  length: 2,
  params: { osc1_wave: 'sine' },
  slot
})

const song: SongDoc = {
  arrangement: [{ bars: 8, drums: true, name: 'Drop', pads: [2], pattern: 1 }],
  drums: { bpm: 140, patterns: [{ kick: [true] }], volume: 0.5 },
  loops: [loop(2)],
  synth: { filter_cutoff: 300 }
}

test('a saved song loads into the mirrors and saves back the same', () => {
  const store = new SongStore(song)

  expect(store.synth).toStrictEqual({ filter_cutoff: 300 })
  expect(store.drums.bpm).toBe(140)
  expect(store.drums.patterns).toHaveLength(4)
  expect(store.drums.patterns[0]?.kick[0]).toBe(true)
  expect(store.loops[2]).toStrictEqual(loop(2))
  expect(store.arrangement[0]).toMatchObject({ bars: 8, name: 'Drop', pattern: 1 })

  const saved = store.toSongDoc()
  expect(saved.synth).toStrictEqual({ filter_cutoff: 300 })
  expect(saved.loops).toStrictEqual([loop(2)])
  expect(saved.arrangement).toStrictEqual(song.arrangement)
  expect(saved.drums?.patterns[0]?.kick).toStrictEqual([true, ...Array<boolean>(15).fill(false)])
})

test('a new song starts with default drums and nothing to undo', () => {
  const onchange = vi.fn()
  const store = new SongStore(null, onchange)

  expect(store.drums.bpm).toBe(110)
  expect(store.drums.patterns[0]).toStrictEqual(DEFAULT_PATTERN)
  expect(store.drums.patterns[3]).toStrictEqual(
    Object.fromEntries(TRACKS.map(({ id }) => [id, Array<boolean>(STEPS).fill(false)]))
  )
  expect(store.toSongDoc().synth).toBe(null)
  expect(store.canUndo).toBe(false)
  expect(onchange).not.toHaveBeenCalled()
})

test('edits across instruments undo and redo, and each reports a change', () => {
  const onchange = vi.fn()
  const store = new SongStore(song, onchange)

  store.setParams({ ...store.synth, filter_cutoff: 900 } as never)
  store.toggleStep(1, 'snare', 4)
  store.setLoop(loop(5, 72))
  store.removeSection(0)
  expect(onchange).toHaveBeenCalledTimes(4)
  expect(store.canUndo).toBe(true)

  store.undo()
  expect(store.arrangement).toHaveLength(1)
  store.undo()
  expect(store.loops[5]).toBe(null)
  store.undo()
  expect(store.drums.patterns[1]?.snare[4]).toBe(false)
  store.undo()
  expect(store.synth).toStrictEqual({ filter_cutoff: 300 })
  expect(store.canUndo).toBe(false)
  expect(onchange).toHaveBeenCalledTimes(8)

  store.redo()
  store.redo()
  expect(store.synth.filter_cutoff).toBe(900)
  expect(store.drums.patterns[1]?.snare[4]).toBe(true)
  expect(store.canRedo).toBe(true)
})

test('a slider drag is one undo step; a discrete edit after it is another', () => {
  const store = new SongStore(song)

  for (const cutoff of [400, 500, 600]) store.setParam('filter_cutoff', cutoff)
  store.setDrums({ bpm: 150 })
  store.deleteLoop(2)

  store.undo() // the deleted loop comes back
  expect(store.loops[2]).toStrictEqual(loop(2))
  store.undo() // the drag and the tempo change, made in one gesture window
  expect(store.synth.filter_cutoff).toBe(300)
  expect(store.drums.bpm).toBe(140)
})

test('unchanged loops keep their identity when another pad changes', () => {
  const store = new SongStore(song)
  const before = store.loops[2]

  store.setLoop(loop(0, 64))

  expect(store.loops[2]).toBe(before)
  expect(store.loops[0]?.events[0]?.midi).toBe(64)
})

test('arrangement sections add, move, duplicate and rename with stable ids', () => {
  const store = new SongStore(song)
  store.addSection() // copies the last section, unnamed
  store.updateSection(1, { name: 'Outro' })
  const outro = store.arrangement[1]?.id

  store.moveSection(1, -1)
  expect(store.arrangement.map((s) => s.name)).toStrictEqual(['Outro', 'Drop'])
  store.duplicateSection(0)
  expect(store.arrangement.map((s) => s.name)).toStrictEqual(['Outro', 'Outro', 'Drop'])
  expect(new Set(store.arrangement.map((s) => s.id)).size).toBe(3)

  store.updateSection(2, { name: 'Drop 2' })
  expect(store.arrangement[0]?.id).not.toBe(undefined)
  expect(outro).not.toBe(undefined)

  store.undo()
  expect(store.arrangement[2]?.name).toBe('Drop')
  expect(store.toSongDoc().arrangement.every((s) => !('id' in s))).toBe(true)
})

test('replace swaps in a whole song, with no history and no change reported', () => {
  const onchange = vi.fn()
  const store = new SongStore(null, onchange)
  store.setDrums({ bpm: 90 })
  store.setLoop(loop(5))
  onchange.mockClear()

  store.replace(song)

  expect(onchange).not.toHaveBeenCalled()
  expect(store.canUndo).toBe(false)
  expect(store.synth).toStrictEqual({ filter_cutoff: 300 })
  expect(store.drums.bpm).toBe(140)
  expect(store.loops[5]).toBe(null)
  expect(store.loops[2]).toStrictEqual(loop(2))
  expect(store.toSongDoc().arrangement).toStrictEqual(song.arrangement)

  // Edits after it undo back to the replaced song, not before it.
  store.setDrums({ bpm: 100 })
  expect(onchange).toHaveBeenCalled()
  store.undo()
  expect(store.drums.bpm).toBe(140)
  expect(store.canUndo).toBe(false)
})
