import { expect, test, vi } from 'vitest'

import type { Loop, SongDoc } from './types.js'

import { STEPS } from './drums/engine.js'
import { TRACKS } from './drums/kits.js'
import { DEFAULT_PATTERN, SongStore, STEP } from './song.svelte.js'

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
  effects: null,
  loops: [loop(2)],
  performance: null,
  synth: { filter_cutoff: 300 }
}

test('a saved song loads into the mirrors and saves back the same', () => {
  const store = new SongStore(song)

  expect(store.synth).toStrictEqual({ filter_cutoff: 300 })
  expect(store.drums.bpm).toBe(140)
  expect(store.drums.patterns).toHaveLength(4)
  expect(store.drums.patterns[0]?.kick[0]?.on).toBe(true)
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
    Object.fromEntries(TRACKS.map(({ id }) => [id, Array<unknown>(STEPS).fill(STEP)]))
  )
  expect(store.drums).toMatchObject({ kit: 'classic', swing: 50 })
  expect(store.toSongDoc().synth).toBe(null)
  expect(store.toSongDoc().performance).toBe(null)
  expect(store.performance).toStrictEqual({ arp: 'off', arp_rate: '1/16', chord: 'off' })
  expect(store.canUndo).toBe(false)
  expect(onchange).not.toHaveBeenCalled()
})

test('edits across instruments undo and redo, and each reports a change', () => {
  const onchange = vi.fn()
  const store = new SongStore(song, onchange)

  store.setParams({ ...store.synth, filter_cutoff: 900 } as never)
  store.setStep(1, 'snare', 4, { on: true })
  store.setLoop(loop(5, 72))
  store.removeSection(0)
  expect(onchange).toHaveBeenCalledTimes(4)
  expect(store.canUndo).toBe(true)

  store.undo()
  expect(store.arrangement).toHaveLength(1)
  store.undo()
  expect(store.loops[5]).toBe(null)
  store.undo()
  expect(store.drums.patterns[1]?.snare[4]?.on).toBe(false)
  store.undo()
  expect(store.synth).toStrictEqual({ filter_cutoff: 300 })
  expect(store.canUndo).toBe(false)
  expect(onchange).toHaveBeenCalledTimes(8)

  store.redo()
  store.redo()
  expect(store.synth.filter_cutoff).toBe(900)
  expect(store.drums.patterns[1]?.snare[4]?.on).toBe(true)
  expect(store.canRedo).toBe(true)
})

test('step settings survive switching off and saving; plain steps save as on/off', () => {
  const store = new SongStore(song)
  store.setStep(0, 'kick', 2, { accent: true, on: true, probability: 0.5, ratchet: 3 })
  store.setStep(0, 'kick', 2, { on: false })

  const saved = store.toSongDoc().drums?.patterns[0]?.kick
  expect(saved?.slice(0, 3)).toStrictEqual([
    true,
    false,
    { accent: true, on: false, probability: 0.5, ratchet: 3, velocity: 1 }
  ])
  const reopened = new SongStore({ ...song, drums: store.toSongDoc().drums })
  expect(reopened.drums.patterns[0]?.kick[2]).toStrictEqual({
    ...STEP,
    accent: true,
    probability: 0.5,
    ratchet: 3
  })
})

test("writing a track's hits keeps each step's settings, and undoes as one step", () => {
  const store = new SongStore(song)
  store.setStep(0, 'rim', 3, { accent: true, velocity: 0.5 })

  store.setHits(0, 'rim', [true, false, false, true])
  expect(store.drums.patterns[0]?.rim.map((s) => s.on).slice(0, 5)).toStrictEqual([
    true,
    false,
    false,
    true,
    false
  ])
  expect(store.drums.patterns[0]?.rim[3]).toStrictEqual({
    ...STEP,
    accent: true,
    on: true,
    velocity: 0.5
  })

  store.undo()
  expect(store.drums.patterns[0]?.rim.filter((s) => s.on)).toHaveLength(0)
})

test('choosing a kit resets voice tweaks, and undoes as one step', () => {
  const drums = { bpm: 140, patterns: [], voices: { kick: { tune: 5 } }, volume: 0.5 }
  const store = new SongStore({ ...song, drums })
  expect(store.drums.voices.kick).toStrictEqual({ decay: 1, tune: 5 })

  store.setKit('808')
  expect(store.drums.kit).toBe('808')
  expect(store.drums.voices.kick).toStrictEqual({ decay: 1, tune: 0 })

  store.undo()
  expect(store.drums.kit).toBe('classic')
  expect(store.drums.voices.kick.tune).toBe(5)
})

test("a saved kit replaces every track's tweaks, as one undo step", () => {
  const drums = { bpm: 140, patterns: [], voices: { kick: { tune: 5 } }, volume: 0.5 }
  const store = new SongStore({ ...song, drums })

  store.setKit('trap', { snare: { decay: 0.5, sound: '909-snare' } })
  expect(store.drums.kit).toBe('trap')
  expect(store.drums.voices.kick).toStrictEqual({ decay: 1, tune: 0 })
  expect(store.drums.voices.snare).toStrictEqual({ decay: 0.5, sound: '909-snare', tune: 0 })

  store.undo()
  expect(store.drums.kit).toBe('classic')
  expect(store.drums.voices.kick.tune).toBe(5)
  expect(store.drums.voices.snare.sound).toBe(undefined)
})

