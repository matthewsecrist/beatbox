import { expect, test } from 'vitest'

import type { Scene } from './types.js'

import { createArranger } from './arranger.js'
import { createTransport } from './transport.js'

test('sections play back to back, announced ahead of each boundary, then stop', () => {
  const clock = { currentTime: 0 }
  const transport = createTransport(() => clock as unknown as BaseAudioContext)
  transport.setBpm(120) // 2 s per bar
  const scenes: Scene[] = []
  let ended = false
  const arranger = createArranger({
    onEnd: () => {
      ended = true
    },
    onScene: (s) => scenes.push(s),
    transport
  })

  const position = arranger.start([
    { bars: 1, drums: true, pads: [0], pattern: 2 },
    { automation: { master_filter: [0, 0.8] }, bars: 2, drums: false, pads: [1] }
  ]) // grid starts at 0.05 s: boundaries at beats 0, 4, 12

  expect(position).toStrictEqual({ bar: 1, index: 0 })
  expect(scenes).toStrictEqual([
    { automation: {}, beat: 0, bpm: null, drums: true, end: 4, index: 0, pads: [0], pattern: 2 }
  ])

  clock.currentTime = 1.96 // section 2 starts at 2.05 s: inside the lookahead
  expect(arranger.tick()).toStrictEqual({ bar: 1, index: 0 })
  expect(scenes.at(-1)).toStrictEqual({
    automation: { master_filter: [0, 0.8] }, // ramped from beat 4 to its end on beat 12
    beat: 4,
    bpm: null,
    drums: false,
    end: 12,
    index: 1,
    pads: [1],
    pattern: 0
  })

  clock.currentTime = 6.0 // end (12 beats = 6.05 s) announced as an empty scene
  expect(arranger.tick()).toStrictEqual({ bar: 2, index: 1 })
  expect(scenes.at(-1)).toStrictEqual({
    automation: {},
    beat: 12,
    bpm: null,
    drums: false,
    end: 12,
    index: -1,
    pads: [],
    pattern: 0
  })
  expect(ended).toBe(false)

  clock.currentTime = 6.06
  expect(arranger.tick()).toBe(null)
  expect(ended).toBe(true)
  expect(transport.running).toBe(false)
})

test('a section with its own tempo plays at it from its first beat; the song tempo still moves the others', () => {
  const clock = { currentTime: 0 }
  const transport = createTransport(() => clock as unknown as BaseAudioContext)
  transport.setBpm(120) // 0.5 s per beat
  const scenes: Scene[] = []
  const arranger = createArranger({ onScene: (s) => scenes.push(s), transport })

  arranger.start([
    { bars: 1, pads: [] },
    { bars: 1, bpm: 60, pads: [] },
    { bars: 1, pads: [] }
  ]) // grid starts at 0.05 s: boundaries at beats 0, 4, 8, 12

  expect(transport.timeAt(4)).toBeCloseTo(2.05) // bar 1 at 120
  expect(transport.timeAt(8)).toBeCloseTo(6.05) // bar 2 at 60: a beat a second
  expect(transport.timeAt(12)).toBeCloseTo(8.05) // bar 3 back at the song's 120

  clock.currentTime = 2 // the second section's scene, a moment before its first beat
  arranger.tick()
  expect(scenes.at(-1)?.bpm).toBe(60)

  clock.currentTime = 3.05 // beat 5, in the 60 BPM section
  expect(transport.bpm).toBe(60)
  transport.setBpm(90) // the song tempo: the section keeps its own
  expect(transport.beatAt(3.05)).toBeCloseTo(5)
  expect(transport.timeAt(8)).toBeCloseTo(6.05)
  expect(transport.timeAt(12)).toBeCloseTo(6.05 + (4 * 60) / 90) // bar 3 at the new 90
})

test('stopping mid-section goes back to the song tempo from there', () => {
  const clock = { currentTime: 0 }
  const transport = createTransport(() => clock as unknown as BaseAudioContext)
  transport.setBpm(120)
  transport.acquire('drums') // something else keeps the grid running
  const arranger = createArranger({ onScene: () => undefined, transport })

  arranger.start([{ bars: 2, bpm: 60, pads: [] }]) // from beat 0 (0.05 s)
  clock.currentTime = 2.05 // beat 2
  arranger.stop()

  expect(transport.bpm).toBe(120)
  expect(transport.beatAt(2.05)).toBeCloseTo(2)
  expect(transport.timeAt(4)).toBeCloseTo(3.05) // two more beats at 120
})
