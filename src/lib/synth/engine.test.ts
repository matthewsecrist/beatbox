import { expect, type Mock, test, vi } from 'vitest'

import type { SynthParams } from '../types.js'

import { createSynth } from './engine.js'

interface FakeNode {
  buffer?: unknown
  connect(next: FakeNode | FakeParam): FakeNode | FakeParam
  curve?: Float32Array
  // A delay line's time (createDelay).
  delayTime?: FakeParam
  detune: FakeParam
  disconnect(): void
  frequency: FakeParam
  gain: FakeParam
  kind: string
  loop?: boolean
  offset: FakeParam
  onended?: () => void
  outputs: (FakeNode | FakeParam)[]
  Q: FakeParam
  start?: Mock<AudioScheduledSourceNode['start']>
  stop?: Mock<AudioScheduledSourceNode['stop']>
  type?: string
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
      offset: param(kind + '.offset'),
      outputs: [],
      Q: param(kind + '.Q')
    }
    nodes.push(n)
    return n
  }
  const ctx = {
    createBiquadFilter: () => node('filter'),
    createBuffer: (_channels: number, length: number, rate: number) => ({
      duration: length / rate,
      getChannelData: () => new Float32Array(length)
    }),
    createBufferSource: () =>
      Object.assign(node('noise'), { buffer: null, loop: false, start: vi.fn(), stop: vi.fn() }),
    createChannelMerger: () => node('merger'),
    createConstantSource: () => Object.assign(node('const'), { start: vi.fn(), stop: vi.fn() }),
    createConvolver: () => Object.assign(node('convolver'), { buffer: null }),
    createDelay: () => Object.assign(node('delay'), { delayTime: param('delay.delayTime') }),
    createGain: () => node('gain'),
    createOscillator: () => Object.assign(node('osc'), { start: vi.fn(), stop: vi.fn() }),
    createWaveShaper: () => node('shaper'),
    currentTime: 0,
    destination: {},
    sampleRate: 100
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

test('a synced LFO lasts its note value at the tempo, and follows tempo changes', () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth(
    { lfo1_note: '1/8', lfo1_sync: true, lfo2_note: '1/1d', lfo2_rate: 6 },
    () => ctx
  )
  synth.setTempo(120) // 2 beats a second
  synth.noteOn(60)
  // A loop pad's own sound, synced to triplet sixteenths.
  synth.noteOn(64, 0, 'pad0:64', { lfo1_note: '1/16t', lfo1_sync: true })

  const oscs = nodes.filter((n) => n.kind === 'osc')
  const [, , lfo1, lfo2] = oscs
  const padLfo1 = oscs[6]
  expect(lfo1?.frequency.value).toBe(4) // 1/8 notes: 4 a second
  expect(lfo2?.frequency.value).toBe(6) // free: its own Hz, whatever its note
  expect(padLfo1?.frequency.value).toBeCloseTo(12) // 1/16 triplets: 12 a second

  // A section at 90 BPM: synced LFOs slow down, free ones don't move.
  synth.setTempo(90)
  expect(lfo1?.frequency.setTargetAtTime).toHaveBeenLastCalledWith(3, 0, 0.01)
  expect(padLfo1?.frequency.setTargetAtTime).toHaveBeenLastCalledWith(9, 0, 0.01)
  expect(lfo2?.frequency.setTargetAtTime).not.toHaveBeenCalled()

  // Syncing LFO 2 to a dotted whole note (6 beats) at 90 BPM: a quarter cycle a second.
  synth.setParams({ lfo2_sync: true })
  expect(lfo2?.frequency.setTargetAtTime).toHaveBeenLastCalledWith(0.25, 0, 0.01)
  synth.setParams({ lfo1_sync: false })
  expect(lfo1?.frequency.setTargetAtTime).toHaveBeenLastCalledWith(4, 0, 0.01) // back to its 4 Hz
  synth.setTempo(60)
  expect(lfo1?.frequency.setTargetAtTime).toHaveBeenLastCalledWith(4, 0, 0.01)
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

test('the pitch envelope starts a note its amount off and falls onto its pitch over the decay', () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth({ pitch_env_amount: 12, pitch_env_decay: 0.2 }, () => ctx)
  clock.currentTime = 1
  synth.noteOn(60)

  const [osc1, osc2] = nodes.filter((n) => n.kind === 'osc')
  const penv = nodes.find((n) => n.kind === 'const')
  // Both oscillators, in cents, on top of their own detune.
  expect(penv?.outputs).toStrictEqual([osc1?.detune, osc2?.detune])
  expect(penv?.offset.setValueAtTime).toHaveBeenCalledWith(1200, 1)
  expect(penv?.offset.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.2)

  // A loop pad's own sound brings its own envelope; off means no bend at all.
  synth.noteOn(62, undefined, 'pad0:62', { pitch_env_amount: -5 })
  expect(nodes.filter((n) => n.kind === 'const')[1]?.offset.setValueAtTime).toHaveBeenCalledWith(
    -500,
    1
  )
  synth.noteOn(64, undefined, 'pad1:64', { pitch_env_amount: 0 })
  expect(nodes.filter((n) => n.kind === 'const')).toHaveLength(2)
})

test('the sub is a sine an octave below osc 1 that glides, bends and wobbles with it', () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth(
    {
      glide: 0.1,
      lfo2_depth: 20,
      osc1_detune: 5,
      osc1_octave: 1,
      pitch_env_amount: 3,
      sub_level: 0.5
    },
    () => ctx
  )
  synth.noteOn(57, undefined, 1) // A3: osc 1 at 440 Hz, the sub at 220
  clock.currentTime = 1
  synth.noteOn(69, undefined, 2) // A4 a beat later, gliding while A3 is held

  const oscs = nodes.filter((n) => n.kind === 'osc')
  // Second voice: osc1, osc2, two LFOs, then the sub.
  const sub = oscs[9]
  expect(sub?.type).toBe('sine')
  expect(sub?.detune.value).toBe(5)
  expect(sub?.frequency.setValueAtTime).toHaveBeenCalledWith(220, 1)
  expect(sub?.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(440, 1.1)
  const [penv] = nodes.filter((n) => n.kind === 'const').slice(1)
  expect(penv?.outputs).toContain(sub?.detune)
  expect(lfoDepth(nodes, 2).outputs).toHaveLength(3) // first voice: both oscillators and its sub
  const subGain = sub?.outputs[0]
  expect(subGain && 'gain' in subGain ? subGain.gain.value : null).toBe(0.5)

  // Turning the sub down follows on the sounding note.
  synth.setParams({ sub_level: 0.2 })
  expect(subGain && 'gain' in subGain ? subGain.gain.setTargetAtTime : null).toHaveBeenCalledWith(
    0.2,
    1,
    0.01
  )
})

test('noise loops one shared buffer, from its own point in it for each note', () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth({ noise_level: 0.3 }, () => ctx)
  synth.noteOn(60)
  synth.noteOn(64)

  const [a, b] = nodes.filter((n) => n.kind === 'noise')
  expect(a?.buffer).toBeDefined()
  expect(a?.buffer).toBe(b?.buffer)
  expect(a?.loop).toBe(true)
  const level = a?.outputs[0]
  expect(level && 'gain' in level ? level.gain.value : null).toBe(0.3)

  // Off: a note gets no noise or sub nodes at all.
  const before = nodes.length
  createSynth(null, () => ctx).noteOn(67)
  const added = nodes.slice(before)
  expect(added.filter((n) => n.kind === 'noise')).toStrictEqual([])
  expect(added.filter((n) => n.kind === 'osc')).toHaveLength(4)
})

