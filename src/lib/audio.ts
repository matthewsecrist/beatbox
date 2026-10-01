// One AudioContext for the whole page: every instrument schedules against the same
// clock (separate contexts drift apart), and browsers cap how many can exist.
// Created lazily because browsers only allow audio after a user gesture.
let ctx: AudioContext | null = null

export function getContext(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

const noises = new WeakMap<BaseAudioContext, AudioBuffer>()

// A second of white noise, made once per context and shared by every instrument
// (drum hits, the synth's noise source).
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let noise = noises.get(ctx)
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noises.set(ctx, noise)
  }
  return noise
}

// Bitcrusher: a wave shaper with a stair-step curve rounds every sample to one of
// a few levels. An amount above 0 takes the bit depth from 12 down to 2 (0 is
// off). The curve is linear between its points, so it needs many for the steps
// to stay sharp. No oversampling: the aliasing is part of the grit.
// ponytail: bit depth only; sample-rate reduction needs an AudioWorklet.
const CRUSH_POINTS = 2 ** 14 + 1 // odd, so 0 falls on a point
const crushCurves = new Map<number, Float32Array<ArrayBuffer>>()

export interface Crusher {
  node: WaveShaperNode
  // The crush amount, 0-1; the curve only changes when the bit depth does.
  set(amount: number): void
}

// Pan as a balance: a mono sound plays on both sides (as it does unpanned) and
// moving it one way fades the other side out, so the centre is exactly as before
// and nothing ever gets louder. A StereoPannerNode would play a centred mono sound
// 3 dB quieter on each side, and a hard-panned one louder.
export interface Panner {
  input: GainNode
  output: ChannelMergerNode
  // -1 (left) to 1 (right), gliding there unless `now` (just made).
  set(pan: number, now?: boolean): void
}

export function createCrusher(ctx: BaseAudioContext, amount: number): Crusher {
  const node = ctx.createWaveShaper()
  node.oversample = 'none'
  let bits = -1
  const set = (next: number) => {
    if (crushBits(next) === bits) return
    bits = crushBits(next)
    node.curve = bits ? stairs(bits) : null
  }
  set(amount)
  return { node, set }
}

export function createPanner(ctx: BaseAudioContext, pan: number): Panner {
  // Up-mixes a mono input to two equal sides first.
  const input = ctx.createGain()
  input.channelCount = 2
  input.channelCountMode = 'explicit'
  input.channelInterpretation = 'speakers'
  const split = ctx.createChannelSplitter(2)
  const output = ctx.createChannelMerger(2)
  const side = (channel: number) => {
    const g = ctx.createGain()
    split.connect(g, channel)
    g.connect(output, 0, channel)
    return g
  }
  const left = side(0)
  const right = side(1)
  input.connect(split)

  // A side's level: full until the pan moves away from it, then fading out.
  const fade = (away: number) => (away > 0 ? Math.cos((away * Math.PI) / 2) : 1)
  function set(next: number, now = false) {
    for (const [g, level] of [
      [left, fade(next)],
      [right, fade(-next)]
    ] as const) {
      if (now) g.gain.value = level
      else g.gain.setTargetAtTime(level, ctx.currentTime, 0.02)
    }
  }

  set(pan, true)
  return { input, output, set }
}

export function crushBits(amount: number): number {
  return amount > 0 ? Math.round(12 - 10 * amount) : 0
}

// Chorus / flanger: two short delay lines, one per side, whose times one LFO
// swings in opposite directions, so two copies of the sound drift a little in
// and out of tune around it and spread it wide. A flanger is the same with a
// much shorter delay and feedback, for the metallic, sweeping "jet" sound. Only
// the copies come out of `output` (stereo); the caller blends it in at its mix.
const CHORUS_DELAY = 0.015 // s, swung by up to CHORUS_SWING each way at full depth
const CHORUS_SWING = 0.006
const FLANGER_DELAY = 0.003
const FLANGER_SWING = 0.0025
const FLANGER_FEEDBACK = 0.6

export interface Chorus {
  input: GainNode
  output: ChannelMergerNode
  // New settings, gliding there unless `now` (just made).
  set(settings: ChorusSettings, now?: boolean): void
  // Stops the LFO, for good.
  stop(): void
}

export interface ChorusSettings {
  depth: number // 0-1
  flanger: boolean
  rate: number // Hz
}

export function createChorus(ctx: BaseAudioContext, initial: ChorusSettings): Chorus {
  const input = ctx.createGain()
  const output = ctx.createChannelMerger(2)
  const lfo = ctx.createOscillator()
  const sides = [1, -1].map((sign, side) => {
    const delay = ctx.createDelay(0.05)
    const swing = ctx.createGain()
    const feedback = ctx.createGain()
    input.connect(delay)
    delay.connect(feedback).connect(delay)
    delay.connect(output, 0, side)
    lfo.connect(swing).connect(delay.delayTime)
    return { delay, feedback, sign, swing }
  })

  function set({ depth, flanger, rate }: ChorusSettings, now = false) {
    const t = ctx.currentTime
    const to = (param: AudioParam, value: number) => {
      if (now) param.value = value
      else param.setTargetAtTime(value, t, 0.02)
    }
    to(lfo.frequency, rate)
    for (const { delay, feedback, sign, swing } of sides) {
      to(delay.delayTime, flanger ? FLANGER_DELAY : CHORUS_DELAY)
      to(swing.gain, sign * depth * (flanger ? FLANGER_SWING : CHORUS_SWING))
      to(feedback.gain, flanger ? FLANGER_FEEDBACK : 0)
    }
  }

  set(initial, true)
  lfo.start()
  return { input, output, set, stop: () => lfo.stop() }
}

// Arranger automation: moves `param` through `values`, evenly spaced from `t0`
// to `t1`, in straight lines (two values: one straight ramp).
export function rampThrough(param: AudioParam, values: number[], t0: number, t1: number): void {
  values.forEach((v, i) => {
    if (i === 0) param.setValueAtTime(v, t0)
    else param.linearRampToValueAtTime(v, t0 + ((t1 - t0) * i) / (values.length - 1))
  })
}

// Drops `param`'s scheduled changes from `t` and holds it where it is, then glides
// to `value` (automation ending early: the song stopped).
export function settle(param: AudioParam, t: number, value: number): void {
  const now = param.value
  param.cancelScheduledValues(t)
  param.setValueAtTime(now, t)
  param.setTargetAtTime(value, t, 0.02)
}

// The stair-step curve at `bits` (2 ** (bits - 1) steps each side of 0), made once.
function stairs(bits: number): Float32Array<ArrayBuffer> {
  let curve = crushCurves.get(bits)
  if (!curve) {
    const levels = 2 ** (bits - 1)
    curve = new Float32Array(CRUSH_POINTS)
    for (let i = 0; i < CRUSH_POINTS; i++) {
      curve[i] = Math.round(((2 * i) / (CRUSH_POINTS - 1) - 1) * levels) / levels
    }
    crushCurves.set(bits, curve)
  }
  return curve
}
