import type { DriveType, LfoNote, LfoTarget, NoteBend, Ramp, SynthParams, Wave } from '../types.js'

import {
  type Chorus,
  createChorus,
  createCrusher,
  type Crusher,
  getContext,
  noiseBuffer,
  rampThrough,
  settle
} from '../audio.js'
import { DAMPING, DELAY_BEATS, impulse, MAX_DELAY } from '../effects.js'
import { bendDurations } from './notes.js'
import { createPluck, type PluckSource, preparePluck } from './pluck.js'

export const DEFAULT_PARAMS: SynthParams = {
  attack: 0.01,
  decay: 0.3,
  drive: 0,
  drive_mix: 1,
  drive_type: 'soft',
  // Filter envelope: sweeps the cutoff by up to `filter_env_amount` octaves
  // (negative sweeps down) with its own ADSR. 0 = off.
  filter_attack: 0.005,
  filter_cutoff: 2400,
  filter_decay: 0.3,
  filter_env_amount: 0,
  filter_release: 0.3,
  filter_resonance: 4,
  filter_sustain: 0,
  filter_type: 'lowpass',
  // How much a note's velocity scales its filter envelope, 0-1 (0: not at all).
  filter_velocity: 0,
  // The sound's own effects, all off: chorus, bitcrusher, echo and reverb.
  fx_chorus_depth: 0.5,
  fx_chorus_flanger: false,
  fx_chorus_mix: 0,
  fx_chorus_rate: 0.8,
  fx_crush: 0,
  fx_delay_feedback: 0.35,
  fx_delay_mix: 0,
  fx_delay_time: '1/8d',
  fx_reverb_mix: 0,
  fx_reverb_size: 2,
  // Glide: seconds a new note takes to slide from the last one's pitch (0 = off);
  // 'legato' only slides into a note played while the last one is still held.
  glide: 0,
  glide_mode: 'legato',
  lfo1_depth: 0, // units follow the target (LFO_DEPTH_MAX)
  lfo1_note: '1/4', // one cycle per beat when synced
  lfo1_rate: 4,
  lfo1_sync: false,
  lfo1_target: 'filter',
  lfo2_depth: 0,
  lfo2_note: '1/4',
  lfo2_rate: 5,
  lfo2_sync: false,
  lfo2_target: 'pitch',
  // Extra sources, 0 = off: white noise, and a sine one octave below osc 1.
  noise_level: 0,
  osc1_detune: 0,
  osc1_level: 0.6,
  osc1_octave: 0,
  osc1_wave: 'sawtooth',
  osc2_detune: 7,
  osc2_level: 0.4,
  osc2_octave: -1,
  osc2_wave: 'square',
  // Pitch envelope: semitones each note starts off by (0 = off), and seconds
  // to fall back to its pitch.
  pitch_env_amount: 0,
  pitch_env_decay: 0.1,
  pluck_brightness: 0.5,
  pluck_decay: 2,
  release: 0.5,
  sound_mode: 'synth',
  sub_level: 0,
  sustain: 0.6,
  volume: 0.7
}

// Deepest LFO per target: octaves of cutoff, cents of pitch, share of the level.
export const LFO_DEPTH_MAX: Record<LfoTarget, number> = { amp: 1, filter: 4, pitch: 100 }

// Synced LFO note values, slowest first.
export const LFO_NOTES: LfoNote[] = [1, 2, 4, 8, 16, 32].flatMap((d) => [
  `1/${d}d` as LfoNote,
  `1/${d}` as LfoNote,
  `1/${d}t` as LfoNote
])

// A note value's length in beats (quarter notes): 1/1 is four, dotted is half as
// long again, a triplet two thirds as long.
export function noteBeats(note: LfoNote): number {
  const straight = 4 / Number(note.slice(2).replace(/[dt]$/, ''))
  return note.endsWith('d') ? straight * 1.5 : note.endsWith('t') ? (straight * 2) / 3 : straight
}

const LFOS = [1, 2] as const

// `beats` is the synced cycle length, null when the LFO runs free at `rate` Hz.
const lfoParams = (p: SynthParams, n: 1 | 2) => ({
  beats: p[`lfo${n}_sync`] ? noteBeats(p[`lfo${n}_note`]) : null,
  depth: p[`lfo${n}_depth`],
  rate: p[`lfo${n}_rate`],
  target: p[`lfo${n}_target`]
})

