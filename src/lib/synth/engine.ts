import type { LfoTarget, SynthParams } from '../types.js'

import { getContext } from '../audio.js'

export const DEFAULT_PARAMS: SynthParams = {
  attack: 0.01,
  decay: 0.3,
  // Filter envelope: sweeps the cutoff by up to `filter_env_amount` octaves
  // (negative sweeps down) with its own ADSR. 0 = off.
  filter_attack: 0.005,
  filter_cutoff: 2400,
  filter_decay: 0.3,
  filter_env_amount: 0,
  filter_release: 0.3,
  filter_resonance: 4,
  filter_sustain: 0,
  // Glide: seconds a new note takes to slide from the last one's pitch (0 = off);
  // 'legato' only slides into a note played while the last one is still held.
  glide: 0,
  glide_mode: 'legato',
  lfo1_depth: 0, // units follow the target (LFO_DEPTH_MAX)
  lfo1_rate: 4,
  lfo1_target: 'filter',
  lfo2_depth: 0,
  lfo2_rate: 5,
  lfo2_target: 'pitch',
  osc1_detune: 0,
  osc1_level: 0.6,
  osc1_octave: 0,
  osc1_wave: 'sawtooth',
  osc2_detune: 7,
  osc2_level: 0.4,
  osc2_octave: -1,
  osc2_wave: 'square',
  release: 0.5,
  sustain: 0.6,
  volume: 0.7
}

// Deepest LFO per target: octaves of cutoff, cents of pitch, share of the level.
export const LFO_DEPTH_MAX: Record<LfoTarget, number> = { amp: 1, filter: 4, pitch: 100 }

const LFOS = [1, 2] as const

const lfoParams = (p: SynthParams, n: 1 | 2) => ({
  depth: p[`lfo${n}_depth`],
  rate: p[`lfo${n}_rate`],
  target: p[`lfo${n}_target`]
})

// How far an LFO swings its target's AudioParam: filter and pitch in cents; amp
// down from full level, so full depth dips to silence.
function lfoSwing(p: SynthParams, n: 1 | 2): number {
  const { depth, target } = lfoParams(p, n)
  return target === 'filter' ? depth * 1200 : target === 'pitch' ? depth : depth / 2
}

// Resting level of the tremolo stage: amp LFOs swing around it, and their
// dips add up (clamped at silence).
function tremLevel(p: SynthParams): number {
  let dip = 0
  for (const n of LFOS) if (lfoParams(p, n).target === 'amp') dip += lfoSwing(p, n)
  return Math.max(0, 1 - dip)
}

const MAX_VOICES = 16 // live playing + up to 8 loops share this pool
const HEADROOM = 0.3
const CHORD = 0.005 // s: notes starting this close together are one chord

// The notes a source last started together (one note, or a chord): where the
// next ones glide from, and when they were let go (Infinity while held).
interface LastNote {
  // Notes started together, in order.
  chord: number[]
  // The previous chord, which this one glides from (empty: no glide).
  from: number[]
  // The chord's last-started note; letting it go sets `off`.
  key: VoiceKey
  off: number
  t0: number
}

// Notes glide only from the same source's last note: the keyboard (numeric
// keys), the arpeggiator and each loop pad ("pad0:60" -> "pad0") glide on their own.
const source = (key: VoiceKey): string =>
  typeof key === 'number' ? 'live' : (key.split(':')[0] ?? key)

export interface Synth {
  allNotesOff(): void
  // Silences scheduled-but-unstarted voices whose key matches.
  cancelPending(match: (key: VoiceKey) => boolean): void
  close(): void
  noteOff(key: VoiceKey, at?: number): void
  noteOn(midi: number, at?: number, key?: VoiceKey, own?: null | Partial<SynthParams>): void
  now(): number
  setParams(p: Partial<SynthParams>): void
}

export type VoiceKey = number | string

interface FilterEnv {
  amount: number
  attack: number
  decay: number
  release: number
  sustain: number
}

interface Voice {
  amp: GainNode
  attack: number
  decay: number
  // The filter envelope this note started with; amount in cents.
  fenv: FilterEnv
  filter: BiquadFilterNode
  g1: GainNode
  g2: GainNode
  key: VoiceKey
  lfos: VoiceLfo[]
  midi: number
  osc1: OscillatorNode
  osc2: OscillatorNode
  own: boolean
  release: number
  srcs: OscillatorNode[]
  sustain: number
  t0: number
  // Tremolo stage after the envelope; the LFO drives its gain when targeting amp.
  trem: GainNode
}

// One of a voice's LFOs: the oscillator, the gain setting its depth, and where
// that gain is connected.
interface VoiceLfo {
  depth: GainNode
  n: 1 | 2
  osc: OscillatorNode
  target: LfoTarget
}

const freq = (midi: number, octave: number): number => 440 * 2 ** ((midi - 69) / 12) * 2 ** octave

