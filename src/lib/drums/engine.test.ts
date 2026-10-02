import { afterEach, expect, test, vi } from 'vitest'

import type { TrackId } from '../types.js'

import { STEP } from '../song.svelte.js'
import { createTransport } from '../transport.js'
import { createDrums, isAudible } from './engine.js'

// AudioContext stand-in: records when each kick (a 150 Hz sweep) starts, and every
// oscillator's starting pitch and how long it sounds.
function fakeAudio() {
  const clock = { currentTime: 0 }
  const kicks: number[] = []
  const tones: [hz: number, seconds: number][] = []
  const param = (onSet: (v: number) => void = vi.fn()) => ({
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    setValueAtTime: onSet,
    value: 0
  })
  // Every node made, with what it's connected to.
  const made: { gain: ReturnType<typeof param>; kind: string; outputs: unknown[] }[] = []
  const node = (kind = 'node') => {
    const n = {
      connect: <T>(next: T) => {
        n.outputs.push(next)
        return next
      },
      disconnect: vi.fn(),
      frequency: param(),
      gain: param(),
      kind,
      outputs: [] as unknown[]
    }
    made.push(n)
    return n
  }
  const ctx = {
    createBiquadFilter: () => node('filter'),
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    createBufferSource: () => ({ ...node(), start: vi.fn(), stop: vi.fn() }),
    createChannelMerger: () => node('merger'),
    createChannelSplitter: () => node('splitter'),
    createGain: () => node('gain'),
    createOscillator() {
      let hz = 0
      let from = 0
      return {
        ...node(),
        frequency: param((v) => (hz ||= v)),
        start: (t: number) => {
          from = t
          if (hz === 150) kicks.push(+t.toFixed(3))
        },
        stop: (t: number) => tones.push([+hz.toFixed(2), +(t - from).toFixed(3)])
      }
    },
    createWaveShaper: () => node('shaper'),
    get currentTime() {
      return clock.currentTime
    },
    destination: {},
    sampleRate: 100
  }
  return { clock, getCtx: () => ctx as unknown as BaseAudioContext, kicks, made, tones }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('a queued pattern switch takes over exactly on its bar', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { clock, getCtx, kicks } = fakeAudio()
  const transport = createTransport(getCtx)
  transport.setBpm(120) // 16th = 0.125 s, bar = 2 s
  const playing: (number | undefined)[] = []
  const drums = createDrums({
    getCtx,
    onPattern: (tag) => playing.push(tag),
    onStep: vi.fn(),
    transport
  })
  const kickOn = (step: number) => () => ({
    steps: { kick: Array.from({ length: 16 }, (_, i) => ({ ...STEP, on: i === step })) }
  })

  drums.start(kickOn(0), 0, 0) // pattern A; grid starts at 0.05 s
  drums.start(kickOn(8), 4, 1) // switch to B on bar 2 (beat 4 = 2.05 s)

  clock.currentTime = 4.2
  vi.advanceTimersByTime(25)
  drums.stop()

  // A's downbeat in bar 1, then B's step 9 in bar 2 (2.05 + 1 s); nothing from A in bar 2.
  expect(kicks).toStrictEqual([0.05, 3.05])
  expect(playing).toStrictEqual([0, 1])
})

test('a longer pattern plays its bars in turn and loops; a switch starts the next one from its first bar', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { clock, getCtx, kicks } = fakeAudio()
  const transport = createTransport(getCtx)
  transport.setBpm(120) // 16th = 0.125 s, bar = 2 s; grid starts at 0.05 s
  const drums = createDrums({ getCtx, onStep: vi.fn(), transport })
  // Two bars of 16ths: a kick on bar 1's downbeat and on bar 2's beat 3.
  const twoBars = Array.from({ length: 32 }, (_, i) => ({ ...STEP, on: i === 0 || i === 24 }))

  drums.start(() => ({ bars: 2, steps: { kick: twoBars } }), 0)
  // Bar 4 switches to the same pattern again: it starts over from bar 1, not bar 2.
  drums.start(() => ({ bars: 2, steps: { kick: twoBars } }), 12)
  clock.currentTime = 8.2
  vi.advanceTimersByTime(25)
  drums.stop()

  // Bar 1's downbeat, bar 2's beat 3, bar 3's downbeat (bar 1 again), then bar 4
  // starts over on bar 1's downbeat, not bar 2's beat 3 (7.05 s).
  expect(kicks).toStrictEqual([0.05, 3.05, 4.05, 6.05])
})

