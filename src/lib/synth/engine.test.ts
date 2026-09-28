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

// The gain the voice's LFO feeds (its depth), and the params that gain drives.
function lfoDepth(nodes: FakeNode[]): FakeNode {
  const depth = nodes.filter((n) => n.kind === 'osc')[2]?.outputs[0]
  if (!depth || !('outputs' in depth)) throw new Error('LFO is not connected')
  return depth
}
const lfoTargets = (nodes: FakeNode[]): string[] =>
  lfoDepth(nodes).outputs.map((o) => ('name' in o ? o.name : o.kind))

test('the LFO sweeps the filter by default, in octaves', () => {
  const { ctx, nodes } = fakeAudio()
  createSynth({ lfo_depth: 2 }, () => ctx).noteOn(60)

  expect(lfoTargets(nodes)).toStrictEqual(['filter.detune'])
  expect(lfoDepth(nodes).gain.value).toBe(2400)
})

test('pitch vibrato drives both oscillators by the depth in cents', () => {
  const { ctx, nodes } = fakeAudio()
  createSynth({ lfo_depth: 30, lfo_target: 'pitch' }, () => ctx).noteOn(60)

  const [osc1, osc2] = nodes.filter((n) => n.kind === 'osc')
  expect(lfoDepth(nodes).outputs).toStrictEqual([osc1?.detune, osc2?.detune])
  expect(lfoDepth(nodes).gain.value).toBe(30)
})

test('amp tremolo swings a gain after the envelope', () => {
  const { ctx, nodes } = fakeAudio()
  createSynth({ lfo_depth: 0.5, lfo_target: 'amp' }, () => ctx).noteOn(60)

  const trem = nodes.find((n) => lfoDepth(nodes).outputs.includes(n.gain))
  // Dips from full level to half: 0.75 ± 0.25.
  expect(trem?.gain.value).toBe(0.75)
  expect(lfoDepth(nodes).gain.value).toBe(0.25)
  expect(nodes.some((n) => trem && n.kind === 'gain' && n.outputs.includes(trem))).toBe(true)
})

test('a held note follows a change of target', () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth({ lfo_depth: 1 }, () => ctx)
  synth.noteOn(60)
  synth.setParams({ lfo_depth: 50, lfo_target: 'pitch' })

  expect(lfoTargets(nodes)).toStrictEqual(['osc.detune', 'osc.detune'])
  expect(lfoDepth(nodes).gain.setTargetAtTime).toHaveBeenLastCalledWith(50, 0, 0.01)
})