// `output` is where the synth plays into (an effects channel); the speakers by default.
export function createSynth(
  initialParams: null | Partial<SynthParams>,
  getCtx: () => BaseAudioContext = getContext,
  output?: () => AudioNode
): Synth {
  let params: SynthParams = { ...DEFAULT_PARAMS, ...initialParams }
  let ctx: BaseAudioContext | null = null
  let master: GainNode | null = null
  const voices = new Map<VoiceKey, Voice>() // key -> voice still held (not yet released)
  const alive = new Set<Voice>() // every voice until its oscillators end, released or not
  // The last note each source played (see `source`), for glide.
  const lastNotes = new Map<string, LastNote>()

  function ensureContext(): { ctx: BaseAudioContext; master: GainNode } {
    ctx = getCtx()
    if (!master) {
      master = ctx.createGain()
      master.gain.value = params.volume
      master.connect(output?.() ?? ctx.destination)
    }
    return { ctx, master }
  }

  // `from` (a MIDI note) slides the pitch from there over `glide` seconds.
  function applyOsc(
    t: number,
    osc: OscillatorNode,
    gain: GainNode,
    n: 1 | 2,
    midi: number,
    smooth: boolean,
    p = params,
    from?: number
  ) {
    osc.type = p[`osc${n}_wave`]
    const f = freq(midi, p[`osc${n}_octave`])
    const d = p[`osc${n}_detune`]
    const l = p[`osc${n}_level`]
    if (smooth) {
      osc.frequency.setTargetAtTime(f, t, 0.01)
      osc.detune.setTargetAtTime(d, t, 0.01)
      gain.gain.setTargetAtTime(l, t, 0.01)
      return
    }
    if (from === undefined) {
      osc.frequency.value = f
    } else {
      osc.frequency.setValueAtTime(freq(from, p[`osc${n}_octave`]), t)
      osc.frequency.exponentialRampToValueAtTime(f, t + p.glide)
    }
    osc.detune.value = d
    gain.gain.value = l
  }

  // Which note a new one glides from, remembering it with the source's last
  // notes. Notes starting together (a chord) glide from the previous chord, each
  // from the nearest of its notes, so the voices move instead of all sliding in
  // from one pitch; they never slide between each other.
  function glideFrom(key: VoiceKey, midi: number, t: number, p: SynthParams): number | undefined {
    const src = source(key)
    const last = lastNotes.get(src)
    let group: LastNote
    if (last && t - last.t0 < CHORD) {
      group = last
      group.chord.push(midi)
      group.key = key
    } else {
      const glides = !!last && (p.glide_mode === 'always' || last.off > t)
      group = { chord: [midi], from: glides ? last.chord : [], key, off: Infinity, t0: t }
      lastNotes.set(src, group)
    }
    let from: number | undefined
    for (const n of group.from) {
      if (from === undefined || Math.abs(n - midi) < Math.abs(from - midi)) from = n
    }
    return p.glide > 0 && from !== midi ? from : undefined
  }

  // Envelope level at time t (the amp's, or the filter's with `env`), computed
  // from the voice's start so releases can be scheduled in the future (the
  // looper) without reading the param's value.
  function envAt(
    v: Voice,
    t: number,
    env: Pick<Voice, 'attack' | 'decay' | 'sustain'> = v
  ): number {
    const x = t - v.t0
    if (x <= 0) return 0
    if (x < env.attack) return x / env.attack
    if (x < env.attack + env.decay) return 1 + (env.sustain - 1) * ((x - env.attack) / env.decay)
    return env.sustain
  }

  // Points one of the voice's LFOs at `target`.
  function routeLfo(v: Voice, lfo: VoiceLfo, target: LfoTarget) {
    lfo.depth.disconnect()
    lfo.target = target
    if (target === 'filter') lfo.depth.connect(v.filter.detune)
    else if (target === 'amp') lfo.depth.connect(v.trem.gain)
    else {
      lfo.depth.connect(v.osc1.detune)
      lfo.depth.connect(v.osc2.detune)
    }
  }

  // `time` defaults to the voice's own release (its params may differ from the live ones).
  function release(key: VoiceKey, time: number | undefined, at: number) {
    const v = voices.get(key)
    if (!v || !ctx) return
    voices.delete(key)
    time ??= v.own ? v.release : params.release
    const t = Math.max(at, ctx.currentTime)
    const g = v.amp.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(HEADROOM * envAt(v, t), t)
    g.linearRampToValueAtTime(0, t + time)
    if (v.fenv.amount) {
      const d = v.filter.detune
      d.cancelScheduledValues(t)
      d.setValueAtTime(v.fenv.amount * envAt(v, t, v.fenv), t)
      d.linearRampToValueAtTime(0, t + v.fenv.release)
    }
    for (const s of v.srcs) s.stop(t + time + 0.05)
  }

  // `at` is an AudioContext time (defaults to now); `key` lets loop voices coexist
  // with live ones on the same pitch; `own` pins the voice to its own params (a
  // recorded loop's sound) instead of following the live controls. Master volume
  // stays global.
  function noteOn(
    midi: number,
    at?: number,
    key: VoiceKey = midi,
    own: null | Partial<SynthParams> = null
  ): void {
    const { ctx, master } = ensureContext()
    const p = own ? { ...DEFAULT_PARAMS, ...own } : params
    const t = Math.max(at ?? 0, ctx.currentTime)
    if (voices.has(key)) release(key, undefined, t)
    const oldest = voices.keys().next()
    if (voices.size >= MAX_VOICES && !oldest.done) release(oldest.value, 0.01, ctx.currentTime)

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const g1 = ctx.createGain()
    const g2 = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const amp = ctx.createGain()
    // Per-voice LFOs so each note's wobble starts from the same phase.
    const lfos = LFOS.map((n): VoiceLfo => {
      const osc = ctx.createOscillator()
      const depth = ctx.createGain()
      osc.frequency.value = lfoParams(p, n).rate
      depth.gain.value = lfoSwing(p, n)
      osc.connect(depth)
      return { depth, n, osc, target: lfoParams(p, n).target }
    })
    const trem = ctx.createGain()

    const from = glideFrom(key, midi, t, p)
    applyOsc(t, osc1, g1, 1, midi, false, p, from)
    applyOsc(t, osc2, g2, 2, midi, false, p, from)
    filter.type = 'lowpass'
    filter.frequency.value = p.filter_cutoff
    filter.Q.value = p.filter_resonance

    osc1.connect(g1).connect(filter)
    osc2.connect(g2).connect(filter)
    filter.connect(amp).connect(trem).connect(master)
    trem.gain.value = tremLevel(p)

    const { attack, decay, sustain } = p
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(HEADROOM, t + attack)
    amp.gain.linearRampToValueAtTime(HEADROOM * sustain, t + attack + decay)

    // The filter envelope moves the cutoff's detune; a filter LFO adds on top.
    const fenv: FilterEnv = {
      amount: p.filter_env_amount * 1200,
      attack: p.filter_attack,
      decay: p.filter_decay,
      release: p.filter_release,
      sustain: p.filter_sustain
    }
    if (fenv.amount) {
      filter.detune.setValueAtTime(0, t)
      filter.detune.linearRampToValueAtTime(fenv.amount, t + fenv.attack)
      filter.detune.linearRampToValueAtTime(
        fenv.amount * fenv.sustain,
        t + fenv.attack + fenv.decay
      )
    }

    const srcs = [osc1, osc2, ...lfos.map((l) => l.osc)]
    const v: Voice = {
      amp,
      attack,
      decay,
      fenv,
      filter,
      g1,
      g2,
      key,
      lfos,
      midi,
      osc1,
      osc2,
      own: !!own,
      release: p.release,
      srcs,
      sustain,
      t0: t,
      trem
    }
    for (const lfo of lfos) routeLfo(v, lfo, lfo.target)
    osc1.onended = () => {
      alive.delete(v)
      ;[...srcs, g1, g2, filter, amp, trem, ...lfos.map((l) => l.depth)].forEach((n) =>
        n.disconnect()
      )
    }
    for (const s of srcs) s.start(t)

    alive.add(v)
    voices.set(key, v)
  }

  function noteOff(key: VoiceKey, at?: number): void {
    if (!ctx) return
    const t = Math.max(at ?? ctx.currentTime, ctx.currentTime)
    const last = lastNotes.get(source(key))
    if (last?.key === key) last.off = t
    release(key, undefined, t)
  }

  function allNotesOff(): void {
    for (const key of [...voices.keys()]) noteOff(key)
  }

  // Silence voices matching `match(key)` that are scheduled but haven't started yet,
  // even if their release is already scheduled. Started voices are left alone.
  function cancelPending(match: (key: VoiceKey) => boolean): void {
    if (!ctx) return
    for (const v of alive) {
      if (v.t0 <= ctx.currentTime || !match(v.key)) continue
      if (voices.get(v.key) === v) voices.delete(v.key)
      v.amp.disconnect()
      for (const s of v.srcs) s.stop(v.t0)
    }
  }

  function now(): number {
    return ensureContext().ctx.currentTime
  }

  function setParams(p: Partial<SynthParams>): void {
    params = { ...params, ...p }
    if (!ctx || !master) return
    const t = ctx.currentTime
    master.gain.setTargetAtTime(params.volume, t, 0.01)
    for (const v of voices.values()) {
      if (v.own) continue
      v.filter.frequency.setTargetAtTime(params.filter_cutoff, t, 0.01)
      v.filter.Q.setTargetAtTime(params.filter_resonance, t, 0.01)
      for (const lfo of v.lfos) {
        const { rate, target } = lfoParams(params, lfo.n)
        if (lfo.target !== target) routeLfo(v, lfo, target)
        lfo.osc.frequency.setTargetAtTime(rate, t, 0.01)
        lfo.depth.gain.setTargetAtTime(lfoSwing(params, lfo.n), t, 0.01)
      }
      v.trem.gain.setTargetAtTime(tremLevel(params), t, 0.01)
      applyOsc(t, v.osc1, v.g1, 1, v.midi, true)
      applyOsc(t, v.osc2, v.g2, 2, v.midi, true)
    }
  }

  // Detach from the shared AudioContext (it outlives this component).
  function close(): void {
    master?.disconnect()
    master = null
    ctx = null
    voices.clear()
    alive.clear()
  }

  return { allNotesOff, cancelPending, close, noteOff, noteOn, now, setParams }
}