test('swing delays odd steps, ratchets split the step, probability skips hits', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { clock, getCtx, kicks } = fakeAudio()
  const transport = createTransport(getCtx)
  transport.setBpm(120) // 16th = 0.125 s; grid starts at 0.05 s
  // Step 2 (odd) twice, step 5 on a coin flip: rolls 0.9 and 0.9 pass the ratchet step;
  // step 5 misses with 0.7 in bar 1 and plays with 0.2 in bar 2.
  const rolls = [0.9, 0.7, 0.9, 0.2]
  const drums = createDrums({
    getCtx,
    onStep: vi.fn(),
    random: () => rolls.shift() ?? 0,
    transport
  })
  drums.setSwing(60) // odd steps 0.1 × 8th = 0.025 s late
  const kick = Array.from({ length: 16 }, () => STEP)
  kick[1] = { ...STEP, on: true, ratchet: 2 }
  kick[4] = { ...STEP, on: true, probability: 0.5 }

  drums.start(() => ({ steps: { kick } }), 0)
  clock.currentTime = 4
  vi.advanceTimersByTime(25)
  drums.stop()

  // Step 2 at 0.175 + 0.025, its second hit halfway to step 3 (0.3 s); step 5 at 0.55.
  expect(kicks).toStrictEqual([0.2, 0.25, 2.2, 2.25, 2.55])
})

test('a triplet grid spaces its steps in thirds of the beat, unswung; a grid change moves to its next line', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { clock, getCtx, kicks } = fakeAudio()
  const transport = createTransport(getCtx)
  transport.setBpm(120) // a beat is 0.5 s; grid starts at 0.05 s
  const drums = createDrums({ getCtx, onStep: vi.fn(), transport })
  drums.setSwing(75) // straight 16ths only: triplets stay even
  const row = (steps: number, on: number[]) =>
    Array.from({ length: steps }, (_, i) => ({ ...STEP, on: on.includes(i) }))
  // 16th triplets: six a beat. Steps 0-3 are the first beat's first four.
  let kick = row(24, [0, 1, 2, 3])
  drums.start(() => ({ steps: { kick } }), 0)
  clock.currentTime = 0.3
  vi.advanceTimersByTime(25)
  expect(kicks).toStrictEqual([0.05, 0.133, 0.217, 0.3])
  // Scheduled so far: up to 5/6 of the first beat. The pattern turns to 8th
  // triplets (three a beat, lines at 0, 1/3, 2/3, 1…): the next step is the
  // first line after that, the second beat (step 3, 0.55 s).
  kick = row(12, [2, 3, 4, 5, 6])
  clock.currentTime = 1.05
  vi.advanceTimersByTime(25)
  drums.stop()
  expect(kicks.slice(4)).toStrictEqual([0.55, 0.717, 0.883, 1.05])
})

test('silencing every track keeps a triplet pattern on its grid, so unmuting lands on it', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { clock, getCtx, kicks } = fakeAudio()
  const transport = createTransport(getCtx)
  transport.setBpm(120) // a beat is 0.5 s; grid starts at 0.05 s
  let heard = false
  const drums = createDrums({ audible: () => heard, getCtx, onStep: vi.fn(), transport })
  // 8th triplets, a kick on every step: 1/6 s apart.
  const kick = Array.from({ length: 12 }, () => ({ ...STEP, on: true }))

  drums.start(() => ({ steps: { kick } }), 0)
  clock.currentTime = 0.2 // scheduled up to 0.3 s: steps at 0.05 and 0.217 pass silently
  vi.advanceTimersByTime(25)
  heard = true
  clock.currentTime = 0.5
  vi.advanceTimersByTime(25)
  drums.stop()

  expect(kicks).toStrictEqual([0.383, 0.55]) // still thirds of a beat, not 16ths
})

test('a track loops over its own length across bar lines, ignoring steps past it', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { clock, getCtx, kicks } = fakeAudio()
  const transport = createTransport(getCtx)
  transport.setBpm(120) // 16th = 0.125 s, bar = 2 s; grid starts at 0.05 s
  const drums = createDrums({ getCtx, onStep: vi.fn(), transport })
  // Three steps long: step 1 every third 16th; step 6 is past the end, so never heard.
  const kick = Array.from({ length: 16 }, (_, i) => ({ ...STEP, on: i === 0 || i === 5 }))

  drums.start(() => ({ lengths: { kick: 3 }, steps: { kick } }), 0)
  clock.currentTime = 2.6
  vi.advanceTimersByTime(25)
  drums.stop()

  // Steps 0, 3 … 15, then on through bar 2 (18, 21), not back to its downbeat.
  expect(kicks).toStrictEqual([0.05, 0.425, 0.8, 1.175, 1.55, 1.925, 2.3, 2.675])
})

test('every kick hit is reported for the sidechain, with its level; other drums are not', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { clock, getCtx } = fakeAudio()
  const transport = createTransport(getCtx)
  transport.setBpm(120) // 16th = 0.125 s; grid starts at 0.05 s
  const kicks: [number, number][] = []
  const drums = createDrums({
    getCtx,
    onKick: (at, level) => kicks.push([+at.toFixed(3), level]),
    onStep: vi.fn(),
    transport
  })
  const kick = Array.from({ length: 16 }, () => STEP)
  kick[0] = { ...STEP, on: true, velocity: 0.5 }
  kick[4] = { ...STEP, on: true, ratchet: 2 }
  const snare = Array.from({ length: 16 }, (_, i) => ({ ...STEP, on: i === 2 }))

  drums.start(() => ({ steps: { kick, snare } }), 0)
  clock.currentTime = 1.9
  vi.advanceTimersByTime(25)
  drums.stop()

  expect(kicks).toStrictEqual([
    [0.05, 0.5],
    [0.55, 1], // a ratchet ducks on each of its hits
    [0.613, 1]
  ])
})

