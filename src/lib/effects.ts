import type { Automation, DelayTime, Effects, Ramp } from './types.js'

import {
  type Chorus,
  createChorus,
  createCrusher,
  type Crusher,
  getContext,
  rampThrough,
  settle
} from './audio.js'
import { EFFECT_TARGETS, type EffectTarget } from './automation.js'

// Shared send effects on the page's AudioContext: every instrument plays into a
// channel that goes to the master stage dry and, through a send level per effect,
// into one tempo-synced delay (straight or ping-pong), one reverb and one chorus
// (or flanger), whose returns join it there. Each kick ducks the synth channel (dry and sends) for the
// pumping sidechain sound. The master stage is a glue compressor (off by default),
// a DJ filter, a bitcrusher blended into the whole mix (off by default) and then a fixed
// limiter, so stacked sends and drive don't clip. Nothing is
// built until an instrument first asks for its channel (after a user gesture);
// settings made before then are kept and applied when it is.

export type Instrument = 'drums' | 'synth'
// The shared effects an instrument sends to.
type Send = 'chorus' | 'delay' | 'reverb'

// Every send at 0 and the compressor off: a song without effects sounds dry, as
// before effects existed (the limiter only touches peaks that would clip).
export const DEFAULT_EFFECTS: Effects = {
  chorus_depth: 0.5,
  chorus_flanger: false,
  chorus_mix: 0.7,
  chorus_rate: 0.8,
  comp_amount: 0.5,
  comp_on: false,
  delay_feedback: 0.35,
  delay_mix: 0.6,
  delay_pingpong: false,
  delay_time: '1/8d',
  drums_chorus: 0,
  drums_delay: 0,
  drums_reverb: 0,
  duck_amount: 0,
  duck_release: '1/8',
  master_crush: 0.6,
  master_crush_mix: 0,
  master_filter: 0,
  reverb_mix: 0.6,
  reverb_size: 2,
  synth_chorus: 0,
  synth_delay: 0,
  synth_reverb: 0
}

// Delay time in beats (quarter notes).
export const DELAY_BEATS: Record<DelayTime, number> = {
  '1/2': 2,
  '1/4': 1,
  '1/4d': 1.5,
  '1/8': 1 / 2,
  '1/8d': 3 / 4,
  '1/8t': 1 / 3,
  '1/16': 1 / 4
}

// The delay time menu, shortest first.
export const DELAY_TIMES: [DelayTime, string][] = [
  ['1/16', '1/16'],
  ['1/8t', '1/8T'],
  ['1/8', '1/8'],
  ['1/8d', '1/8 dotted'],
  ['1/4', '1/4'],
  ['1/4d', '1/4 dotted'],
  ['1/2', '1/2']
]

export const MAX_DELAY = 4 // seconds: a half note down to 30 BPM
export const DAMPING = 4500 // Hz: each repeat comes back a little darker
const SMOOTH = 0.02 // s: glide for level and time changes, so they don't click
// Sidechain: a kick pulls the synth down within a few ms and holds it there
// briefly, then it comes back (95% of the way over the release).
const DUCK_ATTACK = 0.003 // s, time constant
const DUCK_HOLD = 0.01 // s

// Glue compressor: `comp_amount` lowers the threshold from 0 to COMP_RANGE dB at a
// gentle ratio. The node adds its own makeup gain, which keeps a typical mix about
// as loud as it was: quiet parts come up, peaks come down.
const COMP_RANGE = -24
const COMP_RATIO = 3
// Limiter: fixed, just under full scale. Its makeup gain would push peaks back
// over, so a trim after it takes that back out (the node's makeup is
// (1 / gain at 0 dB) ** 0.6).
const LIMIT = -1 // dB
const LIMIT_RATIO = 20
const LIMIT_TRIM = 10 ** ((0.6 * (LIMIT - LIMIT / LIMIT_RATIO)) / 20)
// The limiter's ratio tops out at 20, so a big enough pile-up still creeps past
// it. The last stage is a clipper that can't: straight up to KNEE (so anything
// the limiter already held is untouched), then curving smoothly towards CEILING.
// A wave shaper maps anything beyond ±1 to its curve's ends, so nothing leaves
// it louder than those.
const KNEE = 0.95
const CEILING = 0.99
const CLIP_POINTS = 4097 // odd, so 0 falls on a point

let clipCurve: Float32Array<ArrayBuffer> | null = null

