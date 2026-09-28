import { expect, test, vi } from 'vitest'

import { createSynth } from './engine.js'

interface FakeNode {
  connect(next: FakeNode | FakeParam): FakeNode | FakeParam
  detune: FakeParam
  disconnect(): void
  frequency: FakeParam
  gain: FakeParam
  kind: string
  outputs: (FakeNode | FakeParam)[]
  Q: FakeParam
}

interface FakeParam {
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  name: string
  setTargetAtTime: ReturnType<typeof vi.fn>
  setValueAtTime: ReturnType<typeof vi.fn>
  value: number
}

// AudioContext stand-in that records what each node is connected to.
function fakeAudio() {
  const nodes: FakeNode[] = []
  const param = (name: string): FakeParam => ({
    linearRampToValueAtTime: vi.fn(),
    name,
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    value: 0
  })
  const node = (kind: string): FakeNode => {
    const n: FakeNode = {
      connect(next) {
        n.outputs.push(next)
        return next
      },
      detune: param(kind + '.detune'),
      disconnect() {
        n.outputs = []
      },
      frequency: param(kind + '.frequency'),
      gain: param(kind + '.gain'),
      kind,
      outputs: [],
      Q: param(kind + '.Q')
    }
    nodes.push(n)
    return n
  }
  const ctx = {
    createBiquadFilter: () => node('filter'),
    createGain: () => node('gain'),
    createOscillator: () => Object.assign(node('osc'), { start: vi.fn(), stop: vi.fn() }),
    currentTime: 0,
    destination: {}
  }
  return { ctx: ctx as unknown as BaseAudioContext, nodes }
}

// The gain LFO `n` of the first voice feeds (its depth), and the params that gain drives.
function lfoDepth(nodes: FakeNode[], n: 1 | 2 = 1): FakeNode {
  const depth = nodes.filter((node) => node.kind === 'osc')[n + 1]?.outputs[0]
  if (!depth || !('outputs' in depth)) throw new Error('LFO is not connected')
  return depth
}
const lfoTargets = (nodes: FakeNode[], n: 1 | 2 = 1): string[] =>
  lfoDepth(nodes, n).outputs.map((o) => ('name' in o ? o.name : o.kind))

test('LFO 1 sweeps the filter by default, in octaves; LFO 2 is vibrato', () => {
  const { ctx, nodes } = fakeAudio()
  createSynth({ lfo1_depth: 2, lfo2_depth: 30 }, () => ctx).noteOn(60)

  expect(lfoTargets(nodes, 1)).toStrictEqual(['filter.detune'])
  expect(lfoDepth(nodes, 1).gain.value).toBe(2400)
  const [osc1, osc2] = nodes.filter((n) => n.kind === 'osc')
  expect(lfoDepth(nodes, 2).outputs).toStrictEqual([osc1?.detune, osc2?.detune])
  expect(lfoDepth(nodes, 2).gain.value).toBe(30)
})

test('each LFO runs at its own rate', () => {
  const { ctx, nodes } = fakeAudio()
  createSynth({ lfo1_rate: 0.5, lfo2_rate: 6 }, () => ctx).noteOn(60)

  const [, , lfo1, lfo2] = nodes.filter((n) => n.kind === 'osc')
  expect([lfo1?.frequency.value, lfo2?.frequency.value]).toStrictEqual([0.5, 6])
})

test('amp tremolo swings a gain after the envelope', () => {
  const { ctx, nodes } = fakeAudio()
  createSynth({ lfo1_depth: 0.5, lfo1_target: 'amp' }, () => ctx).noteOn(60)

  const trem = nodes.find((n) => lfoDepth(nodes).outputs.includes(n.gain))
  // Dips from full level to half: 0.75 ± 0.25.
  expect(trem?.gain.value).toBe(0.75)
  expect(lfoDepth(nodes).gain.value).toBe(0.25)
  expect(nodes.some((n) => trem && n.kind === 'gain' && n.outputs.includes(trem))).toBe(true)
})

test('two LFOs on amp add their dips, down to silence at most', () => {
  const { ctx, nodes } = fakeAudio()
  const amp = { lfo1_target: 'amp', lfo2_target: 'amp' } as const
  createSynth({ ...amp, lfo1_depth: 0.4, lfo2_depth: 0.4 }, () => ctx).noteOn(60)
  createSynth({ ...amp, lfo1_depth: 1, lfo2_depth: 1 }, () => ctx).noteOn(60)

  // The gains an LFO drives are the two voices' tremolo stages.
  const trems = nodes.filter((n) => nodes.some((d) => d.outputs.includes(n.gain)))
  expect(trems.map((n) => n.gain.value)).toStrictEqual([0.6, 0])
})

test('a held note follows a change of target', () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth({ lfo1_depth: 1 }, () => ctx)
  synth.noteOn(60)
  synth.setParams({ lfo1_depth: 50, lfo1_target: 'pitch' })

  expect(lfoTargets(nodes)).toStrictEqual(['osc.detune', 'osc.detune'])
  expect(lfoDepth(nodes).gain.setTargetAtTime).toHaveBeenLastCalledWith(50, 0, 0.01)
})
