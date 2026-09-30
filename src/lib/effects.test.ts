import { expect, test, vi } from 'vitest'

import { createEffects, DEFAULT_EFFECTS, impulse } from './effects.js'

interface FakeNode {
  attack: FakeParam
  buffer?: unknown
  connect(next: FakeNode): FakeNode
  curve?: Float32Array
  delayTime: FakeParam
  frequency: FakeParam
  gain: FakeParam
  kind: string
  knee: FakeParam
  outputs: FakeNode[]
  ratio: FakeParam
  release: FakeParam
  threshold: FakeParam
  type?: string
}

interface FakeParam {
  setTargetAtTime: (value: number, t: number, c: number) => void
  value: number
}

// AudioContext stand-in that records node kinds and connections.
function fakeAudio() {
  const nodes: FakeNode[] = []
  const buffers: { channels: number; length: number }[] = []
  const param = (): FakeParam => ({
    setTargetAtTime: vi.fn(function (this: FakeParam, value: number) {
      this.value = value
    }),
    value: 0
  })
  const node = (kind: string): FakeNode => {
    const n: FakeNode = {
      attack: param(),
      connect(next) {
        n.outputs.push(next)
        return next
      },
      delayTime: param(),
      frequency: param(),
      gain: param(),
      kind,
      knee: param(),
      outputs: [],
      ratio: param(),
      release: param(),
      threshold: param()
    }
    nodes.push(n)
    return n
  }
  const destination = node('destination')
  const ctx = {
    createBiquadFilter: () => node('filter'),
    createBuffer(channels: number, length: number) {
      buffers.push({ channels, length })
      return { getChannelData: () => new Float32Array(length) }
    },
    createConvolver: () => node('convolver'),
    createDelay: () => node('delay'),
    createDynamicsCompressor: () => node('compressor'),
    createGain: () => node('gain'),
    createWaveShaper: () => node('clipper'),
    currentTime: 0,
    destination,
    sampleRate: 1000
  }
  const getCtx = vi.fn(() => ctx as unknown as BaseAudioContext)
  return { buffers, destination, getCtx, nodes }
}

const find = (nodes: FakeNode[], kind: string): FakeNode => {
  const n = nodes.find((x) => x.kind === kind)
  if (!n) throw new Error(`no ${kind}`)
  return n
}

test('nothing is built until an instrument asks for its channel; earlier settings still apply', () => {
  const { getCtx, nodes } = fakeAudio()
  const bus = createEffects(getCtx)
  bus.set({ ...DEFAULT_EFFECTS, delay_feedback: 0.5, delay_time: '1/8d' }, 120)
  expect(getCtx).not.toHaveBeenCalled()

  bus.channel('synth')
  expect(find(nodes, 'delay').delayTime.value).toBe(0.375) // a dotted 8th at 120 BPM
  const feedback = nodes.find((n) => n.kind === 'gain' && n.outputs.includes(find(nodes, 'delay')))
  expect(feedback?.gain.value).toBe(0.5)
})

test('a channel plays dry and into each effect at its send level', () => {
  const { getCtx, nodes } = fakeAudio()
  const bus = createEffects(getCtx)
  bus.set({ ...DEFAULT_EFFECTS, synth_delay: 0.25, synth_reverb: 0.5 }, 110)

  const input = bus.channel('synth') as unknown as FakeNode
  expect(bus.channel('synth')).toBe(input) // one channel per instrument
  const [dry, delaySend, reverbSend] = input.outputs
  expect(dry?.outputs).toStrictEqual([find(nodes, 'compressor')]) // the master stage
  expect([delaySend?.gain.value, reverbSend?.gain.value]).toStrictEqual([0.25, 0.5])
  expect(delaySend?.outputs).toStrictEqual([find(nodes, 'delay')])
  expect(reverbSend?.outputs).toStrictEqual([find(nodes, 'convolver')])

  bus.set({ ...DEFAULT_EFFECTS, synth_delay: 0 }, 110)
  expect(delaySend?.gain.value).toBe(0)
  const drums = bus.channel('drums') as unknown as FakeNode
  expect(drums).not.toBe(input)
})

