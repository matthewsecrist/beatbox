import { expect, test, vi } from 'vitest'

import type { Loop } from '../types.js'

import { createTransport } from '../transport.js'
import { createSynth } from './engine.js'
import { createPlayer, createRecorder } from './looper.js'

const OSCS_PER_VOICE = 4 // osc1, osc2, two LFOs; osc1 of voice n is oscs[n * 4]

interface FakeNode {
  disconnected?: boolean
  startAt?: number
  stopAt?: number
}

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value')
  return value
}

// Minimal AudioContext stand-in with a hand-driven clock; records oscillator
// start/stop so we can see what would actually sound.
function fakeAudio() {
  const clock = { now: 0 }
  const oscs: FakeNode[] = []
  const param = () => ({
    cancelScheduledValues: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    value: 0
  })
  const node = () => {
    const n: FakeNode & Record<string, unknown> = {
      connect: <T>(next: T) => next,
      detune: param(),
      disconnect() {
        n.disconnected = true
      },
      frequency: param(),
      gain: param(),
      Q: param()
    }
    return n
  }
  const ctx = {
    createBiquadFilter: () => node(),
    createGain: () => node(),
    createOscillator() {
      const o = node()
      o.start = (t: number) => (o.startAt = t)
      o.stop = (t: number) => (o.stopAt = t)
      oscs.push(o)
      return o
    },
    createWaveShaper: () => node(),
    get currentTime() {
      return clock.now
    },
    destination: {},
    state: 'running'
  }
  const getCtx = () => ctx as unknown as BaseAudioContext
  const transport = createTransport(getCtx)
  transport.setBpm(120) // 0.5 s per beat, 2 s per bar
  return { clock, oscs, synth: createSynth({}, getCtx), transport }
}

// Synth stand-in that records scheduled notes as [kind, midi|key, time].
function spySynth() {
  const calls: (number | string)[][] = []
  return {
    calls,
    cancelPending: vi.fn(),
    noteOff: (_key: number | string, at = NaN) => calls.push(['off', +at.toFixed(3)]),
    noteOn: (midi: number, at = NaN) => calls.push(['on', midi, +at.toFixed(3)]),
    setOwnParams: vi.fn()
  }
}

// One bar at 120 BPM: note on at the downbeat, off on beat 3.
const oneBar: Loop = {
  bpm: 120,
  events: [
    { midi: 60, on: true, t: 0 },
    { midi: 60, on: false, t: 1 }
  ],
  length: 2,
  params: {},
  slot: 0
}

test('tempo changes keep the current beat position', () => {
  const { clock, transport } = fakeAudio()
  transport.acquire('x') // grid starts at 0.05 s
  clock.now = 1.05 // beat 2 at 120 BPM
  transport.setBpm(60)

  expect(transport.beatAt(1.05)).toBe(2)
  expect(transport.timeAt(4)).toBe(3.05) // two more beats at 1 s each
  expect(transport.nextBar()).toBe(4)

  transport.release('x')
  expect(transport.running).toBe(false)
})

test('player repeats the loop on the beat grid', () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  const player = createPlayer(synth, 'pad0:', oneBar, transport)

  player.start() // first user: grid (and loop) start at 0.05 s
  clock.now = 2
  player.tick()

  expect(synth.calls).toStrictEqual([
    ['on', 60, 0.05],
    ['off', 1.05],
    ['on', 60, 2.05]
  ])
})

test('a pad plays each note at its saved velocity, full when it has none', () => {
  const { clock, transport } = fakeAudio()
  const velocities: (number | undefined)[] = []
  const synth = {
    ...spySynth(),
    noteOn: (
      _midi: number,
      _at?: number,
      _key?: number | string,
      _own?: unknown,
      velocity?: number
    ) => velocities.push(velocity)
  }
  const loop: Loop = {
    ...oneBar,
    events: [
      { midi: 60, on: true, t: 0, velocity: 0.4 },
      { midi: 60, on: false, t: 0.5 },
      { midi: 62, on: true, t: 1 },
      { midi: 62, on: false, t: 1.5 }
    ]
  }
  const player = createPlayer(synth, 'pad0:', loop, transport)

  player.start()
  clock.now = 1.5
  player.tick()

  expect(velocities).toStrictEqual([0.4, undefined]) // the synth plays undefined at full
})