// What a signal `x` from the oscillators comes out of the drive stage as: the
// driven copy (through the character's curve) plus the clean one (a straight line).
function driven(nodes: FakeNode[], x: number): number {
  const shapers = nodes.filter((n) => n.kind === 'shaper')
  const bent = shapers.find((n) => (n.curve?.length ?? 0) > 2)
  const straight = shapers.find((n) => n.curve?.length === 2)
  const feeding = (to: FakeNode | undefined) => nodes.find((n) => to && n.outputs.includes(to))
  const push = feeding(bent)
  const level = feeding(straight)
  const [wet, dry] = [bent?.outputs[0], straight?.outputs[0]]
  if (!bent?.curve || !straight?.curve || !push || !level || !wet || !dry) {
    throw new Error('drive stage is not connected')
  }
  if (!('gain' in wet) || !('gain' in dry)) throw new Error('drive stage has no output gains')
  const x1 = x * level.gain.value
  return (
    wet.gain.value * shape(bent.curve, x1 * push.gain.value) +
    dry.gain.value * shape(straight.curve, x1)
  )
}

function driveNodes(params: Partial<SynthParams>): FakeNode[] {
  const { ctx, nodes } = fakeAudio()
  createSynth({ osc1_level: 0.6, osc2_level: 0.4, ...params }, () => ctx).noteOn(60)
  return nodes
}