test('humanize moves each hit by up to 20 ms at full amount, a ratchet as one', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { clock, getCtx, kicks } = fakeAudio()
  const transport = createTransport(getCtx)
  transport.setBpm(120) // 16th = 0.125 s; grid starts at 0.05 s
  // Per step: the Chance roll, then the timing drift, then a velocity drift per hit.
  // Step 1: 0.75 drifts +10 ms at 100%; step 3 (two hits): 0 drifts the full 20 ms early.
  const rolls = [0, 0.75, 0.5, 0, 0, 0.5, 0.5]
  const drums = createDrums({
    getCtx,
    onStep: vi.fn(),
    random: () => rolls.shift() ?? 0.5,
    transport
  })
  drums.setHumanize(1)
  const kick = Array.from({ length: 16 }, () => STEP)
  kick[0] = { ...STEP, on: true }
  kick[2] = { ...STEP, on: true, ratchet: 2 }

  // Run the clock as it would, so hits are scheduled ahead of time and can land early.
  drums.start(() => ({ steps: { kick } }), 0)
  for (; clock.currentTime < 0.4; clock.currentTime += 0.025) vi.advanceTimersByTime(25)
  drums.stop()

  // Step 1 at 0.05 + 0.01; step 3 at 0.3 - 0.02, its second hit 62.5 ms on (0.3425).
  expect(kicks).toStrictEqual([0.06, 0.28, 0.342])
  expect(rolls).toStrictEqual([])
})

test('solo wins over mute, and several tracks can be soloed', () => {
  const tracks: TrackId[] = ['kick', 'snare', 'chat', 'cowbell']
  const heard = (muted: TrackId[], soloed: TrackId[]) =>
    tracks.filter((id) => isAudible(id, new Set(muted), new Set(soloed)))

  expect(heard([], [])).toStrictEqual(['kick', 'snare', 'chat', 'cowbell'])
  expect(heard(['kick', 'chat'], [])).toStrictEqual(['snare', 'cowbell'])
  expect(heard(['kick'], ['kick', 'snare'])).toStrictEqual(['kick', 'snare'])
})

test("a track plays the library instrument picked for it instead of its kit's", () => {
  const { getCtx, kicks } = fakeAudio()
  const drums = createDrums({ getCtx, onStep: vi.fn() })
  const tweak = { decay: 1, tune: 0 }

  // The 808 kick (a 110 Hz sweep) isn't recorded; the Classic kick is.
  drums.setKit('808', { kick: tweak, rim: { ...tweak, sound: 'classic-kick' } })
  drums.trigger('kick')
  drums.trigger('rim')
  expect(kicks).toHaveLength(1)

  drums.setKit('classic', { kick: tweak, rim: tweak })
  drums.trigger('kick')
  drums.trigger('rim')
  expect(kicks).toHaveLength(2)
})

test("a step's locks replace its voice's tune and decay for that hit only", () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { clock, getCtx, tones } = fakeAudio()
  const transport = createTransport(getCtx)
  const drums = createDrums({ getCtx, onStep: vi.fn(), transport })
  // The Classic kick: a 150 Hz sweep lasting 0.45 s (plus 0.05 s to let it ring out).
  drums.setKit('classic', { kick: { decay: 1, tune: -12 } })
  const kick = Array.from({ length: 16 }, () => STEP)
  kick[0] = { ...STEP, on: true }
  kick[4] = { ...STEP, decay: 2, on: true, tune: 7 }
  kick[8] = { ...STEP, on: true, tune: 0 } // locked to the kit's pitch, not the voice's

  drums.start(() => ({ steps: { kick } }), 0)
  clock.currentTime = 1.9
  vi.advanceTimersByTime(25)
  drums.stop()

  expect(tones).toStrictEqual([
    [75, 0.5], // the voice: an octave down
    [224.75, 0.95], // 7 semitones up, twice as long
    [150, 0.5]
  ])

  // Auditioning a step plays its locks too.
  drums.trigger('kick', { tune: 12 })
  expect(tones.at(-1)).toStrictEqual([300, 0.5])
})

test('a panned track plays through its own pan; centred ones go straight to the drums', () => {
  const { getCtx, made } = fakeAudio()
  const drums = createDrums({ getCtx, onStep: vi.fn() })
  const tweak = { decay: 1, tune: 0 }
  const splitters = () => made.filter((n) => n.kind === 'splitter')
  drums.setKit('classic', { chat: { ...tweak, pan: -0.5 }, kick: tweak })

  drums.trigger('kick')
  expect(splitters()).toHaveLength(0)
  drums.trigger('chat')
  drums.trigger('chat')
  expect(splitters()).toHaveLength(1) // made once, for the hats
  // Half left: the right side fades to cos(45°).
  const sides = (splitters()[0]?.outputs ?? []) as typeof made
  expect(sides.map((g) => +g.gain.value.toFixed(3))).toStrictEqual([1, 0.707])

  // Back to the middle: the pan glides there.
  drums.setKit('classic', { chat: tweak })
  expect(sides[1]?.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 0, 0.02)
})
