import type { DelayTime, Effects } from './types.js'

import { getContext } from './audio.js'

// Shared send effects on the page's AudioContext: every instrument plays into a
// channel that goes to the speakers dry and, through a send level per effect,
// into one tempo-synced delay and one reverb. Nothing is built until an
// instrument first asks for its channel (after a user gesture); settings made
// before then are kept and applied when it is.

export type Instrument = 'drums' | 'synth'

// Every send at 0: a song without effects sounds dry, as before effects existed.
export const DEFAULT_EFFECTS: Effects = {
  delay_feedback: 0.35,
  delay_mix: 0.6,
  delay_time: '1/8d',
  drums_delay: 0,
  drums_reverb: 0,
  reverb_mix: 0.6,
  reverb_size: 2,
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

const MAX_DELAY = 4 // seconds: a half note down to 30 BPM
const DAMPING = 4500 // Hz: each repeat comes back a little darker
const SMOOTH = 0.02 // s: glide for level and time changes, so they don't click

export interface EffectsBus {
  // The node an instrument plays into (created on first use).
  channel(instrument: Instrument): AudioNode
  // Silences an instrument (dry and sends) or brings it back; listening only.
  mute(instrument: Instrument, muted: boolean): void
  // Applies the song's settings; `bpm` sets the delay time.
  set(settings: Effects, bpm: number): void
}

interface Bus {
  channels: Partial<Record<Instrument, { delay: GainNode; reverb: GainNode }>>
  ctx: BaseAudioContext
  delay: DelayNode
  delayOut: GainNode
  feedback: GainNode
  inputs: Partial<Record<Instrument, GainNode>>
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

  function build(): Bus {
    const ctx = getCtx()
    const delay = ctx.createDelay(MAX_DELAY)
    const damping = ctx.createBiquadFilter()
    const feedback = ctx.createGain()
    const delayOut = ctx.createGain()
    damping.type = 'lowpass'
    damping.frequency.value = DAMPING
    // delay -> damping -> feedback -> delay: each repeat quieter and darker.
    delay.connect(damping).connect(feedback).connect(delay)
    damping.connect(delayOut).connect(ctx.destination)

    const reverb = ctx.createConvolver()
    const reverbOut = ctx.createGain()
    reverb.connect(reverbOut).connect(ctx.destination)

    const created: Bus = {
      channels: {},
      ctx,
      delay,
      delayOut,
      feedback,
      inputs: {},
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
    to(b.delay.delayTime, Math.min(MAX_DELAY, (DELAY_BEATS[settings.delay_time] * 60) / bpm))
    to(b.feedback.gain, settings.delay_feedback)
    to(b.delayOut.gain, settings.delay_mix)
    to(b.reverbOut.gain, settings.reverb_mix)
    for (const [instrument, sends] of Object.entries(b.channels)) {
      to(sends.delay.gain, settings[`${instrument as Instrument}_delay`])
      to(sends.reverb.gain, settings[`${instrument as Instrument}_reverb`])
    }
    // A new impulse is only worth making when the size changes.
    if (b.size !== settings.reverb_size) {
      b.size = settings.reverb_size
      b.reverb.buffer = impulse(b.ctx, b.size)
    }
  }

  return {
    channel(instrument: Instrument): AudioNode {
      const b = (bus ??= build())
      const existing = b.inputs[instrument]
      if (existing) return existing
      const { ctx } = b
      const input = ctx.createGain()
      const delay = ctx.createGain()
      const reverb = ctx.createGain()
      input.gain.value = muted.has(instrument) ? 0 : 1
      input.connect(ctx.destination)
      input.connect(delay).connect(b.delay)
      input.connect(reverb).connect(b.reverb)
      delay.gain.value = settings[`${instrument}_delay`]
      reverb.gain.value = settings[`${instrument}_reverb`]
      b.inputs[instrument] = input
      b.channels[instrument] = { delay, reverb }
      return input
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

export const effects = createEffects()