// An LFO's speed in Hz: free, or one cycle per `beats` at `bpm`.
const lfoHz = (rate: number, beats: null | number, bpm: number): number =>
  beats === null ? rate : bpm / 60 / beats

// Resonance is in dB, as low- and high-pass filters take their Q; band-pass and
// notch take Q as a plain ratio (how narrow the band is), so it's converted and
// the slider feels the same for every type.
function filterQ(p: SynthParams): number {
  const r = p.filter_resonance
  return p.filter_type === 'lowpass' || p.filter_type === 'highpass' ? r : 10 ** (r / 20)
}

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

const chorusOf = (p: SynthParams) => ({
  depth: p.fx_chorus_depth,
  flanger: p.fx_chorus_flanger,
  rate: p.fx_chorus_rate
})

const MAX_VOICES = 16 // live playing + up to 8 loops share this pool
const HEADROOM = 0.3
const CHORD = 0.005 // s: notes starting this close together are one chord

// A sound's own effects (the `fx_*` params), shared by the voices playing it:
// in -> crusher -> master, and from the crusher into a chorus, an echo and a
// reverb at their mixes. Each echo comes back a little darker, as the song's delay does.
// The chorus (and its LFO) and the reverb's impulse are only made once their mix is up.
interface SoundFx {
  // The chorus, then the gain blending it in.
  chorus: null | { mix: GainNode; unit: Chorus }
  crush: Crusher
  delay: DelayNode
  delaySend: GainNode
  feedback: GainNode
  input: GainNode
  // The params it was last set to (for the delay time when the tempo changes).
  p: SynthParams
  reverb: ConvolverNode
  reverbSend: GainNode
  // The size the reverb's impulse was made for; 0 before it's made.
  size: number
}

// Drive: the oscillators are scaled so their loudest possible peak sits at 1, pushed
// up by as much as DRIVE_MAX and bent by the character's curve, then scaled back.
// Every curve is a straight line up to 1, so drive 0 leaves the sound as it was;
// past 1 each bends its own way, and the harder a note is pushed the more it
// changes. A clean copy runs alongside for `drive_mix`. The filter after both can
// then tame the fizz.
const DRIVE_MAX = 40
// 100 points per unit, so ±1 (where every curve starts to bend) falls exactly on
// a point and the straight part stays exactly straight between them.
const CURVE_SIZE = DRIVE_MAX * 200 + 1

// Past 1, rounds off smoothly towards 1 + `bend`.
function round(x: number, bend: number): number {
  const over = Math.abs(x) - 1
  return over <= 0 ? x : Math.sign(x) * (1 + bend * Math.tanh(over / bend))
}

const DRIVE_SHAPES: Record<DriveType, (x: number) => number> = {
  // Folds back and forth between -1 and 1 (a triangle wave over x).
  fold: (x) => {
    const t = (((x + 1) % 4) + 4) % 4
    return t < 2 ? t - 1 : 3 - t
  },
  hard: (x) => Math.max(-1, Math.min(1, x)),
  soft: (x) => round(x, 0.5),
  // The top rounds off gently and the bottom sooner: the lopsided wave adds the
  // even harmonics that make a valve amp sound warm.
  tube: (x) => round(x, x > 0 ? 0.5 : 0.15)
}

const curves = new Map<DriveType, Float32Array<ArrayBuffer>>()

// The character's curve over inputs from -DRIVE_MAX to DRIVE_MAX (the shaper's -1..1).
function curve(type: DriveType): Float32Array<ArrayBuffer> {
  let c = curves.get(type)
  if (!c) {
    c = new Float32Array(CURVE_SIZE)
    for (let i = 0; i < CURVE_SIZE; i++) {
      c[i] = DRIVE_SHAPES[type](((2 * i) / (CURVE_SIZE - 1) - 1) * DRIVE_MAX)
    }
    curves.set(type, c)
  }
  return c
}

// The clean copy's curve: a straight line, there only so the clean copy goes
// through the same oversampling (and delay) as the driven one and lines up with it.
const STRAIGHT = new Float32Array([-1, 1])

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