// DJ filter: `master_filter` from -1 to 1. Left of centre sweeps a low-pass down
// from 20 kHz to 100 Hz, right sweeps a high-pass up from 20 Hz to 8 kHz, both
// evenly in pitch; 0 is off. A little resonance at the cutoff, as on a DJ mixer.
const FILTER_Q = 4 // dB
export interface EffectsBus {
  // A section's ramps, from audio time `t0` to `t1` (arranger automation); any
  // setting the last section ramped and this one doesn't goes back to the song's at `t0`.
  automate(ramps: Automation, t0: number, t1: number): void
  // The node an instrument plays into (created on first use).
  channel(instrument: Instrument): AudioNode
  // A kick at audio time `at`, `level` its gain (1 = full): ducks the synth by
  // the sidechain amount, less for a softer kick. Nothing while the drums are muted.
  duck(at: number, level: number): void
  // Silences an instrument (dry and sends) or brings it back; listening only.
  mute(instrument: Instrument, muted: boolean): void
  // Applies the song's settings; `bpm` sets the delay time and the duck's release.
  set(settings: Effects, bpm: number): void
  // The song stopped: everything automated glides back to the song's settings now.
  stopAutomation(): void
}

interface Bus {
  // Gain putting the left delay line on the right side too (straight delay).
  bothSides: GainNode
  // Per instrument: its ducking gain (after the mute), then its send levels.
  channels: Partial<Record<Instrument, Record<'duck' | Send, GainNode>>>
  chorus: Chorus
  chorusOut: GainNode
  comp: DynamicsCompressorNode
  // Ping-pong feedback: each delay line into the other.
  crossLR: GainNode
  crossRL: GainNode
  // The whole mix's bitcrusher, after the DJ filter, blended with the clean mix:
  // `crushDry` and `crushWet` crossfade them at `master_crush_mix`.
  crush: Crusher
  crushDry: GainNode
  crushWet: GainNode
  ctx: BaseAudioContext
  // The left delay line, which the sends feed, and the right one.
  delay: DelayNode
  delayOut: GainNode
  delayR: DelayNode
  // Straight feedback: the left line into itself.
  feedback: GainNode
  // The DJ filter: one low-pass and one high-pass in a row.
  highpass: BiquadFilterNode
  inputs: Partial<Record<Instrument, GainNode>>
  lowpass: BiquadFilterNode
  // Where the channels and effect returns meet, before the compressor.
  master: GainNode
  reverb: ConvolverNode
  reverbOut: GainNode
  // Size the reverb's impulse response was made for.
  size: number
}