// Reads a WaveShaper curve at `x` the way the Web Audio spec interpolates it.
function shape(curve: Float32Array, x: number): number {
  const pos = ((curve.length - 1) / 2) * (Math.max(-1, Math.min(1, x)) + 1)
  const k = Math.min(Math.floor(pos), curve.length - 2)
  return (curve[k] ?? 0) + (pos - k) * ((curve[k + 1] ?? 0) - (curve[k] ?? 0))
}

const LEVELS = [-1, -0.5, 0.1, 0.7, 1]

test('drive 0 leaves the sound untouched, whatever the character and mix', () => {
  for (const drive_type of ['soft', 'tube', 'hard', 'fold'] as const) {
    for (const drive_mix of [0, 0.5, 1]) {
      const nodes = driveNodes({ drive: 0, drive_mix, drive_type })
      for (const x of LEVELS) expect(driven(nodes, x)).toBeCloseTo(x, 5)
    }
  }
})

test('full drive squashes the wave flat, and mix 0 brings back the clean sound', () => {
  const pushed = driveNodes({ drive: 1, drive_mix: 1, drive_type: 'soft' })
  // A quarter-level signal comes out nearly as loud as a full one, and evenly
  // both ways.
  const full = driven(pushed, 1)
  expect(driven(pushed, 0.25) / full).toBeGreaterThan(0.95)
  expect(driven(pushed, -1)).toBeCloseTo(-full, 5)

  const clean = driveNodes({ drive: 1, drive_mix: 0, drive_type: 'soft' })
  for (const x of LEVELS) expect(driven(clean, x)).toBeCloseTo(x, 5)
})

