import { afterEach, expect, test, vi } from 'vitest'

import { STEP } from '../song.svelte.js'
import { createTransport } from '../transport.js'
import { createDrums } from './engine.js'

// AudioContext stand-in: records when each kick (a 150 Hz sweep) starts.
function fakeAudio() {
  const clock = { currentTime: 0 }
  const kicks: number[] = []
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
      return {
        ...node(),
        frequency: param((v) => (hz ||= v)),
        start: (t: number) => hz === 150 && kicks.push(+t.toFixed(3)),
        stop: vi.fn()
      }
    },
    get currentTime() {
      return clock.currentTime
    },
    destination: {},
    sampleRate: 100
  }
  return { clock, getCtx: () => ctx as unknown as BaseAudioContext, kicks }
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
