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
  const node = () => ({
    connect: <T>(n: T) => n,
    disconnect: vi.fn(),
    frequency: param(),
    gain: param()
  })
  const ctx = {
    createBiquadFilter: node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    createBufferSource: () => ({ ...node(), start: vi.fn(), stop: vi.fn() }),
    createGain: node,
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
    get currentTime() {
      return clock.currentTime
    },
    destination: {},
    sampleRate: 100
  }
  return { clock, getCtx: () => ctx as unknown as BaseAudioContext, kicks, tones }
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
    kick: Array.from({ length: 16 }, (_, i) => ({ ...STEP, on: i === step }))
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

  drums.start(() => ({ kick }), 0)
  clock.currentTime = 4
  vi.advanceTimersByTime(25)
  drums.stop()

  // Step 2 at 0.175 + 0.025, its second hit halfway to step 3 (0.3 s); step 5 at 0.55.
  expect(kicks).toStrictEqual([0.2, 0.25, 2.2, 2.25, 2.55])
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
  drums.start(() => ({ kick }), 0)
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

  drums.start(() => ({ kick }), 0)
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