test('tube bends the bottom of the wave harder than the top', () => {
  const nodes = driveNodes({ drive: 0.5, drive_mix: 1, drive_type: 'tube' })
  expect(driven(nodes, 1)).toBeGreaterThan(-driven(nodes, -1) * 1.1)
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

test("a loop's new sound reaches only that loop's sounding notes", () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth({ filter_cutoff: 1000 }, () => ctx)
  synth.noteOn(60) // keyboard
  synth.noteOn(62, 0, 'pad0:62', { filter_cutoff: 400 })
  synth.noteOn(64, 0, 'pad1:64', { filter_cutoff: 400 })
  synth.setOwnParams('pad0:', { filter_cutoff: 2000 })

  // Each voice builds the same nodes, so the second third of the filters are pad0's.
  const filters = nodes.filter((n) => n.kind === 'filter')
  const moved = filters.flatMap((f, i) =>
    f.frequency.setTargetAtTime.mock.calls.some(([v]) => v === 2000) ? [i / filters.length] : []
  )
  expect(moved).toHaveLength(1)
  expect(moved[0]).toBeGreaterThanOrEqual(1 / 3)
  expect(moved[0]).toBeLessThan(2 / 3)
})

test("the arranger's filter lane shifts every note's cutoff, sounding and new, in octaves", () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth({}, () => ctx)
  synth.automateFilter(null, 0, 1) // nothing to undo yet: nothing is made
  expect(nodes.filter((n) => n.kind === 'const')).toStrictEqual([])

  synth.noteOn(60) // already sounding when the lane starts
  synth.automateFilter([-2, 1], 1, 5)
  synth.noteOn(64, undefined, 'pad0:64', {}) // a pad's note started during it
  const shift = nodes.find((n) => n.kind === 'const')
  expect(shift?.outputs.map((o) => ('name' in o ? o.name : o.kind))).toStrictEqual([
    'filter.detune',
    'filter.detune'
  ])
  expect(shift?.offset.setValueAtTime).toHaveBeenCalledWith(-2400, 1) // cents
  expect(shift?.offset.linearRampToValueAtTime).toHaveBeenCalledWith(1200, 5)

  // A section without the lane: back to no shift on its first beat.
  synth.automateFilter(null, 5, 9)
  expect(shift?.offset.setValueAtTime).toHaveBeenLastCalledWith(0, 5)
  // The song stopped mid-ramp: it glides back from where it is, now.
  clock.currentTime = 3
  synth.stopAutomation()
  expect(shift?.offset.cancelScheduledValues).toHaveBeenCalledWith(3)
  expect(shift?.offset.setTargetAtTime).toHaveBeenLastCalledWith(0, 3, 0.02)
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

// Each voice's filter, in order: the one feeding a gain (its amp) that feeds a gain
// (the tremolo). A voice's DC blocker feeds its filter, and a sound's echo damping
// feeds a gain into its delay line.
const isGain = (x: FakeNode | FakeParam | undefined): x is FakeNode =>
  x !== undefined && 'kind' in x && x.kind === 'gain'
const voiceFilters = (nodes: FakeNode[]): FakeNode[] =>
  nodes.filter(
    (n) => n.kind === 'filter' && isGain(n.outputs[0]) && isGain(n.outputs[0].outputs[0])
  )

test("velocity scales a note's level, and its filter sweep as far as filter_velocity says", () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth(
    { attack: 0.1, decay: 0.2, filter_env_amount: 2, filter_velocity: 0.5, sustain: 0.5 },
    () => ctx
  )
  synth.noteOn(60, 0, 'soft', null, 0.5)
  synth.noteOn(64, 0, 'hard') // full velocity

  const [soft, hard] = voiceFilters(nodes)
  const amp = (filter: FakeNode | undefined) => {
    const out = filter?.outputs[0]
    return out && 'gain' in out ? out.gain : undefined
  }
  const ramps = (param: FakeParam | undefined) =>
    param?.linearRampToValueAtTime.mock.calls.map(([v, t]) => [+v.toFixed(4), +t.toFixed(3)])

  // Half the level all through: peak, then sustain.
  expect(ramps(amp(soft))).toStrictEqual([
    [0.15, 0.1],
    [0.075, 0.3]
  ])
  expect(ramps(amp(hard))).toStrictEqual([
    [0.3, 0.1],
    [0.15, 0.3]
  ])
  // filter_velocity 0.5: a half-velocity note sweeps three quarters as far.
  expect(ramps(soft?.detune)?.[0]).toStrictEqual([1800, 0.005])
  expect(ramps(hard?.detune)?.[0]).toStrictEqual([2400, 0.005])

  // Letting go releases from the soft note's own level.
  clock.currentTime = 0.05 // halfway up the attack
  synth.noteOff('soft')
  expect(amp(soft)?.setValueAtTime).toHaveBeenLastCalledWith(0.075, 0.05)
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

test('each note takes the filter type, with resonance meaning the same for every type', () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth({ filter_resonance: 20 }, () => ctx)
  synth.noteOn(60)
  synth.noteOn(64, undefined, 'pad0:64', { filter_resonance: 20, filter_type: 'bandpass' })

  const [low, band] = voiceFilters(nodes)
  expect([low?.type, low?.Q.value]).toStrictEqual(['lowpass', 20]) // dB
  expect([band?.type, band?.Q.value]).toStrictEqual(['bandpass', 10]) // 20 dB as a ratio
})

test('sounding notes switch to a new filter type', () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth(null, () => ctx)
  synth.noteOn(60)
  synth.setParams({ filter_type: 'highpass' })

  const filter = nodes.find((n) => n.kind === 'filter')
  expect(filter?.type).toBe('highpass')
  expect(filter?.Q.setTargetAtTime).toHaveBeenLastCalledWith(4, 0, 0.01)
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
  synth.noteOn(69) // the keyboard: from the chord's nearest note, G4

  expect([0, 1, 2, 3].map((n) => glideOf(nodes, n))).toStrictEqual([null, null, null, null])
  expect(glideOf(nodes, 4)).toStrictEqual([392, 440, 0.1])

  const off = fakeAudio()
  const plain = createSynth({ glide: 0 }, () => off.ctx)
  plain.noteOn(60)
  plain.noteOn(67)
  expect(glideOf(off.nodes, 1)).toBe(null)
})

test('a chord glides voice by voice, each note from the nearest note of the last chord', () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth({ glide: 0.1, glide_mode: 'always' }, () => ctx)
  for (const midi of [60, 64, 67]) synth.noteOn(midi) // C major
  clock.currentTime = 0.5
  for (const midi of [60, 65, 69]) synth.noteOn(midi) // F major over C

  expect(glideOf(nodes, 3)).toBe(null) // C stays put
  expect(glideOf(nodes, 4)).toStrictEqual([330, 349, 0.1]) // E -> F
  expect(glideOf(nodes, 5)).toStrictEqual([392, 440, 0.1]) // G -> A
})

