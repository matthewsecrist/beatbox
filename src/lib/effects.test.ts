import { expect, test, vi } from 'vitest'

import { createEffects, DEFAULT_EFFECTS, impulse } from './effects.js'

interface FakeNode {
  buffer?: unknown
  connect(next: FakeNode): FakeNode
  delayTime: FakeParam
  frequency: FakeParam
  gain: FakeParam
  kind: string
  outputs: FakeNode[]
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
      connect(next) {
        n.outputs.push(next)
        return next
      },
      delayTime: param(),
      frequency: param(),
      gain: param(),
      kind,
      outputs: []
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
    createGain: () => node('gain'),
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
  const { destination, getCtx, nodes } = fakeAudio()
  const bus = createEffects(getCtx)
  bus.set({ ...DEFAULT_EFFECTS, synth_delay: 0.25, synth_reverb: 0.5 }, 110)

  const input = bus.channel('synth') as unknown as FakeNode
  expect(bus.channel('synth')).toBe(input) // one channel per instrument
  const [dry, delaySend, reverbSend] = input.outputs
  expect(dry).toBe(destination)
  expect([delaySend?.gain.value, reverbSend?.gain.value]).toStrictEqual([0.25, 0.5])
  expect(delaySend?.outputs).toStrictEqual([find(nodes, 'delay')])
  expect(reverbSend?.outputs).toStrictEqual([find(nodes, 'convolver')])

  bus.set({ ...DEFAULT_EFFECTS, synth_delay: 0 }, 110)
  expect(delaySend?.gain.value).toBe(0)
  const drums = bus.channel('drums') as unknown as FakeNode
  expect(drums).not.toBe(input)
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