test('a pad started after the audio clock has run starts right away', () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  const player = createPlayer(synth, 'pad0:', oneBar, transport)
  clock.now = 10 // e.g. a note was previewed a while ago

  player.start()

  expect(synth.calls[0]).toStrictEqual(['on', 60, 10.05])
})

test('a pad started mid-bar waits for the next bar line', () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  transport.acquire('drums')
  clock.now = 0.8 // beat 1.5

  const player = createPlayer(synth, 'pad0:', oneBar, transport)
  player.start()
  expect(synth.calls).toStrictEqual([])

  clock.now = 2
  player.tick()
  expect(synth.calls).toStrictEqual([['on', 60, 2.05]]) // bar 2 = beat 4
})

test('a loop length rounded to the millisecond stays locked to the bar', () => {
  const { clock, transport } = fakeAudio()
  transport.setBpm(110) // one bar is 2.1818 s, stored as 2.182
  const synth = spySynth()
  const bar = { ...oneBar, bpm: 110, events: [{ midi: 60, on: true, t: 0 }], length: 2.182 }
  const player = createPlayer(synth, 'pad0:', bar, transport)
  player.start()

  clock.now = transport.timeAt(400) - 0.05 // bar 101
  player.tick()

  expect(synth.calls.at(-1)).toStrictEqual(['on', 60, +transport.timeAt(400).toFixed(3)])
})

test('loops follow tempo changes', () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  const player = createPlayer(synth, 'pad0:', oneBar, transport)
  player.start()

  clock.now = 0.3 // beat 0.5
  transport.setBpm(60)
  clock.now = 1.75
  player.tick()

  // Note-off is on beat 2: 1.5 beats after the change at 1 s per beat.
  expect(synth.calls).toStrictEqual([
    ['on', 60, 0.05],
    ['off', 1.8]
  ])
})

test('stopAt ends a pad exactly on the boundary beat, releasing held notes there', () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  const player = createPlayer(synth, 'pad0:', oneBar, transport)
  player.start(0) // grid starts at 0.05 s; the note is held from beat 0 to beat 2
  player.stopAt(1) // section boundary mid-note (beat 1 = 0.55 s)

  clock.now = 0.4 // boundary not yet inside the lookahead
  player.tick()
  expect(player.playing).toBe(true)

  clock.now = 0.5
  player.tick()
  expect(synth.calls).toStrictEqual([
    ['on', 60, 0.05],
    ['off', 0.55]
  ])
  expect(player.playing).toBe(false)
  expect(transport.running).toBe(false)
})

test("start while a stop is pending cancels it and keeps the loop's phase", () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  const player = createPlayer(synth, 'pad0:', oneBar, transport)
  player.start(0)
  player.stopAt(4)
  player.start(4) // next section keeps this pad

  clock.now = 2
  player.tick()
  expect(synth.calls).toStrictEqual([
    ['on', 60, 0.05],
    ['off', 1.05],
    ['on', 60, 2.05]
  ])
  expect(player.playing).toBe(true)
})

test('an edited loop takes over at once, keeping its place in the bar', () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  const player = createPlayer(synth, 'pad0:', oneBar, transport)
  player.start() // C4 held from beat 0 to beat 2

  clock.now = 0.8 // beat 1.5: C4 is sounding
  player.setLoop({
    ...oneBar,
    events: [
      { midi: 64, on: true, t: 1.5 },
      { midi: 64, on: false, t: 2 }
    ]
  })
  clock.now = 1.5
  player.tick()
  clock.now = 2
  player.tick()

  expect(synth.calls).toStrictEqual([
    ['on', 60, 0.05],
    ['off', NaN], // C4 released at the edit
    ['on', 64, 1.55], // E4 on beat 3 of the same bar
    ['off', 2.05]
  ])
})

