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
    { bars: 2, drums: false, pads: [1] }
  ]) // grid starts at 0.05 s: boundaries at beats 0, 4, 12

  expect(position).toStrictEqual({ bar: 1, index: 0 })
  expect(scenes).toStrictEqual([{ beat: 0, drums: true, index: 0, pads: [0], pattern: 2 }])

  clock.currentTime = 1.96 // section 2 starts at 2.05 s: inside the lookahead
  expect(arranger.tick()).toStrictEqual({ bar: 1, index: 0 })
  expect(scenes.at(-1)).toStrictEqual({ beat: 4, drums: false, index: 1, pads: [1], pattern: 0 })

  clock.currentTime = 6.0 // end (12 beats = 6.05 s) announced as an empty scene
  expect(arranger.tick()).toStrictEqual({ bar: 2, index: 1 })
  expect(scenes.at(-1)).toStrictEqual({ beat: 12, drums: false, index: -1, pads: [], pattern: 0 })
  expect(ended).toBe(false)

  clock.currentTime = 6.06
  expect(arranger.tick()).toBe(null)
  expect(ended).toBe(true)
  expect(transport.running).toBe(false)
})
