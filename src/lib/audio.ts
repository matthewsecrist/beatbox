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

export function crushBits(amount: number): number {
  return amount > 0 ? Math.round(12 - 10 * amount) : 0
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