// Gains around the curves: `level` sets the sources' loudest peak at 1, `push`
// drives them into the curve, and `wet`/`dry` set the driven and clean copies'
// share. `wet` brings the driven copy's loudest peak back to where it was clean.
// Pushed into soft, tube or hard, a note becomes a fuller, squarer wave, so it also
// comes down a little more (push ** -0.1, about 3 dB at full drive) to stay about as
// loud as the clean sound; fold doesn't fill out, so it doesn't.
function driveGains(
  p: SynthParams,
  soundMode: SynthParams['sound_mode']
): { dry: number; level: number; push: number; wet: number } {
  const peak =
    soundMode === 'pluck'
      ? 1
      : Math.max(p.osc1_level + p.osc2_level + p.sub_level + p.noise_level, 0.01)
  const push = DRIVE_MAX ** p.drive
  const shape = DRIVE_SHAPES[p.drive_type]
  const top = Math.max(1, Math.abs(shape(push)), Math.abs(shape(-push)))
  const fuller = p.drive_type === 'fold' ? 1 : push ** -0.1
  return {
    dry: peak * (1 - p.drive_mix),
    level: 1 / peak,
    push: push / DRIVE_MAX,
    wet: (peak * p.drive_mix * fuller) / top
  }
}

// Below anything audible: clears the offset tube's lopsided wave leaves, which
// would otherwise thump as each note starts and stops. It follows both copies, so
// they stay lined up with each other.
const DC_BLOCK = 5 // Hz

// A voice's drive stage: level -> push -> shaper -> wet, and level -> straight ->
// dry alongside it, both through dc into the filter.
interface DriveStage {
  dc: BiquadFilterNode
  dry: GainNode
  level: GainNode
  push: GainNode
  shaper: WaveShaperNode
  straight: WaveShaperNode
  type: DriveType
  wet: GainNode
}

function createDrive(ctx: BaseAudioContext, p: SynthParams, into: AudioNode): DriveStage {
  const stage: DriveStage = {
    dc: ctx.createBiquadFilter(),
    dry: ctx.createGain(),
    level: ctx.createGain(),
    push: ctx.createGain(),
    shaper: ctx.createWaveShaper(),
    straight: ctx.createWaveShaper(),
    type: p.drive_type,
    wet: ctx.createGain()
  }
  stage.shaper.curve = curve(p.drive_type)
  stage.straight.curve = STRAIGHT
  // Keeps the added harmonics from folding back as hiss.
  stage.shaper.oversample = stage.straight.oversample = '4x'
  stage.dc.type = 'highpass'
  stage.dc.frequency.value = DC_BLOCK
  stage.dc.Q.value = 0 // no bump at the corner
  stage.level.connect(stage.push).connect(stage.shaper).connect(stage.wet).connect(stage.dc)
  stage.level.connect(stage.straight).connect(stage.dry).connect(stage.dc)
  stage.dc.connect(into)
  const g = driveGains(p, p.sound_mode)
  for (const k of ['dry', 'level', 'push', 'wet'] as const) stage[k].gain.value = g[k]
  return stage
}

// Follows changed params on a sounding voice, gliding the gains so it doesn't click.
function updateDrive(
  stage: DriveStage,
  p: SynthParams,
  t: number,
  soundMode: SynthParams['sound_mode']
): void {
  if (stage.type !== p.drive_type) {
    stage.type = p.drive_type
    stage.shaper.curve = curve(p.drive_type)
  }
  const g = driveGains(p, soundMode)
  for (const k of ['dry', 'level', 'push', 'wet'] as const) {
    stage[k].gain.setTargetAtTime(g[k], t, 0.01)
  }
}

// Notes glide only from the same source's last note: the keyboard (numeric
// keys), the arpeggiator and each loop pad ("pad0:60" -> "pad0") glide on their own.
const source = (key: VoiceKey): string =>
  typeof key === 'number' ? 'live' : (key.split(':')[0] ?? key)

// Which sound's effects a voice plays through: a loop's own (by its source),
// or the live controls' for every voice that follows them.
const fxName = (key: VoiceKey, own: unknown): string => (own ? source(key) : 'live')