test('a new sound for a playing loop carries on its notes and changes them live', () => {
  const { clock, transport } = fakeAudio()
  const sounds: (string | undefined)[] = []
  const synth = {
    ...spySynth(),
    noteOn: (_midi: number, _at?: number, _key?: number | string, own?: Partial<Loop['params']>) =>
      sounds.push(own?.osc1_wave)
  }
  const player = createPlayer(synth, 'pad0:', oneBar, transport)
  player.start() // C4 held from beat 0 to beat 2

  clock.now = 0.8 // C4 is sounding
  const square = { ...oneBar, params: { osc1_wave: 'square' as const } }
  player.setLoop(square)
  expect(synth.setOwnParams).toHaveBeenCalledWith('pad0:', square.params) // C4 changes now
  clock.now = 2 // next cycle
  player.tick()

  expect(synth.calls).toStrictEqual([['off', 1.05]]) // C4 ends where it was due to, not at the edit
  expect(sounds).toStrictEqual([oneBar.params.osc1_wave, 'square'])
})

test('shortening a playing loop continues from the same point of the shorter cycle', () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  const twoBars = {
    ...oneBar,
    events: [
      { midi: 60, on: true, t: 0 },
      { midi: 60, on: false, t: 0.5 },
      { midi: 62, on: true, t: 2 },
      { midi: 62, on: false, t: 2.5 }
    ],
    length: 4
  }
  const player = createPlayer(synth, 'pad0:', twoBars, transport)
  player.start()
  clock.now = 2.3 // beat 4.5: half a beat into bar 2, D4 sounding
  player.tick()

  player.setLoop(oneBar) // 1 bar: beat 4.5 is half a beat into a new cycle
  clock.now = 3
  player.tick()
  clock.now = 4
  player.tick()

  expect(synth.calls).toStrictEqual([
    ['on', 60, 0.05],
    ['off', 0.55],
    ['on', 62, 2.05],
    ['off', NaN], // D4 released at the edit
    ['off', 3.05], // this cycle's C4 note-off (beat 6)
    ['on', 60, 4.05] // next cycle on beat 8
  ])
})

test('an empty loop still stops on its stop beat', () => {
  const { clock, transport } = fakeAudio()
  const player = createPlayer(spySynth(), 'pad0:', { ...oneBar, events: [] }, transport)
  player.start(0)
  player.stopAt(4)

  clock.now = 2
  player.tick()

  expect(player.playing).toBe(false)
})

test('stop silences loop notes already scheduled inside the lookahead, but not live notes', () => {
  const { clock, oscs, synth, transport } = fakeAudio()
  synth.noteOn(60) // live note, key 60
  const loop = {
    ...oneBar,
    events: [
      { midi: 64, on: true, t: 0.01 },
      { midi: 64, on: false, t: 0.03 }
    ]
  }
  const player = createPlayer(synth, 'pad1:', loop, transport)
  player.start() // note-on at 0.06 and note-off at 0.08 both scheduled now

  const [liveOsc, loopOsc] = [defined(oscs[0]), defined(oscs[OSCS_PER_VOICE])]
  expect(+defined(loopOsc.startAt).toFixed(3)).toBe(0.06)

  clock.now = 0.02
  player.stop()

  expect(
    defined(loopOsc.stopAt) <= defined(loopOsc.startAt),
    'pending loop note never starts'
  ).toBeTruthy()
  expect(liveOsc.stopAt).toBe(undefined)
})

