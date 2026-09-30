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