test("each sound plays through its own effects, the live controls' and each loop's, following their settings and the tempo", () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth({ fx_delay_mix: 0.4, fx_delay_time: '1/4' }, () => ctx)
  synth.setTempo(120)
  synth.noteOn(60)
  const own = { fx_crush: 1, fx_reverb_mix: 0.5 }
  synth.noteOn(64, 0, 'pad0:64', own)
  synth.noteOn(67, 0, 'pad0:67', own)

  // The node a node feeds first (a graph walk, so params are skipped).
  const next = (n: FakeNode | undefined, i = 0) => {
    const out = n?.outputs[i]
    return out && 'outputs' in out ? out : undefined
  }
  // A voice's filter -> amp -> tremolo -> its sound's effects.
  const fxOf = (filter: FakeNode | undefined) => next(next(next(filter)))
  const [live, pad, pad2] = voiceFilters(nodes).map(fxOf)
  expect(pad2).toBe(pad) // one per sound, shared by its notes
  expect(live).not.toBe(pad)

  // input -> crusher, which feeds the dry path, the echo and the reverb.
  const liveCrush = next(live)
  const padCrush = next(pad)
  expect(liveCrush?.curve).toBe(null) // off
  expect(new Set(padCrush?.curve).size).toBe(5) // 2-bit
  const [, liveEcho, liveRoom] = liveCrush?.outputs ?? []
  const [, padEcho, padRoom] = padCrush?.outputs ?? []
  expect(liveEcho && 'gain' in liveEcho ? liveEcho.gain.value : null).toBe(0.4)
  expect(padEcho && 'gain' in padEcho ? padEcho.gain.value : null).toBe(0) // the default: off
  // The reverb's impulse is only made for a sound whose reverb is up.
  expect(next(liveRoom && 'outputs' in liveRoom ? liveRoom : undefined)?.buffer).toBe(null)
  expect(next(padRoom && 'outputs' in padRoom ? padRoom : undefined)?.buffer).not.toBe(null)

  // A quarter note at 120 BPM, then at 60.
  const line = nodes.find((n) => n.kind === 'delay') as
    (FakeNode & { delayTime: FakeParam }) | undefined
  expect(line?.delayTime.value).toBe(0.5)
  synth.setTempo(60)
  expect(line?.delayTime.setTargetAtTime).toHaveBeenLastCalledWith(1, 0, 0.02)
})

test("a sound's chorus is only built once its mix is up, then follows the sound", () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth(null, () => ctx)
  synth.noteOn(60)
  expect(nodes.filter((n) => n.kind === 'merger')).toStrictEqual([])

  synth.setParams({ fx_chorus_flanger: true, fx_chorus_mix: 0.5 })
  const merger = nodes.find((n) => n.kind === 'merger')
  const mix = merger?.outputs[0]
  const lines = nodes.filter((n) => n.kind === 'delay' && merger && n.outputs.includes(merger))
  if (!mix || !('gain' in mix)) throw new Error('no chorus')
  expect(mix.gain.value).toBe(0.5)
  expect(lines.map((l) => l.delayTime?.value)).toStrictEqual([0.003, 0.003]) // a flanger

  synth.setParams({ fx_chorus_flanger: false, fx_chorus_mix: 0.2 })
  expect(mix.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.2, 0, 0.02)
  expect(lines[0]?.delayTime?.setTargetAtTime).toHaveBeenLastCalledWith(0.015, 0, 0.02)
  expect(nodes.filter((n) => n.kind === 'merger')).toHaveLength(1) // built once
})

