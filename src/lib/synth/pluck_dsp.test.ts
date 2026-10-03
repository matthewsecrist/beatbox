import { expect, test } from 'vitest'

import { PluckedString } from './pluck_dsp.js'

// Windowed complex projection isolates the fundamental from the string's harmonics.
function magnitude(
  audio: Float32Array,
  rate: number,
  frequency: number,
  start: number,
  seconds: number
) {
  const offset = Math.floor(start * rate)
  const length = Math.floor(seconds * rate)
  const omega = (2 * Math.PI * frequency) / rate
  let real = 0
  let imaginary = 0
  for (let i = 0; i < length; i++) {
    const sample =
      (audio[offset + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1)))
    real += sample * Math.cos(omega * i)
    imaginary += sample * Math.sin(omega * i)
  }
  return Math.hypot(real, imaginary) / length
}

function render(
  rate: number,
  frequency: number,
  brightness: number,
  decay: number,
  seconds: number
) {
  const string = new PluckedString(rate, 4567)
  const audio = new Float32Array(Math.ceil(rate * seconds))
  for (let i = 0; i < audio.length; i++) audio[i] = string.sample(frequency, brightness, decay)
  return { audio, string }
}

for (const rate of [44100, 48000]) {
  for (const frequency of [65.406391325, 440, 1760]) {
    for (const brightness of [0, 0.5, 1]) {
      test(`string fundamental stays tuned at ${frequency} Hz, ${rate} Hz, brightness ${brightness}`, () => {
        const { audio } = render(rate, frequency, brightness, 2, 0.7)
        let peak = 0
        let cents = 0
        for (let offset = -12; offset <= 12; offset++) {
          const level = magnitude(audio, rate, frequency * 2 ** (offset / 1200), 0.08, 0.6)
          if (level > peak) {
            peak = level
            cents = offset
          }
        }
        expect(peak).toBeGreaterThan(0.0001)
        expect(Math.abs(cents)).toBeLessThanOrEqual(2)
      })
    }
  }
}

for (const decay of [0.5, 2]) {
  test(`fundamental follows a ${decay} second 60 dB natural decay`, () => {
    const rate = 48000
    const frequency = 440
    const { audio } = render(rate, frequency, 0.5, decay, 1.3)
    const before = magnitude(audio, rate, frequency, 0.1, 0.1)
    const after = magnitude(audio, rate, frequency, 0.1 + decay / 2, 0.1)
    expect(20 * Math.log10(after / before)).toBeCloseTo(-30, 0)
  })
}

test('brightness preserves upper harmonics while darker strings damp them naturally', () => {
  const rate = 48000
  const frequency = 220
  const dark = render(rate, frequency, 0, 2, 0.6).audio
  const bright = render(rate, frequency, 1, 2, 0.6).audio
  const darkRatio =
    magnitude(dark, rate, frequency * 5, 0.3, 0.2) / magnitude(dark, rate, frequency, 0.3, 0.2)
  const brightRatio =
    magnitude(bright, rate, frequency * 5, 0.3, 0.2) / magnitude(bright, rate, frequency, 0.3, 0.2)
  expect(brightRatio).toBeGreaterThan(darkRatio * 4)
})

test('a held string becomes silent instead of sustaining indefinitely', () => {
  const { audio, string } = render(44100, 110, 0.5, 0.1, 1)
  let tailPeak = 0
  for (let i = 22050; i < audio.length; i++) tailPeak = Math.max(tailPeak, Math.abs(audio[i] ?? 0))
  expect(tailPeak).toBeLessThan(0.00001)
  expect(string.silent).toBe(true)
})

test('pitch modulation and control extremes keep the feedback loop bounded', () => {
  const string = new PluckedString(48000, 4567)
  let peak = 0
  for (let i = 0; i < 96000; i++) {
    const frequency = 55 * 2 ** ((i / 96000) * 5 + Math.sin(i / 1000) * 0.02)
    const value = string.sample(frequency, i < 48000 ? 0 : 1, 10)
    peak = Math.max(peak, Math.abs(value))
  }
  expect(Number.isFinite(peak)).toBe(true)
  expect(peak).toBeGreaterThan(0.1)
  expect(peak).toBeLessThan(2)
})