test("a track's picked sound saves with the song; the kit's own sound, or a new kit, drops it", () => {
  const store = new SongStore({
    ...song,
    drums: { bpm: 140, kit: '808', patterns: [], volume: 0.5 }
  })
  // Songs saved before the percussion tracks load them empty.
  expect(store.drums.patterns[0]?.cowbell.every((s) => !s.on)).toBe(true)

  store.setSound('snare', '909-snare')
  store.setVoice('snare', { tune: 3 })
  expect(store.toSongDoc().drums?.voices?.snare).toStrictEqual({
    decay: 1,
    sound: '909-snare',
    tune: 3
  })

  store.setSound('snare', '808-snare')
  expect(store.toSongDoc().drums?.voices?.snare).toStrictEqual({ decay: 1, tune: 3 })

  store.setSound('cowbell', 'lofi-cowbell')
  store.setKit('909') // a new kit gives every track its own sound again
  expect(store.drums.voices.cowbell).toStrictEqual({ decay: 1, tune: 0 })

  store.undo()
  expect(store.drums.voices.cowbell.sound).toBe('lofi-cowbell')
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

test('changing an LFO target rescales its depth, as one undo step', () => {
  const store = new SongStore({ ...song, synth: { lfo1_depth: 1, lfo2_depth: 10 } })

  store.setLfoTarget(1, 'pitch')
  expect(store.synth).toStrictEqual({ lfo1_depth: 25, lfo1_target: 'pitch', lfo2_depth: 10 })
  store.setLfoTarget(2, 'amp') // from pitch (its default): 10 of 100 cents
  expect(store.synth).toMatchObject({ lfo2_depth: 0.1, lfo2_target: 'amp' })

  store.undo()
  expect(store.synth).toStrictEqual({ lfo1_depth: 25, lfo1_target: 'pitch', lfo2_depth: 10 })
  store.undo()
  expect(store.toSongDoc().synth).toStrictEqual({ lfo1_depth: 1, lfo2_depth: 10 })
})

test("a pad's own sound changes without touching its notes or the keyboard's", () => {
  const store = new SongStore(song)
  const before = store.loops[2]

  store.setParam('filter_cutoff', 500, 2)
  store.setParams({ ...store.synth, osc1_wave: 'square', volume: 0.2 } as never, 2)
  store.setLfoTarget(1, 'pitch', 2)

  expect(store.loops[2]?.events).toBe(before?.events) // a playing pad keeps going
  expect(store.loops[2]?.params).toStrictEqual({
    filter_cutoff: 300, // from the settings setParams was given
    lfo1_depth: 0,
    lfo1_target: 'pitch',
    osc1_wave: 'square'
  })
  expect(store.synth).toStrictEqual({ filter_cutoff: 300 })
  store.setParam('filter_cutoff', 700, 5) // empty pad: nothing to change
  expect(store.loops[5]).toBe(null)

  store.undo()
  store.undo()
  expect(store.loops[2]?.params).toStrictEqual({ filter_cutoff: 500, osc1_wave: 'sine' })
})

test('chord and arp settings load with defaults filled in, save, and undo one at a time', () => {
  const store = new SongStore({ ...song, performance: { chord: 'min' } })
  expect(store.performance).toStrictEqual({ arp: 'off', arp_rate: '1/16', chord: 'min' })

  store.setPerformance({ arp: 'updown' })
  store.setPerformance({ arp_rate: '1/8t' })
  expect(store.toSongDoc().performance).toStrictEqual({
    arp: 'updown',
    arp_rate: '1/8t',
    chord: 'min'
  })

  store.undo()
  expect(store.performance.arp_rate).toBe('1/16')
  expect(store.performance.arp).toBe('updown')
  store.undo()
  expect(store.toSongDoc().performance).toStrictEqual({ chord: 'min' })

  store.replace(song)
  expect(store.performance.chord).toBe('off')
})

test('effects load with defaults filled in, save only what was set, and a drag undoes as one step', () => {
  const store = new SongStore({ ...song, effects: { delay_time: '1/4' } })
  expect(store.effects).toMatchObject({ delay_time: '1/4', synth_delay: 0, synth_reverb: 0 })

  for (const send of [0.2, 0.4, 0.5]) store.setEffects({ synth_reverb: send })
  expect(store.toSongDoc().effects).toStrictEqual({ delay_time: '1/4', synth_reverb: 0.5 })

  store.undo()
  expect(store.toSongDoc().effects).toStrictEqual({ delay_time: '1/4' })
  expect(new SongStore(song).toSongDoc().effects).toBe(null)
})

test('a read-only store refuses every edit and reports no change', () => {
  const onchange = vi.fn()
  const store = new SongStore(song, onchange, { readOnly: true })
  store.setParam('filter_cutoff', 900)
  store.setStep(0, 'kick', 1, { on: true })
  store.setLoop(loop(5))
  store.addSection()
  store.setEffects({ synth_reverb: 0.5 })

  expect(store.toSongDoc()).toStrictEqual(new SongStore(song).toSongDoc())
  expect(store.canUndo).toBe(false)
  expect(onchange).not.toHaveBeenCalled()
})

test("a section's own tempo saves with it; cleared, the section follows the song tempo again", () => {
  const store = new SongStore({
    ...song,
    arrangement: [...song.arrangement, { bars: 4, bpm: 70, drums: false, pads: [], pattern: 0 }]
  })
  expect(store.arrangement.map((s) => s.bpm)).toStrictEqual([undefined, 70])

  store.updateSection(0, { bpm: 90 })
  store.updateSection(1, { bpm: null })

  expect(store.toSongDoc().arrangement.map((s) => s.bpm)).toStrictEqual([90, undefined])
  store.undo()
  expect(store.toSongDoc().arrangement.map((s) => s.bpm)).toStrictEqual([90, 70])
})