test('stopping one pad leaves another pad on the same pitch playing', () => {
  const { clock, oscs, synth, transport } = fakeAudio()
  const loop = {
    ...oneBar,
    events: [
      { midi: 60, on: true, t: 0.01 },
      { midi: 60, on: false, t: 1.5 }
    ]
  }
  const pad0 = createPlayer(synth, 'pad0:', loop, transport)
  const pad1 = createPlayer(synth, 'pad1:', loop, transport)
  pad0.start()
  pad1.start() // both note-ons scheduled at 0.06, not yet started
  const [osc0, osc1] = [defined(oscs[0]), defined(oscs[OSCS_PER_VOICE])]

  clock.now = 0.02
  pad0.stop()

  expect(
    defined(osc0.stopAt) <= defined(osc0.startAt),
    "stopped pad's pending note never starts"
  ).toBeTruthy()
  expect(osc1.stopAt).toBe(undefined)
  expect(transport.running).toBe(true)

  clock.now = 0.3
  pad1.tick()
  pad0.tick()
  expect(oscs.length).toBe(2 * OSCS_PER_VOICE)
})

test('recorder counts in, rounds the take to whole bars and closes held notes', () => {
  const { clock, transport } = fakeAudio()
  const rec = createRecorder(transport)
  transport.acquire('rec') // grid starts at 0.05 s
  rec.start([48], 4) // 48 held; take starts after a one-bar count-in (beat 4 = 2.05 s)

  clock.now = 1.0 // still counting in: lands on beat 0 of the take
  rec.note(60, true)
  clock.now = 2.55 // take beat 1
  rec.note(48, false)
  clock.now = 6.05 // take beat 8: starts past the rounded end, dropped
  rec.note(64, true)
  clock.now = 6.3 // 8.5 beats in -> rounds to 2 bars (8 beats = 4 s)

  expect(rec.finish()).toStrictEqual({
    bpm: 120,
    events: [
      { midi: 48, on: true, t: 0 },
      { midi: 60, on: true, t: 0 },
      { midi: 48, on: false, t: 0.5 },
      { midi: 60, on: false, t: 4 }
    ],
    length: 4
  })

  rec.start([], 12)
  clock.now = 7 // still in the count-in
  expect(rec.finish()).toBe(null)
})

test('a take stopped early in a bar keeps the notes already played in it', () => {
  const { clock, transport } = fakeAudio()
  const rec = createRecorder(transport)
  transport.acquire('rec') // grid starts at 0.05 s
  rec.start([], 0)

  clock.now = 0.05
  rec.note(60, true)
  clock.now = 2.55 // take beat 5: a quarter into bar 2
  rec.note(64, true)
  clock.now = 2.65 // 5.2 beats in: rounds to 1 bar, but the note on beat 5 was meant

  const take = rec.finish()
  if (!take) throw new Error('expected a take')
  expect(take.length).toBe(4) // extended to 2 bars (8 beats = 4 s)
  expect(take.events.filter((e) => e.on).map((e) => e.midi)).toStrictEqual([60, 64])
})

test('timed notes land at their own times, in order; ones from before the take are left out', () => {
  const { clock, transport } = fakeAudio()
  const rec = createRecorder(transport)
  transport.acquire('rec') // grid starts at 0.05 s
  rec.start([], 4) // take starts at beat 4 = 2.05 s

  clock.now = 2.2
  rec.note(60, true, 1.925) // began in the count-in (beat 3.75): dropped with its end
  rec.note(60, false, 2.175)
  clock.now = 2.8
  rec.note(67, true, 2.8) // reported first...
  rec.note(67, false, 2.925)
  rec.note(64, true, 2.55) // ...but played before it
  rec.note(64, false, 2.675)
  clock.now = 4

  expect(rec.finish()?.events).toStrictEqual([
    { midi: 64, on: true, t: 0.5 },
    { midi: 64, on: false, t: 0.625 },
    { midi: 67, on: true, t: 0.75 },
    { midi: 67, on: false, t: 0.875 }
  ])
})