export interface Synth {
  allNotesOff(): void
  // Arranger automation: shifts every note's cutoff (octaves) along `ramp` from
  // audio time t0 to t1; null puts it back to none at t0.
  automateFilter(ramp: null | Ramp, t0: number, t1: number): void
  // Silences scheduled-but-unstarted voices whose key matches.
  cancelPending(match: (key: VoiceKey) => boolean): void
  close(): void
  noteOff(key: VoiceKey, at?: number): void
  // `velocity` (0-1) scales the note's level, and its filter envelope by `filter_velocity`.
  // Optional per-note bend; here its durations and the note's length are SECONDS.
  noteOn(
    midi: number,
    at?: number,
    key?: VoiceKey,
    own?: null | Partial<SynthParams>,
    velocity?: number,
    bend?: NoteBend,
    duration?: number
  ): void
  now(): number
  // Load the plucked-string processor before enabling notes or starting a player.
  ready(): Promise<void>
  // A loop's changed sound, for its voices already sounding (keys starting `prefix`).
  setOwnParams(prefix: string, own: Partial<SynthParams>): void
  setParams(p: Partial<SynthParams>): void
  // The tempo playing, for synced LFOs (sounding notes follow it).
  setTempo(bpm: number): void
  // The song stopped: any cutoff shift glides back to none now.
  stopAutomation(): void
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
  cleanup(): void
  decay: number
  // Drive stage between the oscillators and the filter (see driveGains).
  drive: DriveStage
  // The filter envelope this note started with; amount in cents.
  fenv: FilterEnv
  filter: BiquadFilterNode
  g1: GainNode | null
  g2: GainNode | null
  key: VoiceKey
  lfos: VoiceLfo[]
  midi: number
  // The noise's level; null when the note started without noise.
  noise: GainNode | null
  osc1: null | OscillatorNode
  osc2: null | OscillatorNode
  own: boolean
  // The envelope's peak level: HEADROOM scaled by the note's velocity.
  peak: number
  pluck: null | PluckSource
  release: number
  srcs: AudioScheduledSourceNode[]
  // The sub oscillator and its level; null when the note started without one.
  sub: null | { gain: GainNode; osc: OscillatorNode }
  sustain: number
  t0: number
  // Tremolo stage after the envelope; the LFO drives its gain when targeting amp.
  trem: GainNode
}

// One of a voice's LFOs: the oscillator, the gain setting its depth, and where
// that gain is connected.
interface VoiceLfo {
  // Synced cycle length in beats; null while running free.
  beats: null | number
  depth: GainNode
  n: 1 | 2
  osc: OscillatorNode
  target: LfoTarget
}

const freq = (midi: number, octave: number): number => 440 * 2 ** ((midi - 69) / 12) * 2 ** octave

