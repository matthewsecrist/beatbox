import { expect, test } from 'vitest'

import { createTapTempo } from './tap_tempo.js'

test('the tempo comes from the average gap between the last five taps', () => {
  const tempo = createTapTempo()

  expect(tempo.tap(0)).toBe(null)
  expect(tempo.tap(500)).toStrictEqual({ bpm: 120, first: true })
  expect(tempo.tap(1100)).toStrictEqual({ bpm: 109, first: false }) // 550 ms average
  expect(tempo.tap(1500)).toStrictEqual({ bpm: 120, first: false })
  expect(tempo.tap(2000)).toStrictEqual({ bpm: 120, first: false })
  // The first tap has dropped out: gaps 600, 400, 500 and 400 ms.
  expect(tempo.tap(2400)).toStrictEqual({ bpm: 126, first: false })
})

test('a pause of over 2 s starts again, and the tempo stays in the slider range', () => {
  const tempo = createTapTempo()
  tempo.tap(0)
  tempo.tap(200) // 300 BPM

  expect(tempo.tap(400)).toStrictEqual({ bpm: 200, first: false })
  expect(tempo.tap(2500)).toBe(null)
  expect(tempo.tap(4400)).toStrictEqual({ bpm: 60, first: true }) // 31.6 BPM
})