export function createEffects(getCtx: () => BaseAudioContext = getContext): EffectsBus {
  let settings = DEFAULT_EFFECTS
  let bpm = 110
  let bus: Bus | null = null
  const muted = new Set<Instrument>()
  // Settings the arrangement owns, with the audio time it lets go of each
  // (Infinity while ramping). Until then song edits wait and Stop cancels them.
  const automated = new Map<EffectTarget, number>()

  function build(): Bus {
    const ctx = getCtx()
    // master -> compressor -> DJ filter -> (clean + crushed) -> limiter -> trim -> clipper -> speakers.
    const master = ctx.createGain()
    const comp = ctx.createDynamicsCompressor()
    comp.knee.value = 6
    comp.attack.value = 0.01
    comp.release.value = 0.2
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = LIMIT
    limiter.ratio.value = LIMIT_RATIO
    limiter.knee.value = 0
    limiter.attack.value = 0 // it looks ahead, so it still catches the first peak
    limiter.release.value = 0.1
    const trim = ctx.createGain()
    trim.gain.value = LIMIT_TRIM
    const clip = ctx.createWaveShaper()
    clip.curve = clipper()
    // No oversampling: its filter would ring past the ceiling on the sharp edges
    // the clipper makes. The aliasing that costs only happens while it's bending.
    clip.oversample = 'none'
    // DJ filter after the compressor, so the limiter still catches its resonance.
    const lowpass = ctx.createBiquadFilter()
    const highpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    highpass.type = 'highpass'
    lowpass.Q.value = highpass.Q.value = FILTER_Q
    const crush = createCrusher(ctx, settings.master_crush)
    const crushDry = ctx.createGain()
    const crushWet = ctx.createGain()
    master.connect(comp).connect(lowpass).connect(highpass)
    highpass.connect(crushDry).connect(limiter)
    highpass.connect(crush.node).connect(crushWet).connect(limiter)
    limiter.connect(trim).connect(clip).connect(ctx.destination)

    // Two delay lines, each with a damping filter so every repeat comes back a
    // little darker. The sends feed the left one. Straight, it feeds itself back
    // and plays on both sides. Ping-pong, each line feeds the other instead and
    // plays on its own side, so the repeats bounce left, right, left…
    const delay = ctx.createDelay(MAX_DELAY)
    const delayR = ctx.createDelay(MAX_DELAY)
    const damping = ctx.createBiquadFilter()
    const dampingR = ctx.createBiquadFilter()
    for (const d of [damping, dampingR]) {
      d.type = 'lowpass'
      d.frequency.value = DAMPING
    }
    const feedback = ctx.createGain() // left into left (straight)
    const crossLR = ctx.createGain() // left into right (ping-pong)
    const crossRL = ctx.createGain() // right into left (ping-pong)
    const bothSides = ctx.createGain() // the left line on the right too (straight)
    const sides = ctx.createChannelMerger(2)
    const delayOut = ctx.createGain()
    delay.connect(damping).connect(feedback).connect(delay)
    damping.connect(crossLR).connect(delayR)
    delayR.connect(dampingR).connect(crossRL).connect(delay)
    damping.connect(sides, 0, 0)
    damping.connect(bothSides).connect(sides, 0, 1)
    dampingR.connect(sides, 0, 1)
    sides.connect(delayOut).connect(master)

    const reverb = ctx.createConvolver()
    const reverbOut = ctx.createGain()
    reverb.connect(reverbOut).connect(master)

    const chorus = createChorus(ctx, chorusSettings(settings))
    const chorusOut = ctx.createGain()
    chorus.output.connect(chorusOut).connect(master)

    const created: Bus = {
      bothSides,
      channels: {},
      chorus,
      chorusOut,
      comp,
      crossLR,
      crossRL,
      crush,
      crushDry,
      crushWet,
      ctx,
      delay,
      delayOut,
      delayR,
      feedback,
      highpass,
      inputs: {},
      lowpass,
      master,
      reverb,
      reverbOut,
      size: 0
    }
    apply(created, true)
    return created
  }

  // Brings the nodes in line with the settings; `now` sets them outright
  // instead of gliding (a freshly built bus).
  function apply(b: Bus, now = false) {
    const t = b.ctx.currentTime
    const to = (param: AudioParam, value: number) => {
      if (now) param.value = value
      else param.setTargetAtTime(value, t, SMOOTH)
    }
    const time = Math.min(MAX_DELAY, (DELAY_BEATS[settings.delay_time] * 60) / bpm)
    to(b.delay.delayTime, time)
    to(b.delayR.delayTime, time)
    const { delay_feedback: fb, delay_pingpong: pingPong } = settings
    to(b.feedback.gain, pingPong ? 0 : fb)
    to(b.crossLR.gain, pingPong ? fb : 0)
    to(b.crossRL.gain, pingPong ? fb : 0)
    to(b.bothSides.gain, pingPong ? 0 : 1)
    // Off is a ratio of 1 at 0 dB: nothing is squeezed and the makeup gain is 1.
    to(b.comp.threshold, settings.comp_on ? COMP_RANGE * settings.comp_amount : 0)
    to(b.comp.ratio, settings.comp_on ? COMP_RATIO : 1)
    // Mixes, sends and the master filter, unless the arrangement is moving them.
    for (const target of EFFECT_TARGETS) {
      const release = automated.get(target)
      if (release !== undefined && release > b.ctx.currentTime) {
        // Letting go on a boundary already scheduled: the reset there lands on the
        // latest setting (a later event at the same time wins).
        if (release !== Infinity) {
          for (const [param, value] of drives(b, target)) {
            param.setValueAtTime(value(settings[target]), release)
          }
        }
        continue
      }
      automated.delete(target)
      for (const [param, value] of drives(b, target)) to(param, value(settings[target]))
    }
    b.crush.set(settings.master_crush)
    b.chorus.set(chorusSettings(settings), now)
    // A new impulse is only worth making when the size changes.
    if (b.size !== settings.reverb_size) {
      b.size = settings.reverb_size
      b.reverb.buffer = impulse(b.ctx, b.size)
    }
  }

  return {
    automate(ramps: Automation, t0: number, t1: number): void {
      if (!bus) return
      for (const target of EFFECT_TARGETS) {
        const ramp = ramps[target]
        const release = automated.get(target)
        // A section that leaves it alone gets the song's setting back from its first beat.
        if (!ramp && (release === undefined || release <= bus.ctx.currentTime)) continue
        automated.set(target, ramp ? Infinity : t0)
        for (const [param, value] of drives(bus, target)) {
          if (!ramp) param.setValueAtTime(value(settings[target]), t0)
          else rampThrough(param, rampPoints(ramp, target).map(value), t0, t1)
        }
      }
    },
    channel(instrument: Instrument): AudioNode {
      const b = (bus ??= build())
      const existing = b.inputs[instrument]
      if (existing) return existing
      const { ctx } = b
      const input = ctx.createGain()
      const duck = ctx.createGain()
      const delay = ctx.createGain()
      const reverb = ctx.createGain()
      const chorus = ctx.createGain()
      input.gain.value = muted.has(instrument) ? 0 : 1
      input.connect(duck)
      duck.connect(b.master)
      duck.connect(delay).connect(b.delay)
      duck.connect(reverb).connect(b.reverb)
      duck.connect(chorus).connect(b.chorus.input)
      delay.gain.value = settings[`${instrument}_delay`]
      reverb.gain.value = settings[`${instrument}_reverb`]
      chorus.gain.value = settings[`${instrument}_chorus`]
      b.inputs[instrument] = input
      b.channels[instrument] = { chorus, delay, duck, reverb }
      return input
    },
    duck(at: number, level: number): void {
      const synth = bus?.channels.synth
      if (!synth || !settings.duck_amount || muted.has('drums')) return
      const release = (DELAY_BEATS[settings.duck_release] * 60) / bpm
      const { gain } = synth.duck
      gain.setTargetAtTime(1 - settings.duck_amount * Math.min(1, level), at, DUCK_ATTACK)
      gain.setTargetAtTime(1, at + DUCK_HOLD, release / 3)
    },
    mute(instrument: Instrument, on: boolean): void {
      if (on) muted.add(instrument)
      else muted.delete(instrument)
      const input = bus?.inputs[instrument]
      if (bus && input) input.gain.setTargetAtTime(on ? 0 : 1, bus.ctx.currentTime, SMOOTH)
    },
    set(next: Effects, nextBpm: number): void {
      settings = next
      bpm = nextBpm
      if (bus) apply(bus)
    },
    stopAutomation(): void {
      if (!bus) return
      for (const target of automated.keys()) {
        for (const [param, value] of drives(bus, target)) {
          settle(param, bus.ctx.currentTime, value(settings[target]))
        }
      }
      automated.clear()
    }
  }
}