test('everything reaches the speakers through the compressor, the limiter and the clipper', () => {
  const { destination, getCtx, nodes } = fakeAudio()
  const bus = createEffects(getCtx)
  const channels = [bus.channel('drums'), bus.channel('synth')] as unknown as FakeNode[]

  // Every path from a channel (dry, or through the delay's feedback loop or the
  // reverb) to the speakers, as the master stages it passes on the way.
  const [comp, limiter] = nodes.filter((x) => x.kind === 'compressor')
  const clip = find(nodes, 'clipper')
  const paths: string[][] = []
  const walk = (n: FakeNode, seen: FakeNode[], stages: string[]) => {
    if (n === destination) return void paths.push(stages)
    for (const next of n.outputs) {
      if (seen.includes(next)) continue // round the delay's feedback loop once
      const label =
        next === comp
          ? 'compressor'
          : next === limiter
            ? 'limiter'
            : next === clip
              ? 'clipper'
              : null
      walk(next, [...seen, next], label ? [...stages, label] : stages)
    }
  }
  for (const c of channels) walk(c, [c], [])
  expect(paths.length).toBeGreaterThanOrEqual(6) // dry, delay and reverb, per channel
  expect(new Set(paths.map((p) => p.join(' > ')))).toStrictEqual(
    new Set(['compressor > limiter > clipper'])
  )

  // The clipper leaves anything under 0.95 alone and never goes past 0.99, however
  // hot the input (a wave shaper holds its curve's ends beyond ±1).
  const curve = clip.curve ?? new Float32Array()
  const bent = [...curve].filter((y, i) => {
    const x = (2 * i) / (curve.length - 1) - 1
    return Math.abs(x) <= 0.95 && Math.abs(y - x) > 1e-6
  })
  expect(bent).toStrictEqual([])
  expect(Math.max(...curve.map(Math.abs))).toBeLessThan(0.99)
  expect(curve.at(-1)).toBeGreaterThan(0.98)
})

test('the compressor is transparent until switched on; the amount lowers its threshold', () => {
  const { getCtx, nodes } = fakeAudio()
  const bus = createEffects(getCtx)
  bus.set({ ...DEFAULT_EFFECTS, comp_amount: 1 }, 110) // amount set, but off
  bus.channel('synth')
  const comp = find(nodes, 'compressor')
  expect([comp.threshold.value, comp.ratio.value]).toStrictEqual([0, 1])

  bus.set({ ...DEFAULT_EFFECTS, comp_amount: 0.5, comp_on: true }, 110)
  expect([comp.threshold.value, comp.ratio.value]).toStrictEqual([-12, 3])
  bus.set({ ...DEFAULT_EFFECTS, comp_amount: 1, comp_on: true }, 110)
  expect(comp.threshold.value).toBe(-24)
})

test('muting silences only that instrument, even before its channel exists', () => {
  const { getCtx } = fakeAudio()
  const bus = createEffects(getCtx)
  bus.mute('drums', true)
  const drums = bus.channel('drums') as unknown as FakeNode
  const synth = bus.channel('synth') as unknown as FakeNode
  expect([drums.gain.value, synth.gain.value]).toStrictEqual([0, 1])

  bus.mute('drums', false)
  bus.mute('synth', true)
  expect([drums.gain.value, synth.gain.value]).toStrictEqual([1, 0])
})

test('tempo changes move the delay time; the reverb impulse is only remade for a new size', () => {
  const { buffers, getCtx, nodes } = fakeAudio()
  const bus = createEffects(getCtx)
  bus.channel('drums')
  expect(buffers).toStrictEqual([{ channels: 2, length: 2000 }]) // 2 s at 1 kHz

  bus.set({ ...DEFAULT_EFFECTS, delay_time: '1/4' }, 60)
  expect(find(nodes, 'delay').delayTime.value).toBe(1)
  bus.set({ ...DEFAULT_EFFECTS, delay_time: '1/4', reverb_mix: 0.2 }, 120)
  expect(find(nodes, 'delay').delayTime.value).toBe(0.5)
  expect(buffers).toHaveLength(1)

  bus.set({ ...DEFAULT_EFFECTS, reverb_size: 4 }, 120)
  expect(buffers.at(-1)).toStrictEqual({ channels: 2, length: 4000 })
})

test('the impulse decays to silence', () => {
  const { getCtx } = fakeAudio()
  const data: Float32Array[] = []
  const ctx = {
    ...(getCtx() as unknown as object),
    createBuffer: (_c: number, length: number) => ({
      getChannelData: () => {
        const d = new Float32Array(length)
        data.push(d)
        return d
      }
    }),
    sampleRate: 100
  } as unknown as BaseAudioContext
  impulse(ctx, 1, () => 1)

  const [left] = data
  expect(left?.[0]).toBe(1)
  expect(left?.[50]).toBeCloseTo(0.125)
  expect(left?.[99]).toBeCloseTo(0.000001)
})
