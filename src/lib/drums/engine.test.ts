import { afterEach, expect, test, vi } from 'vitest'

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
    kick: Array.from({ length: 16 }, (_, i) => i === step)
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
