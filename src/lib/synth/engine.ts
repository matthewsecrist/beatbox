import type { LfoTarget, SynthParams } from '../types.js'

import { getContext } from '../audio.js'

export const DEFAULT_PARAMS: SynthParams = {
  attack: 0.01,
  decay: 0.3,
  filter_cutoff: 2400,
  filter_resonance: 4,
  lfo_depth: 0, // units follow the target (LFO_DEPTH_MAX)
  lfo_rate: 4,
  lfo_target: 'filter',
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

// How far the LFO swings its target's AudioParam: filter and pitch in cents;
// amp around a level of 1 - depth / 2, so full depth dips to silence.
const lfoSwing = (p: SynthParams): number =>
  p.lfo_target === 'filter'
    ? p.lfo_depth * 1200
    : p.lfo_target === 'pitch'
      ? p.lfo_depth
      : p.lfo_depth / 2
const tremLevel = (p: SynthParams): number => (p.lfo_target === 'amp' ? 1 - p.lfo_depth / 2 : 1)

const MAX_VOICES = 16 // live playing + up to 8 loops share this pool
const HEADROOM = 0.3

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

interface Voice {
  amp: GainNode
  attack: number
  decay: number
  filter: BiquadFilterNode
  g1: GainNode
  g2: GainNode
  key: VoiceKey
  lfo: OscillatorNode
  lfoDepth: GainNode
  lfoTarget: LfoTarget
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

const freq = (midi: number, octave: number): number => 440 * 2 ** ((midi - 69) / 12) * 2 ** octave

export function createSynth(
  initialParams: null | Partial<SynthParams>,
  getCtx: () => BaseAudioContext = getContext
): Synth {
  let params: SynthParams = { ...DEFAULT_PARAMS, ...initialParams }
  let ctx: BaseAudioContext | null = null
  let master: GainNode | null = null
  const voices = new Map<VoiceKey, Voice>() // key -> voice still held (not yet released)
  const alive = new Set<Voice>() // every voice until its oscillators end, released or not

  function ensureContext(): { ctx: BaseAudioContext; master: GainNode } {
    ctx = getCtx()
    if (!master) {
      master = ctx.createGain()
      master.gain.value = params.volume
      master.connect(ctx.destination)
    }
    return { ctx, master }
  }

  function applyOsc(
    t: number,
    osc: OscillatorNode,
    gain: GainNode,
    n: 1 | 2,
    midi: number,
    smooth: boolean,
    p = params
  ) {
    osc.type = p[`osc${n}_wave`]
    const f = freq(midi, p[`osc${n}_octave`])
    const d = p[`osc${n}_detune`]
    const l = p[`osc${n}_level`]
    if (smooth) {
      osc.frequency.setTargetAtTime(f, t, 0.01)
      osc.detune.setTargetAtTime(d, t, 0.01)
      gain.gain.setTargetAtTime(l, t, 0.01)
    } else {
      osc.frequency.value = f
      osc.detune.value = d
      gain.gain.value = l
    }
  }

  // Envelope level at time t, computed from the voice's start so releases can be
  // scheduled in the future (the looper) without reading gain.value.
  function envAt(v: Voice, t: number): number {
    const x = t - v.t0
    if (x <= 0) return 0
    if (x < v.attack) return (HEADROOM * x) / v.attack
    if (x < v.attack + v.decay)
      return HEADROOM + (HEADROOM * v.sustain - HEADROOM) * ((x - v.attack) / v.decay)
    return HEADROOM * v.sustain
  }

  // Points the voice's LFO at `target`.
  function routeLfo(v: Voice, target: LfoTarget) {
    v.lfoDepth.disconnect()
    v.lfoTarget = target
    if (target === 'filter') v.lfoDepth.connect(v.filter.detune)
    else if (target === 'amp') v.lfoDepth.connect(v.trem.gain)
    else {
      v.lfoDepth.connect(v.osc1.detune)
      v.lfoDepth.connect(v.osc2.detune)
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
    g.setValueAtTime(envAt(v, t), t)
    g.linearRampToValueAtTime(0, t + time)
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
    // Per-voice LFO so each note's wobble starts from the same phase.
    const lfo = ctx.createOscillator()
    const lfoDepth = ctx.createGain()
    const trem = ctx.createGain()

    applyOsc(t, osc1, g1, 1, midi, false, p)
    applyOsc(t, osc2, g2, 2, midi, false, p)
    filter.type = 'lowpass'
    filter.frequency.value = p.filter_cutoff
    filter.Q.value = p.filter_resonance

    osc1.connect(g1).connect(filter)
    osc2.connect(g2).connect(filter)
    filter.connect(amp).connect(trem).connect(master)
    lfo.frequency.value = p.lfo_rate
    lfoDepth.gain.value = lfoSwing(p)
    trem.gain.value = tremLevel(p)
    lfo.connect(lfoDepth)

    const { attack, decay, sustain } = p
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(HEADROOM, t + attack)
    amp.gain.linearRampToValueAtTime(HEADROOM * sustain, t + attack + decay)

    const srcs = [osc1, osc2, lfo]
    const v: Voice = {
      amp,
      attack,
      decay,
      filter,
      g1,
      g2,
      key,
      lfo,
      lfoDepth,
      lfoTarget: p.lfo_target,
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
    routeLfo(v, p.lfo_target)
    osc1.onended = () => {
      alive.delete(v)
      ;[...srcs, g1, g2, filter, amp, trem, lfoDepth].forEach((n) => n.disconnect())
    }
    for (const s of srcs) s.start(t)

    alive.add(v)
    voices.set(key, v)
  }

  function noteOff(key: VoiceKey, at?: number): void {
    if (ctx) release(key, undefined, at ?? ctx.currentTime)
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
      v.lfo.frequency.setTargetAtTime(params.lfo_rate, t, 0.01)
      if (v.lfoTarget !== params.lfo_target) routeLfo(v, params.lfo_target)
      v.lfoDepth.gain.setTargetAtTime(lfoSwing(params), t, 0.01)
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
