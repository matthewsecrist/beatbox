import { expect, test, vi } from 'vitest'

import { createTransport } from '../transport.js'
import { arpCycle, chordNotes, createArp } from './arp.js'

// A transport on a hand-driven audio clock, at 120 BPM (0.5 s per beat).
function clocked() {
  const clock = { now: 0 }
  const ctx = {
    get currentTime() {
      return clock.now
    }
  }
  const transport = createTransport(() => ctx as unknown as BaseAudioContext)
  transport.setBpm(120)
  return { clock, transport }
}

// Synth stand-in that records scheduled notes as [kind, midi|key, time].
function spySynth() {
  const calls: (number | string)[][] = []
  return {
    calls,
    cancelPending: vi.fn(),
    noteOff: (key: number | string, at = NaN) => calls.push(['off', key, +at.toFixed(3)]),
    noteOn: (midi: number, at = NaN) => calls.push(['on', midi, +at.toFixed(3)])
  }
}

test('a chord is built up from the key, within MIDI range', () => {
  expect(chordNotes(60, 'min7')).toStrictEqual([60, 63, 67, 70])
  expect(chordNotes(60, 'off')).toStrictEqual([60])
  expect(chordNotes(122, 'maj')).toStrictEqual([122, 126])
})

test('patterns run over the held notes by pitch, whatever order they were pressed in', () => {
  expect(arpCycle([64, 60, 67], 'up')).toStrictEqual([60, 64, 67])
  expect(arpCycle([64, 60, 67], 'down')).toStrictEqual([67, 64, 60])
  expect(arpCycle([64, 60, 67, 71], 'updown')).toStrictEqual([60, 64, 67, 71, 67, 64])
  expect(arpCycle([62, 60], 'updown')).toStrictEqual([60, 62])
})

test('held notes play one per step from the first beat, and stop when let go', () => {
  const { clock, transport } = clocked()
  const synth = spySynth()
  const onnote = vi.fn()
  const arp = createArp(synth, transport, onnote)
  arp.set('down', '1/8') // a step every 0.25 s

  arp.hold([60, 64]) // nothing playing: the grid starts at 0.05 s
  clock.now = 0.3
  arp.tick()

  expect(synth.calls).toStrictEqual([
    ['on', 64, 0.05],
    ['off', 'arp:64', 0.175], // half a step
    ['on', 60, 0.3],
    ['off', 'arp:60', 0.425]
  ])
  expect(onnote.mock.calls).toStrictEqual([
    [64, true, 0.05],
    [64, false, 0.175]
  ])

  clock.now = 0.32
  arp.release([60, 64])

  expect(synth.cancelPending).toHaveBeenCalled()
  expect(onnote).toHaveBeenLastCalledWith(60, false, 0.425)
  expect(transport.running).toBe(false)
})

test('while the song plays, a pattern starts on the next step; a slightly late key takes the one it missed', () => {
  const { clock, transport } = clocked()
  transport.acquire('drums') // beat 0 at 0.05 s
  const synth = spySynth()
  const arp = createArp(synth, transport, vi.fn())
  arp.set('up', '1/4')

  clock.now = 0.3 // halfway through beat 0
  arp.hold([60])
  expect(synth.calls).toStrictEqual([])
  clock.now = 0.5
  arp.tick()
  expect(synth.calls[0]).toStrictEqual(['on', 60, 0.55])

  arp.releaseAll()
  synth.calls.length = 0
  clock.now = 1.07 // 20 ms after beat 2
  arp.hold([62])
  expect(synth.calls[0]).toStrictEqual(['on', 62, 1.05])
  expect(transport.running).toBe(true) // the drums still hold it
})

test('random never plays the same note twice in a row', () => {
  const { clock, transport } = clocked()
  const synth = spySynth()
  const arp = createArp(synth, transport, vi.fn(), () => 0)
  arp.set('random', '1/16')

  arp.hold([60, 64, 67])
  for (clock.now = 0; clock.now < 1; clock.now += 0.025) arp.tick()

  const played = synth.calls.filter((c) => c[0] === 'on').map((c) => c[1])
  expect(played.slice(0, 4)).toStrictEqual([60, 64, 60, 64])
  expect(played.every((midi, i) => midi !== played[i - 1])).toBe(true)
})

test('a new rate takes over on its own grid', () => {
  const { clock, transport } = clocked()
  const synth = spySynth()
  const arp = createArp(synth, transport, vi.fn())
  arp.set('up', '1/8t') // steps of 1/3 beat

  arp.hold([60])
  clock.now = 0.1
  arp.tick() // next step: beat 1/3
  arp.set('up', '1/4')
  for (clock.now = 0.1; clock.now < 1.2; clock.now += 0.025) arp.tick()

  const starts = synth.calls.filter((c) => c[0] === 'on').map((c) => c[2])
  expect(starts).toStrictEqual([0.05, 0.55, 1.05])
})