test('note bends add to pitch envelopes, detune, glide and vibrato, including the sub', () => {
  const { clock, ctx, nodes } = fakeAudio()
  const synth = createSynth(null, () => ctx)
  synth.noteOn(57, 0, 'pad0:57', { glide: 0.1 })
  clock.currentTime = 1
  const own = { glide: 0.1, osc1_detune: 5, pitch_env_amount: 3, sub_level: 0.5 }
  synth.noteOn(
    69,
    1,
    'pad0:69',
    own,
    1,
    { in: { duration: 0.25, semitones: -2 }, out: { duration: 0.5, semitones: 7 } },
    2
  )
  const [envelope, bend] = nodes.filter((n) => n.kind === 'const')
  const oscs = nodes.filter((n) => n.kind === 'osc').slice(4)
  const [osc1, osc2, , , sub] = oscs
  expect(bend?.outputs).toStrictEqual([osc1?.detune, osc2?.detune, sub?.detune])
  expect(envelope?.offset.setValueAtTime).toHaveBeenCalledWith(300, 1)
  expect(osc1?.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(440, 1.1)
  expect(osc1?.detune.value).toBe(5)
  expect(bend?.offset.setValueAtTime.mock.calls).toStrictEqual([
    [-200, 1],
    [0, 2.5]
  ])
  expect(bend?.offset.linearRampToValueAtTime.mock.calls).toStrictEqual([
    [0, 1.25],
    [700, 3]
  ])
  expect(bend?.start).toHaveBeenCalledWith(1)
  synth.setOwnParams('pad0:', { ...own, lfo2_depth: 30, osc1_detune: 10 })
  expect(osc1?.detune.setTargetAtTime).toHaveBeenCalledWith(10, 1, 0.01)
  const depth = oscs[3]?.outputs[0]
  expect(depth && 'gain' in depth ? depth.gain.setTargetAtTime : undefined).toHaveBeenCalledWith(
    30,
    1,
    0.01
  )
  expect(bend?.offset.cancelScheduledValues).not.toHaveBeenCalled()
  synth.noteOff('pad0:69', 3)
  expect(bend?.stop).toHaveBeenCalledWith(3 + 0.5 + 0.05)
  osc1?.onended?.()
  expect(bend?.outputs).toStrictEqual([])
})

test('short-note bend ramps meet at zero without overwriting the incoming endpoint', () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth(null, () => ctx)
  synth.noteOn(
    60,
    1,
    'pad0:60',
    {},
    1,
    { in: { duration: 2, semitones: -12 }, out: { duration: 6, semitones: 7 } },
    0.5
  )
  const bend = nodes.find((n) => n.kind === 'const')
  expect(bend?.offset.setValueAtTime.mock.calls).toStrictEqual([[-1200, 1]])
  expect(bend?.offset.linearRampToValueAtTime.mock.calls).toStrictEqual([
    [0, 1.125],
    [700, 1.5]
  ])
})

test('single-ended bends stay on pitch outside their ramp; keyboard and zero bends add no source', () => {
  const { ctx, nodes } = fakeAudio()
  const synth = createSynth(null, () => ctx)
  synth.noteOn(60)
  synth.noteOn(62, 0, 'pad0:62', {}, 1, { in: { duration: 1, semitones: 0 } }, 2)
  expect(nodes.filter((n) => n.kind === 'const')).toStrictEqual([])
  synth.noteOn(64, 0, 'pad0:64', {}, 1, { in: { duration: 1, semitones: 2 } }, 2)
  synth.noteOn(67, 0, 'pad0:67', {}, 1, { out: { duration: 0.5, semitones: -12 } }, 2)
  const [into, out] = nodes.filter((n) => n.kind === 'const')
  expect(into?.offset.setValueAtTime.mock.calls).toStrictEqual([[200, 0]])
  expect(into?.offset.linearRampToValueAtTime.mock.calls).toStrictEqual([[0, 1]])
  expect(out?.offset.setValueAtTime.mock.calls).toStrictEqual([
    [0, 0],
    [0, 1.5]
  ])
  expect(out?.offset.linearRampToValueAtTime.mock.calls).toStrictEqual([[-1200, 2]])
})