// An oscillator's settings: osc 1 or 2's own, or the sub's (a sine an octave
// below osc 1, detuned with it).
type OscId = 1 | 2 | 'sub'
// `output` is where the synth plays into (an effects channel); the speakers by default.
export function createSynth(
  initialParams: null | Partial<SynthParams>,
  getCtx: () => BaseAudioContext = getContext,
  output?: () => AudioNode
): Synth {
  let params: SynthParams = { ...DEFAULT_PARAMS, ...initialParams }
  let bpm = 110
  let ctx: BaseAudioContext | null = null
  let master: GainNode | null = null
  const voices = new Map<VoiceKey, Voice>() // key -> voice still held (not yet released)
  const alive = new Set<Voice>() // every voice until its oscillators end, released or not
  // The last note each source played (see `source`), for glide.
  const lastNotes = new Map<string, LastNote>()
  // The arranger's cutoff shift (cents) on every note's filter; made on first use.
  let shift: ConstantSourceNode | null = null
  // Each sound's effects, by fxName; made on its first note.
  const fxs = new Map<string, SoundFx>()

  function ensureContext(): { ctx: BaseAudioContext; master: GainNode } {
    ctx = getCtx()
    if (!master) {
      master = ctx.createGain()
      master.gain.value = params.volume
      master.connect(output?.() ?? ctx.destination)
    }
    return { ctx, master }
  }

  // A sound's effects, made the first time one of its notes plays.
  function soundFx(name: string, p: SynthParams): SoundFx {
    const existing = fxs.get(name)
    if (existing) return existing
    const { ctx, master } = ensureContext()
    const input = ctx.createGain()
    const crush = createCrusher(ctx, p.fx_crush)
    const delaySend = ctx.createGain()
    const delay = ctx.createDelay(MAX_DELAY)
    const damping = ctx.createBiquadFilter()
    damping.type = 'lowpass'
    damping.frequency.value = DAMPING
    const feedback = ctx.createGain()
    const reverbSend = ctx.createGain()
    const reverb = ctx.createConvolver()
    input.connect(crush.node).connect(master)
    crush.node.connect(delaySend).connect(delay).connect(damping).connect(feedback).connect(delay)
    damping.connect(master)
    crush.node.connect(reverbSend).connect(reverb).connect(master)
    const fx: SoundFx = {
      chorus: null,
      crush,
      delay,
      delaySend,
      feedback,
      input,
      p,
      reverb,
      reverbSend,
      size: 0
    }
    applyFx(fx, p, true)
    fxs.set(name, fx)
    return fx
  }

  // Brings a sound's effects in line with `p`; `now` sets them outright (just made).
  function applyFx(fx: SoundFx, p: SynthParams, now = false) {
    if (!ctx) return
    const t = ctx.currentTime
    const to = (param: AudioParam, value: number) => {
      if (now) param.value = value
      else param.setTargetAtTime(value, t, 0.02)
    }
    fx.p = p
    fx.crush.set(p.fx_crush)
    if (p.fx_chorus_mix > 0 && !fx.chorus) {
      const unit = createChorus(ctx, chorusOf(p))
      const mix = ctx.createGain()
      fx.crush.node.connect(unit.input)
      unit.output.connect(mix).connect(ensureContext().master)
      fx.chorus = { mix, unit }
      mix.gain.value = p.fx_chorus_mix
    } else if (fx.chorus) {
      fx.chorus.unit.set(chorusOf(p), now)
      to(fx.chorus.mix.gain, p.fx_chorus_mix)
    }
    to(fx.delaySend.gain, p.fx_delay_mix)
    to(fx.feedback.gain, p.fx_delay_feedback)
    to(fx.delay.delayTime, Math.min(MAX_DELAY, (DELAY_BEATS[p.fx_delay_time] * 60) / bpm))
    to(fx.reverbSend.gain, p.fx_reverb_mix)
    if (p.fx_reverb_mix > 0 && fx.size !== p.fx_reverb_size) {
      fx.size = p.fx_reverb_size
      fx.reverb.buffer = impulse(ctx, fx.size)
    }
  }

  // `from` (a MIDI note) slides the pitch from there over `glide` seconds.
  function applyOsc(
    t: number,
    osc: OscillatorNode,
    gain: GainNode,
    n: OscId,
    midi: number,
    smooth: boolean,
    p = params,
    from?: number
  ) {
    const { detune, level, octave, wave } = oscSpec(p, n)
    osc.type = wave
    const f = freq(midi, octave)
    if (smooth) {
      osc.frequency.setTargetAtTime(f, t, 0.01)
      osc.detune.setTargetAtTime(detune, t, 0.01)
      gain.gain.setTargetAtTime(level, t, 0.01)
      return
    }
    if (from === undefined) {
      osc.frequency.value = f
    } else {
      osc.frequency.setValueAtTime(freq(from, octave), t)
      osc.frequency.exponentialRampToValueAtTime(f, t + p.glide)
    }
    osc.detune.value = detune
    gain.gain.value = level
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
      if (v.pluck) lfo.depth.connect(v.pluck.detune)
      if (v.osc1) lfo.depth.connect(v.osc1.detune)
      if (v.osc2) lfo.depth.connect(v.osc2.detune)
      if (v.sub) lfo.depth.connect(v.sub.osc.detune)
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
    g.setValueAtTime(v.peak * envAt(v, t), t)
    g.linearRampToValueAtTime(0, t + time)
    if (v.fenv.amount) {
      const d = v.filter.detune
      d.cancelScheduledValues(t)
      d.setValueAtTime(v.fenv.amount * envAt(v, t, v.fenv), t)
      d.linearRampToValueAtTime(0, t + v.fenv.release)
    }
    for (const s of v.srcs) s.stop(t + time + 0.05)
    v.pluck?.stop(t + time + 0.05)
  }

  // `at` is an AudioContext time (defaults to now); `key` lets loop voices coexist
  // with live ones on the same pitch; `own` pins the voice to its own params (a
  // recorded loop's sound) instead of following the live controls. Master volume
  // stays global. `velocity` is how hard the note is played, 0-1.
  function noteOn(
    midi: number,
    at?: number,
    key: VoiceKey = midi,
    own: null | Partial<SynthParams> = null,
    velocity = 1,
    bend?: NoteBend,
    duration?: number
  ): void {
    const { ctx } = ensureContext()
    const p = own ? { ...DEFAULT_PARAMS, ...own } : params
    const t = Math.max(at ?? 0, ctx.currentTime)
    const pluck = p.sound_mode === 'pluck' ? createPluck(ctx, t) : null
    if (voices.has(key)) release(key, undefined, t)
    const oldest = voices.keys().next()
    if (voices.size >= MAX_VOICES && !oldest.done) release(oldest.value, 0.01, ctx.currentTime)

    const osc1 = pluck ? null : ctx.createOscillator()
    const osc2 = pluck ? null : ctx.createOscillator()
    const g1 = pluck ? null : ctx.createGain()
    const g2 = pluck ? null : ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const amp = ctx.createGain()
    // Per-voice LFOs so each note's wobble starts from the same phase.
    const lfos = LFOS.map((n): VoiceLfo => {
      const osc = ctx.createOscillator()
      const depth = ctx.createGain()
      const { beats, rate, target } = lfoParams(p, n)
      osc.frequency.value = lfoHz(rate, beats, bpm)
      depth.gain.value = lfoSwing(p, n)
      osc.connect(depth)
      return { beats, depth, n, osc, target }
    })
    const trem = ctx.createGain()
    const drive = createDrive(ctx, p, filter)

    const from = glideFrom(key, midi, t, p)
    if (osc1 && osc2 && g1 && g2) {
      applyOsc(t, osc1, g1, 1, midi, false, p, from)
      applyOsc(t, osc2, g2, 2, midi, false, p, from)
      osc1.connect(g1).connect(drive.level)
      osc2.connect(g2).connect(drive.level)
    }
    if (pluck) {
      pluck.frequency.setValueAtTime(freq(from ?? midi, 0), t)
      if (from !== undefined)
        pluck.frequency.exponentialRampToValueAtTime(freq(midi, 0), t + p.glide)
      pluck.brightness.value = p.pluck_brightness
      pluck.decay.value = p.pluck_decay
      pluck.node.connect(drive.level)
    }
    filter.type = p.filter_type
    filter.frequency.value = p.filter_cutoff
    filter.Q.value = filterQ(p)

    // The sub and the noise join only notes that start with them turned up, so
    // a sound without them costs no extra nodes.
    let sub: Voice['sub'] = null
    if (!pluck && p.sub_level) {
      sub = { gain: ctx.createGain(), osc: ctx.createOscillator() }
      applyOsc(t, sub.osc, sub.gain, 'sub', midi, false, p, from)
      sub.osc.connect(sub.gain).connect(drive.level)
    }
    let noise: GainNode | null = null
    let hiss: AudioBufferSourceNode | null = null
    if (!pluck && p.noise_level) {
      noise = ctx.createGain()
      noise.gain.value = p.noise_level
      hiss = ctx.createBufferSource()
      hiss.buffer = noiseBuffer(ctx)
      hiss.loop = true
      hiss.connect(noise).connect(drive.level)
    }
    const fx = soundFx(fxName(key, own), p)
    applyFx(fx, p)
    filter.connect(amp).connect(trem).connect(fx.input)
    trem.gain.value = tremLevel(p)

    // Velocity scales the envelope's peak, so a softer note is quieter all through.
    const { attack, decay, sustain } = p
    const peak = HEADROOM * velocity
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(peak, t + attack)
    amp.gain.linearRampToValueAtTime(peak * sustain, t + attack + decay)

    // The filter envelope moves the cutoff's detune; a filter LFO adds on top.
    // `filter_velocity` lets a softer note open it less: at 1, the sweep follows
    // velocity all the way; at 0, every note sweeps the full amount.
    const fenv: FilterEnv = {
      amount: p.filter_env_amount * 1200 * (1 - p.filter_velocity * (1 - velocity)),
      attack: p.filter_attack,
      decay: p.filter_decay,
      release: p.filter_release,
      sustain: p.filter_sustain
    }
    shift?.connect(filter.detune)
    if (fenv.amount) {
      filter.detune.setValueAtTime(0, t)
      filter.detune.linearRampToValueAtTime(fenv.amount, t + fenv.attack)
      filter.detune.linearRampToValueAtTime(
        fenv.amount * fenv.sustain,
        t + fenv.attack + fenv.decay
      )
    }

    // The pitch envelope: an offset on the oscillators' detune, falling in a
    // straight line of cents (a curve in pitch) from the amount to nothing.
    // Pitch LFOs and glide work on top of it.
    const srcs: AudioScheduledSourceNode[] = [
      ...(osc1 && osc2 ? [osc1, osc2] : []),
      ...lfos.map((l) => l.osc)
    ]
    if (sub) srcs.push(sub.osc)
    if (p.pitch_env_amount) {
      const penv = ctx.createConstantSource()
      penv.offset.setValueAtTime(p.pitch_env_amount * 100, t)
      penv.offset.linearRampToValueAtTime(0, t + p.pitch_env_decay)
      if (pluck) penv.connect(pluck.detune)
      if (osc1) penv.connect(osc1.detune)
      if (osc2) penv.connect(osc2.detune)
      if (sub) penv.connect(sub.osc.detune)
      srcs.push(penv)
    }
    if (bend && duration !== undefined && duration > 0) {
      const [into, out] = bendDurations(bend, duration)
      if (into || out) {
        const pitch = ctx.createConstantSource()
        pitch.offset.setValueAtTime(into ? (bend.in?.semitones ?? 0) * 100 : 0, t)
        if (into) pitch.offset.linearRampToValueAtTime(0, t + into)
        if (out) {
          // Do not replace the in-ramp's endpoint when the two ramps meet.
          if (duration - out > into) pitch.offset.setValueAtTime(0, t + duration - out)
          pitch.offset.linearRampToValueAtTime((bend.out?.semitones ?? 0) * 100, t + duration)
        }
        if (pluck) pitch.connect(pluck.detune)
        if (osc1) pitch.connect(osc1.detune)
        if (osc2) pitch.connect(osc2.detune)
        if (sub) pitch.connect(sub.osc.detune)
        srcs.push(pitch)
      }
    }
    const v: Voice = {
      amp,
      attack,
      cleanup,
      decay,
      drive,
      fenv,
      filter,
      g1,
      g2,
      key,
      lfos,
      midi,
      noise,
      osc1,
      osc2,
      own: !!own,
      peak,
      pluck,
      release: p.release,
      srcs,
      sub,
      sustain,
      t0: t,
      trem
    }
    for (const lfo of lfos) routeLfo(v, lfo, lfo.target)
    let cleaned = false
    function cleanup() {
      if (cleaned) return
      cleaned = true
      alive.delete(v)
      if (voices.get(v.key) === v) voices.delete(v.key)
      for (const s of srcs) s.stop(ctx.currentTime)
      if (pluck) {
        pluck.stop(ctx.currentTime)
        pluck.node.disconnect()
        pluck.node.port.close()
      }
      ;[
        ...srcs,
        ...(g1 && g2 ? [g1, g2] : []),
        ...(sub ? [sub.gain] : []),
        ...(noise ? [noise] : []),
        drive.level,
        drive.push,
        drive.shaper,
        drive.wet,
        drive.dc,
        drive.straight,
        drive.dry,
        filter,
        amp,
        trem,
        ...lfos.map((l) => l.depth)
      ].forEach((n) => n.disconnect())
      shift?.disconnect(filter.detune)
    }
    if (osc1) osc1.onended = cleanup
    if (pluck) pluck.onended = cleanup
    for (const s of srcs) s.start(t)
    if (hiss) {
      // From a random point in the shared second, so notes played together don't
      // hiss in step (which would comb-filter them).
      hiss.start(t, Math.random() * (hiss.buffer?.duration ?? 0))
      srcs.push(hiss)
    }

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
      v.cleanup()
    }
  }

  function now(): number {
    return ensureContext().ctx.currentTime
  }

  // Sounding voices take on changed settings, gliding so nothing clicks.
  function follow(v: Voice, p: SynthParams, t: number): void {
    v.filter.frequency.setTargetAtTime(p.filter_cutoff, t, 0.01)
    v.filter.type = p.filter_type
    v.filter.Q.setTargetAtTime(filterQ(p), t, 0.01)
    for (const lfo of v.lfos) {
      const { beats, rate, target } = lfoParams(p, lfo.n)
      if (lfo.target !== target) routeLfo(v, lfo, target)
      lfo.beats = beats
      lfo.osc.frequency.setTargetAtTime(lfoHz(rate, beats, bpm), t, 0.01)
      lfo.depth.gain.setTargetAtTime(lfoSwing(p, lfo.n), t, 0.01)
    }
    v.trem.gain.setTargetAtTime(tremLevel(p), t, 0.01)
    updateDrive(v.drive, p, t, v.pluck ? 'pluck' : 'synth')
    if (v.osc1 && v.g1) applyOsc(t, v.osc1, v.g1, 1, v.midi, true, p)
    if (v.osc2 && v.g2) applyOsc(t, v.osc2, v.g2, 2, v.midi, true, p)
    if (v.pluck) {
      v.pluck.brightness.setTargetAtTime(p.pluck_brightness, t, 0.01)
      v.pluck.decay.setTargetAtTime(p.pluck_decay, t, 0.01)
    }
    if (v.sub) applyOsc(t, v.sub.osc, v.sub.gain, 'sub', v.midi, true, p)
    v.noise?.gain.setTargetAtTime(p.noise_level, t, 0.01)
  }

  function setParams(p: Partial<SynthParams>): void {
    params = { ...params, ...p }
    if (!ctx || !master) return
    const t = ctx.currentTime
    master.gain.setTargetAtTime(params.volume, t, 0.01)
    const live = fxs.get('live')
    if (live) applyFx(live, params)
    for (const v of voices.values()) if (!v.own) follow(v, params, t)
  }

  // A loop's new sound (`own`, as given to noteOn) for its voices already sounding:
  // those keyed with `prefix`.
  function setOwnParams(prefix: string, own: Partial<SynthParams>): void {
    if (!ctx) return
    const p = { ...DEFAULT_PARAMS, ...own }
    const fx = fxs.get(source(prefix))
    if (fx) applyFx(fx, p)
    for (const v of voices.values()) {
      if (!v.own || typeof v.key !== 'string' || !v.key.startsWith(prefix)) continue
      v.release = p.release
      follow(v, p, ctx.currentTime)
    }
  }

  // Synced LFOs on every sounding note (released ones too, while they ring) speed
  // up or slow down with the tempo; free ones don't change.
  function setTempo(next: number): void {
    bpm = next
    if (!ctx) return
    for (const fx of fxs.values()) applyFx(fx, fx.p)
    const t = ctx.currentTime
    for (const v of alive) {
      for (const lfo of v.lfos) {
        if (lfo.beats !== null) lfo.osc.frequency.setTargetAtTime(bpm / 60 / lfo.beats, t, 0.01)
      }
    }
  }

  // Detach from the shared AudioContext (it outlives this component).
  function close(): void {
    for (const v of alive) v.cleanup()
    master?.disconnect()
    master = null
    for (const fx of fxs.values()) {
      fx.input.disconnect()
      fx.chorus?.unit.stop()
    }
    fxs.clear()
    shift?.stop()
    shift = null
    ctx = null
    voices.clear()
    alive.clear()
  }

  // Arranger automation: shifts every sounding and new note's cutoff, in octaves,
  // along `ramp` from audio time t0 to t1; null puts it back to none at t0.
  function automateFilter(ramp: null | Ramp, t0: number, t1: number): void {
    if (!ramp && !shift) return
    const { offset } = filterShift()
    if (ramp) rampThrough(offset, [ramp[0] * 1200, ramp[1] * 1200], t0, t1)
    else offset.setValueAtTime(0, t0)
  }

  // The song stopped: the shift glides back to none now.
  function stopAutomation(): void {
    if (shift && ctx) settle(shift.offset, ctx.currentTime, 0)
  }

  // Made the first time a song automates the filter, and joined to every note alive.
  function filterShift(): ConstantSourceNode {
    if (!shift) {
      const { ctx } = ensureContext()
      const created = ctx.createConstantSource()
      created.offset.value = 0
      created.start()
      for (const v of alive) created.connect(v.filter.detune)
      shift = created
    }
    return shift
  }

  return {
    allNotesOff,
    automateFilter,
    cancelPending,
    close,
    noteOff,
    noteOn,
    now,
    ready: async () => preparePluck(ensureContext().ctx),
    setOwnParams,
    setParams,
    setTempo,
    stopAutomation
  }
}

function oscSpec(
  p: SynthParams,
  n: OscId
): { detune: number; level: number; octave: number; wave: Wave } {
  if (n === 'sub') {
    return { detune: p.osc1_detune, level: p.sub_level, octave: p.osc1_octave - 1, wave: 'sine' }
  }
  return {
    detune: p[`osc${n}_detune`],
    level: p[`osc${n}_level`],
    octave: p[`osc${n}_octave`],
    wave: p[`osc${n}_wave`]
  }
}
