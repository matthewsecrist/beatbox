import { expect, type Mock, test, vi } from 'vitest'

import { createEffects, DEFAULT_EFFECTS, impulse } from './effects.js'

interface FakeNode {
  attack: FakeParam
  buffer?: unknown
  connect(next: FakeNode, output?: number, input?: number): FakeNode
  curve?: Float32Array
  delayTime: FakeParam
  frequency: FakeParam
  gain: FakeParam
  kind: string
  knee: FakeParam
  outputs: FakeNode[]
  // Which input of each output it feeds (a channel merger's side).
  ports: number[]
  // Q: a filter's resonance.
  Q: FakeParam
  ratio: FakeParam
  release: FakeParam
  threshold: FakeParam
  type?: string
}

interface FakeParam {
  cancelScheduledValues: Mock<(t: number) => void>
  linearRampToValueAtTime: Mock<(value: number, t: number) => void>
  setTargetAtTime: (value: number, t: number, c: number) => void
  setValueAtTime: Mock<(value: number, t: number) => void>
  value: number
}

// AudioContext stand-in that records node kinds and connections.
function fakeAudio() {
  const nodes: FakeNode[] = []
  const buffers: { channels: number; length: number }[] = []
  const param = (): FakeParam => ({
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(function (this: FakeParam, value: number) {
      this.value = value
    }),
    setValueAtTime: vi.fn(),
    value: 0
  })
  const node = (kind: string): FakeNode => {
    const n: FakeNode = {
      attack: param(),
      // connect(next, output, input): only the input (a merger's side) matters here.
      connect(next, ...ports) {
        n.outputs.push(next)
        n.ports.push(ports[1] ?? 0)
        return next
      },
      delayTime: param(),
      frequency: param(),
      gain: param(),
      kind,
      knee: param(),
      outputs: [],
      ports: [],
      Q: param(),
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
    createChannelMerger: () => node('merger'),
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

// Which sides the first `n` repeats of a delayed sound come out of: follows the
// graph from the left delay line (where the sends go) through every gain that's up,
// to the merger (noting the side) or on into a delay line (the next repeat).
function repeats(nodes: FakeNode[], n: number): string[] {
  const merger = find(nodes, 'merger')
  const lines = nodes.filter((x) => x.kind === 'delay')
  let playing = lines.slice(0, 1)
  const heard: string[] = []
  for (let i = 0; i < n; i++) {
    const sides = new Set<string>()
    const next = new Set<FakeNode>()
    const walk = (from: FakeNode) =>
      from.outputs.forEach((to, k) => {
        if (to.kind === 'gain' && to.gain.value === 0) return
        if (to === merger) sides.add(from.ports[k] === 0 ? 'L' : 'R')
        else if (lines.includes(to)) next.add(to)
        else walk(to)
      })
    playing.forEach(walk)
    heard.push([...sides].sort().join('+'))
    playing = [...next]
  }
  return heard
}

test('ping-pong bounces each repeat to the other side; straight keeps them in the middle', () => {
  const { getCtx, nodes } = fakeAudio()
  const bus = createEffects(getCtx)
  bus.set({ ...DEFAULT_EFFECTS, delay_time: '1/4' }, 120)
  bus.channel('synth')
  expect(repeats(nodes, 4)).toStrictEqual(['L+R', 'L+R', 'L+R', 'L+R'])

  bus.set({ ...DEFAULT_EFFECTS, delay_pingpong: true, delay_time: '1/4' }, 120)
  expect(repeats(nodes, 4)).toStrictEqual(['L', 'R', 'L', 'R'])
  // Both lines keep the delay time, so the bounces stay on the beat.
  expect(nodes.filter((x) => x.kind === 'delay').map((d) => d.delayTime.value)).toStrictEqual([
    0.5, 0.5
  ])

  // Feedback 0: one repeat, then nothing.
  bus.set({ ...DEFAULT_EFFECTS, delay_feedback: 0, delay_pingpong: true }, 120)
  expect(repeats(nodes, 3)).toStrictEqual(['L', '', ''])
})

test('a channel plays dry and into each effect at its send level', () => {
  const { getCtx, nodes } = fakeAudio()
  const bus = createEffects(getCtx)
  bus.set({ ...DEFAULT_EFFECTS, synth_delay: 0.25, synth_reverb: 0.5 }, 110)

  const input = bus.channel('synth') as unknown as FakeNode
  expect(bus.channel('synth')).toBe(input) // one channel per instrument
  // Past the mute, the ducking gain feeds the dry path and both sends.
  const [dry, delaySend, reverbSend] = input.outputs[0]?.outputs ?? []
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

test('the DJ filter passes everything in the middle; left sweeps a low-pass down, right a high-pass up', () => {
  const { getCtx, nodes } = fakeAudio() // 1 kHz sample rate: Nyquist is 500 Hz
  const bus = createEffects(getCtx)
  bus.channel('synth')
  // Straight after the compressor, before the limiter.
  const lowpass = find(nodes, 'compressor').outputs[0]
  const highpass = lowpass?.outputs[0]
  expect([lowpass?.type, highpass?.type]).toStrictEqual(['lowpass', 'highpass'])
  const cutoffs = (x: number) => {
    bus.set({ ...DEFAULT_EFFECTS, master_filter: x }, 110)
    return [lowpass?.frequency.value, highpass?.frequency.value]
  }

  expect(cutoffs(0)).toStrictEqual([500, 0]) // both at their pass-through ends
  expect(cutoffs(-1)).toStrictEqual([100, 0])
  expect(cutoffs(-0.5)[0]).toBeCloseTo(1414.21) // halfway in pitch between 20 kHz and 100 Hz
  expect(cutoffs(0.5)).toStrictEqual([500, 400]) // halfway between 20 Hz and 8 kHz
  expect(cutoffs(1)).toStrictEqual([500, 8000])
})

test("a section's ramp moves a send in a line; song edits wait, and its setting comes back after", () => {
  const { getCtx } = fakeAudio()
  const bus = createEffects(getCtx)
  bus.set({ ...DEFAULT_EFFECTS, synth_reverb: 0.2 }, 120)
  const reverbSend = (bus.channel('synth') as unknown as FakeNode).outputs[0]?.outputs[2]
  if (!reverbSend) throw new Error('no reverb send')
  const { gain } = reverbSend

  bus.automate({ synth_reverb: [0, 0.6] }, 2, 10)
  expect(gain.setValueAtTime.mock.calls).toStrictEqual([[0, 2]])
  expect(gain.linearRampToValueAtTime.mock.calls).toStrictEqual([[0.6, 10]])

  // Moving the song's own send while it ramps doesn't fight the ramp.
  bus.set({ ...DEFAULT_EFFECTS, synth_reverb: 0.4 }, 120)
  expect(gain.setTargetAtTime).not.toHaveBeenCalled()

  // The next section leaves it alone: the song's setting is back on its first beat,
  // and edits apply again.
  bus.automate({}, 10, 18)
  expect(gain.setValueAtTime.mock.calls.at(-1)).toStrictEqual([0.4, 10])
  bus.set({ ...DEFAULT_EFFECTS, synth_reverb: 0.3 }, 120)
  expect(gain.value).toBe(0.3)
})

test('the master filter ramps evenly in pitch, and stopping the song glides it back', () => {
  const { getCtx, nodes } = fakeAudio() // Nyquist is 500 Hz
  const bus = createEffects(getCtx)
  bus.channel('drums')
  const lowpass = find(nodes, 'compressor').outputs[0]
  const highpass = lowpass?.outputs[0]
  if (!lowpass || !highpass) throw new Error('no DJ filter')

  bus.automate({ master_filter: [0, -1] }, 0, 4) // off to fully low-pass over 4 s
  const ramp = lowpass.frequency.linearRampToValueAtTime.mock.calls
  expect(lowpass.frequency.setValueAtTime.mock.calls).toStrictEqual([[500, 0]])
  expect(ramp).toHaveLength(32)
  expect(ramp[15]?.[0]).toBeCloseTo(1414.21) // halfway (2 s): halfway in pitch
  expect(ramp[15]?.[1]).toBe(2)
  expect(ramp.at(-1)).toStrictEqual([100, 4])
  expect(highpass.frequency.linearRampToValueAtTime.mock.calls.every(([hz]) => hz === 0)).toBe(true)

  bus.stopAutomation()
  expect(lowpass.frequency.cancelScheduledValues).toHaveBeenCalledWith(0)
  expect(lowpass.frequency.value).toBe(500) // gliding back to the song's setting: off
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

test('a kick ducks the synth (dry and sends) by the amount and it recovers over the release', () => {
  const { getCtx } = fakeAudio()
  const bus = createEffects(getCtx)
  // The gain after each channel's mute: its ducking gain.
  const duckCalls = (instrument: 'drums' | 'synth') => {
    const duck = (bus.channel(instrument) as unknown as FakeNode).outputs[0]
    if (!duck) throw new Error('no ducking gain')
    return vi.mocked(duck.gain.setTargetAtTime).mock.calls
  }
  const calls = () => duckCalls('synth')

  bus.duck(1, 1) // off by default
  expect(calls()).toStrictEqual([])

  // 1/8 at 120 BPM is 0.25 s: back 95% of the way after three time constants.
  bus.set({ ...DEFAULT_EFFECTS, duck_amount: 0.8, duck_release: '1/8' }, 120)
  bus.duck(1, 1.3) // an accented kick ducks no deeper than the amount
  bus.duck(2, 0.5) // a soft kick, half as deep
  expect(calls()).toStrictEqual([
    [0.19999999999999996, 1, 0.003],
    [1, 1.01, 0.25 / 3],
    [0.6, 2, 0.003],
    [1, 2.01, 0.25 / 3]
  ])
  expect(duckCalls('drums')).toStrictEqual([]) // only the synth

  // Muted drums don't pump the synth.
  bus.mute('drums', true)
  bus.duck(3, 1)
  expect(calls()).toHaveLength(4)
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