// A decaying stereo noise burst: a plain, smooth room tail `seconds` long.
export function impulse(ctx: BaseAudioContext, seconds: number, random = Math.random): AudioBuffer {
  const length = Math.max(1, Math.round(seconds * ctx.sampleRate))
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) data[i] = (random() * 2 - 1) * (1 - i / length) ** 3
  }
  return buffer
}

const chorusSettings = (s: Effects) => ({
  depth: s.chorus_depth,
  flanger: s.chorus_flanger,
  rate: s.chorus_rate
})

export function masterFilterHz(x: number): number {
  return x < 0 ? 20000 * (100 / 20000) ** -x : 20 * (8000 / 20) ** x
}

function clipper(): Float32Array<ArrayBuffer> {
  if (!clipCurve) {
    clipCurve = new Float32Array(CLIP_POINTS)
    const room = CEILING - KNEE
    for (let i = 0; i < CLIP_POINTS; i++) {
      const x = (2 * i) / (CLIP_POINTS - 1) - 1
      const over = Math.abs(x) - KNEE
      clipCurve[i] = over <= 0 ? x : Math.sign(x) * (KNEE + room * Math.tanh(over / room))
    }
  }
  return clipCurve
}

// The params an automatable setting drives, each with its value for a setting of `x`.
function drives(b: Bus, target: EffectTarget): [AudioParam, (x: number) => number][] {
  const same = (x: number) => x
  if (target === 'master_filter') {
    // The filter not in use rests where it passes everything (low-pass at the
    // Nyquist frequency, high-pass at 0 Hz), so the centre is truly off.
    return [
      [b.lowpass.frequency, (x) => (x < 0 ? masterFilterHz(x) : b.ctx.sampleRate / 2)],
      [b.highpass.frequency, (x) => (x > 0 ? masterFilterHz(x) : 0)]
    ]
  }
  // A crossfade: crushed and clean are the same signal, so a straight one keeps the level.
  if (target === 'master_crush_mix')
    return [
      [b.crushWet.gain, same],
      [b.crushDry.gain, (x) => 1 - x]
    ]
  if (target === 'delay_mix') return [[b.delayOut.gain, same]]
  if (target === 'reverb_mix') return [[b.reverbOut.gain, same]]
  if (target === 'chorus_mix') return [[b.chorusOut.gain, same]]
  const [instrument, effect] = target.split('_') as [Instrument, Send]
  const sends = b.channels[instrument]
  return sends ? [[sends[effect].gain, same]] : []
}

// The points an automated setting passes through: the master filter's cutoff moves
// evenly in pitch, which a straight line in Hz can't follow, so it's split up.
function rampPoints([from, to]: Ramp, target: EffectTarget): number[] {
  const n = target === 'master_filter' ? 33 : 2
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1))
}

export const effects = createEffects()
