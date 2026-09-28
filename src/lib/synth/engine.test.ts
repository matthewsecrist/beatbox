import { expect, type Mock, test, vi } from 'vitest'

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
  cancelScheduledValues: Mock<AudioParam['cancelScheduledValues']>
  exponentialRampToValueAtTime: Mock<AudioParam['exponentialRampToValueAtTime']>
  linearRampToValueAtTime: Mock<AudioParam['linearRampToValueAtTime']>
  name: string
  setTargetAtTime: Mock<AudioParam['setTargetAtTime']>
  setValueAtTime: Mock<AudioParam['setValueAtTime']>
  value: number
}

// AudioContext stand-in that records what each node is connected to.
function fakeAudio() {
  const nodes: FakeNode[] = []
  const param = (name: string): FakeParam => ({
    cancelScheduledValues: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
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
  // `clock` is the same context, to move its time.
  return { clock: ctx, ctx: ctx as unknown as BaseAudioContext, nodes }
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

test('the filter envelope sweeps the cutoff in octaves, and releases from where it is', () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth(
    {
      filter_attack: 0.1,
      filter_decay: 0.2,
      filter_env_amount: 2,
      filter_release: 0.5,
      filter_sustain: 0.25
    },
    () => ctx
  )
  synth.noteOn(60)
  const detune = nodes.find((n) => n.kind === 'filter')?.detune

  expect(detune?.setValueAtTime.mock.calls).toStrictEqual([[0, 0]])
  const ramps = detune?.linearRampToValueAtTime.mock.calls.map(([v, t]) => [v, +t.toFixed(3)])
  // Two octaves up by the end of the attack, then down to a quarter of that.
  expect(ramps).toStrictEqual([
    [2400, 0.1],
    [600, 0.3]
  ])

  clock.currentTime = 0.05 // halfway up the attack
  synth.noteOff(60)
  expect(detune?.cancelScheduledValues).toHaveBeenCalledWith(0.05)
  expect(detune?.setValueAtTime).toHaveBeenLastCalledWith(1200, 0.05)
  expect(detune?.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 0.55)
})

test('with no envelope amount the cutoff is left alone', () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth({ filter_env_amount: 0 }, () => ctx)
  synth.noteOn(60)
  synth.noteOff(60)

  const detune = nodes.find((n) => n.kind === 'filter')?.detune
  expect(detune?.setValueAtTime).not.toHaveBeenCalled()
  expect(detune?.linearRampToValueAtTime).not.toHaveBeenCalled()
})

// Voice `n`'s first oscillator (each voice makes osc1, osc2 and two LFOs).
const osc1Of = (nodes: FakeNode[], n: number): FakeNode | undefined =>
  nodes.filter((node) => node.kind === 'osc')[n * 4]

// Where voice `n` glides [from Hz, to Hz, over seconds], or null if it doesn't.
function glideOf(nodes: FakeNode[], n: number): null | number[] {
  const f = osc1Of(nodes, n)?.frequency
  const [from, t0] = f?.setValueAtTime.mock.calls[0] ?? []
  const [to, t1] = f?.exponentialRampToValueAtTime.mock.calls[0] ?? []
  if (from === undefined || to === undefined || t0 === undefined || t1 === undefined) return null
  return [Math.round(from), Math.round(to), +(t1 - t0).toFixed(3)]
}

test('legato glide slides into a note played while the last is held, not after it', () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth({ glide: 0.1 }, () => ctx)
  synth.noteOn(60)
  clock.currentTime = 0.5
  synth.noteOn(67) // 60 still held
  synth.noteOff(60)
  synth.noteOff(67)
  clock.currentTime = 1
  synth.noteOn(72) // nothing held

  expect(glideOf(nodes, 0)).toBe(null) // the first note has nothing to glide from
  expect(glideOf(nodes, 1)).toStrictEqual([262, 392, 0.1]) // C4 -> G4 over 100 ms
  expect(glideOf(nodes, 2)).toBe(null)
  expect(osc1Of(nodes, 2)?.frequency.value).toBe(523.2511306011972)
})

test("'always' glides from the last note even after it was let go", () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth({ glide: 0.2, glide_mode: 'always' }, () => ctx)
  synth.noteOn(60)
  synth.noteOff(60)
  clock.currentTime = 1
  synth.noteOn(72)

  expect(glideOf(nodes, 1)).toStrictEqual([262, 523, 0.2])
})

test('a chord does not glide within itself; each source glides on its own; 0 is off', () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth({ glide: 0.1, glide_mode: 'always' }, () => ctx)
  for (const midi of [60, 64, 67]) synth.noteOn(midi)
  clock.currentTime = 0.5
  synth.noteOn(62, undefined, 'pad0:62') // a loop pad: not after the keyboard's chord
  synth.noteOn(69) // the keyboard: from the chord's last note

  expect([0, 1, 2, 3].map((n) => glideOf(nodes, n))).toStrictEqual([null, null, null, null])
  expect(glideOf(nodes, 4)).toStrictEqual([392, 440, 0.1])

  const off = fakeAudio()
  const plain = createSynth({ glide: 0 }, () => off.ctx)
  plain.noteOn(60)
  plain.noteOn(67)
  expect(glideOf(off.nodes, 1)).toBe(null)
})
