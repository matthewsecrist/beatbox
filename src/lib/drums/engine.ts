import type { Transport } from '../transport.js'
import type { DrumStep, KitId, TrackId, VoiceTweak } from '../types.js'

import { getContext } from '../audio.js'
import { transport as sharedTransport } from '../transport.js'

export const TRACKS: { id: TrackId; label: string }[] = [
  { id: 'kick', label: 'Kick' },
  { id: 'snare', label: 'Snare' },
  { id: 'clap', label: 'Clap' },
  { id: 'chat', label: 'Closed Hat' },
  { id: 'ohat', label: 'Open Hat' },
  { id: 'tom', label: 'Tom' }
]

export const KITS: { id: KitId; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: '808', label: '808' },
  { id: '909', label: '909' }
]

export const STEPS = 16
const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.1
const ACCENT = 1.4 // gain boost on accented steps
// Square-wave pitches mixed for the 808's metallic hats and cymbal.
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]

export interface Drums {
  close(): void
  setKit(kit: KitId, voices: Partial<Record<TrackId, VoiceTweak>>): void
  setSwing(swing: number): void
  setVolume(v: number): void
  start(patternFn: PatternFn, atBeat?: number, tag?: number): void
  stop(): void
  stopAt(beat: number): void
  trigger(id: TrackId): void
}

const noop = (): void => undefined

// Returns the pattern to play; read on every step so edits are heard at once.
export type PatternFn = () => Partial<Record<TrackId, DrumStep[]>>

// One hit as a voice plays it: when, how loud, and the voice's tune and decay.
interface Hit {
  gain: number
  len: number // decay multiplier
  pitch: number // frequency multiplier
  t: number
}

interface Output {
  ctx: BaseAudioContext
  master: GainNode
  noise: AudioBuffer
}

// Schedules sounds slightly ahead on the audio clock ("A Tale of Two Clocks"),
// so timing stays tight even when the main thread stutters.
export function createDrums({
  getCtx = getContext,
  onPattern = noop,
  onStep,
  onStop = noop,
  random = Math.random,
  transport = sharedTransport
}: {
  getCtx?: () => BaseAudioContext
  onPattern?: (tag: number | undefined) => void
  onStep: (step: number) => void
  onStop?: () => void
  random?: () => number
  transport?: Pick<Transport, 'acquire' | 'nextBar' | 'release' | 'timeAt'>
}): Drums {
  let out: null | Output = null
  let timer: ReturnType<typeof setInterval> | undefined
  let raf = 0
  let volume = 0.8
  let kit: KitId = 'classic'
  let voices: Partial<Record<TrackId, VoiceTweak>> = {}
  let swing = 50
  let running = false
  let nextStep = 0
  let nextBeat = 0 // step times come from the shared transport grid (4 steps per beat)
  let endBeat = Infinity // set by stopAt(): no steps from this beat on
  let getPattern: PatternFn = () => ({})
  // Pattern switch waiting for its beat.
  let queued: null | { beat: number; fn: PatternFn; tag: number | undefined } = null
  // source -> start time; lets stop() silence lookahead hits
  const pending = new Map<AudioScheduledSourceNode, number>()
  const queue: { step: number; time: number }[] = []

  function ensureContext(): Output {
    if (!out) {
      const ctx = getCtx()
      const master = ctx.createGain()
      master.gain.value = volume
      master.connect(ctx.destination)
      const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      out = { ctx, master, noise }
    }
    return out
  }

  function env({ ctx, master }: Output, t: number, peak: number, decay: number): GainNode {
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + decay)
    g.connect(master)
    return g
  }

  function tone(
    h: Hit,
    from: number,
    to: number,
    sweep: number,
    decay: number,
    peak: number,
    type: OscillatorType = 'sine'
  ) {
    const o = ensureContext().ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from * h.pitch, h.t)
    o.frequency.exponentialRampToValueAtTime(to * h.pitch, h.t + sweep)
    const g = env(ensureContext(), h.t, peak * h.gain, decay * h.len)
    o.connect(g)
    play(o, h.t, decay * h.len, g)
  }

  // `dt` offsets the start (clap bursts) without moving the hit.
  function hiss(h: Hit, type: BiquadFilterType, freq: number, decay: number, peak: number, dt = 0) {
    const output = ensureContext()
    const { ctx } = output
    const t = h.t + dt
    const src = ctx.createBufferSource()
    src.buffer = output.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq * h.pitch
    const g = env(output, t, peak * h.gain, decay * h.len)
    src.connect(f).connect(g)
    play(src, t, decay * h.len, f, g)
  }

  // Six detuned squares through a high-pass: the 808's metallic hat. They all stop
  // on the same sample, so whichever ends first can tear down the shared filter and gain.
  function metal(h: Hit, freq: number, decay: number, peak: number) {
    const output = ensureContext()
    const { ctx } = output
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = freq * h.pitch
    const g = env(output, h.t, peak * h.gain, decay * h.len)
    f.connect(g)
    for (const hz of METAL) {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = hz * h.pitch
      o.connect(f)
      play(o, h.t, decay * h.len, f, g)
    }
  }

  function clap(h: Hit, freq: number, bursts: number[], tail: number, peak: number) {
    for (const dt of bursts) hiss(h, 'bandpass', freq, 0.015, peak, dt)
    hiss(h, 'bandpass', freq, tail, peak, (bursts.at(-1) ?? 0) + 0.01)
  }

  function play(src: AudioScheduledSourceNode, t: number, decay: number, ...nodes: AudioNode[]) {
    pending.set(src, t)
    src.onended = () => {
      pending.delete(src)
      for (const n of [src, ...nodes]) n.disconnect()
    }
    src.start(t)
    src.stop(t + decay + 0.05)
  }

  // Everything is synthesized; the kits only differ in how.
  const SOUNDS: Record<KitId, Record<TrackId, (h: Hit) => void>> = {
    '808': {
      chat: (h) => metal(h, 7500, 0.06, 0.12),
      clap: (h) => clap(h, 1100, [0, 0.011, 0.022, 0.033], 0.3, 0.7),
      kick: (h) => tone(h, 110, 48, 0.08, 0.9, 1),
      ohat: (h) => metal(h, 7500, 0.45, 0.1),
      snare: (h) => {
        tone(h, 180, 180, 0.01, 0.12, 0.35, 'triangle')
        tone(h, 330, 330, 0.01, 0.08, 0.25, 'triangle')
        hiss(h, 'highpass', 1800, 0.18, 0.45)
      },
      tom: (h) => tone(h, 130, 95, 0.3, 0.45, 0.8)
    },
    '909': {
      chat: (h) => {
        hiss(h, 'highpass', 9000, 0.04, 0.3)
        metal(h, 9000, 0.04, 0.06)
      },
      clap: (h) => clap(h, 1300, [0, 0.013, 0.026], 0.22, 0.75),
      kick: (h) => {
        tone(h, 230, 52, 0.05, 0.4, 1)
        hiss(h, 'lowpass', 3000, 0.012, 0.4)
      },
      ohat: (h) => {
        hiss(h, 'highpass', 9000, 0.3, 0.22)
        metal(h, 9000, 0.3, 0.05)
      },
      snare: (h) => {
        tone(h, 200, 175, 0.03, 0.1, 0.5, 'triangle')
        hiss(h, 'highpass', 800, 0.25, 0.75)
      },
      tom: (h) => {
        tone(h, 190, 120, 0.12, 0.3, 0.8)
        hiss(h, 'bandpass', 600, 0.03, 0.2)
      }
    },
    classic: {
      chat: (h) => hiss(h, 'highpass', 7000, 0.05, 0.35),
      clap: (h) => clap(h, 1500, [0, 0.01, 0.02], 0.18, 0.7),
      kick: (h) => tone(h, 150, 40, 0.12, 0.45, 1),
      ohat: (h) => hiss(h, 'highpass', 7000, 0.35, 0.3),
      snare: (h) => {
        hiss(h, 'highpass', 1000, 0.2, 0.6)
        tone(h, 220, 160, 0.05, 0.1, 0.4, 'triangle')
      },
      tom: (h) => tone(h, 140, 80, 0.2, 0.35, 0.8)
    }
  }

  function hit(id: TrackId, t: number, gain: number) {
    const v = voices[id]
    SOUNDS[kit][id]({ gain, len: v?.decay ?? 1, pitch: 2 ** ((v?.tune ?? 0) / 12), t })
  }

  // Beats after the straight grid that `step` lands: swing delays every second 16th.
  const late = (step: number) => (step % 2 ? ((swing - 50) / 100) * (8 / STEPS) : 0)

  function schedule() {
    const { ctx } = ensureContext()
    for (;;) {
      if (nextBeat >= endBeat) {
        if (transport.timeAt(endBeat) <= ctx.currentTime) stop()
        break
      }
      const t = transport.timeAt(nextBeat)
      if (t >= ctx.currentTime + SCHEDULE_AHEAD) break
      if (queued && nextBeat >= queued.beat - 1e-9) {
        getPattern = queued.fn
        onPattern(queued.tag)
        queued = null
      }
      const pattern = getPattern()
      // A ratcheted step spreads its hits up to where the next step lands.
      const from = nextBeat + late(nextStep)
      const span = nextBeat + 4 / STEPS + late(nextStep + 1) - from
      for (const { id } of TRACKS) {
        const step = pattern[id]?.[nextStep]
        if (!step?.on || step.velocity <= 0 || random() >= step.probability) continue
        const gain = step.velocity * (step.accent ? ACCENT : 1)
        for (let r = 0; r < step.ratchet; r++) {
          hit(id, transport.timeAt(from + (span * r) / step.ratchet), gain)
        }
      }
      queue.push({ step: nextStep, time: t })
      nextBeat += 4 / STEPS
      nextStep = (nextStep + 1) % STEPS
    }
  }

  function draw() {
    const { ctx } = ensureContext()
    for (let next = queue[0]; next && next.time <= ctx.currentTime; next = queue[0]) {
      queue.shift()
      onStep(next.step)
    }
    raf = requestAnimationFrame(draw)
  }

  // Starts at `atBeat` (default: next bar line, or at once if nothing else is
  // playing). Already running: cancels a pending stopAt() and switches to this
  // pattern on `atBeat` (default: next bar). `tag` is reported via onPattern when
  // the pattern takes over.
  function start(patternFn: PatternFn, atBeat?: number, tag?: number): void {
    endBeat = Infinity
    if (running) {
      queued = { beat: atBeat ?? transport.nextBar(), fn: patternFn, tag }
      return
    }
    ensureContext()
    transport.acquire('drums')
    running = true
    getPattern = patternFn
    queued = null
    onPattern(tag)
    nextStep = 0
    nextBeat = atBeat ?? transport.nextBar()
    schedule()
    timer = setInterval(schedule, LOOKAHEAD_MS)
    raf = requestAnimationFrame(draw)
  }

  // Stops on `beat` (a section boundary); hits before it still play.
  function stopAt(beat: number): void {
    if (running) endBeat = beat
  }

  function stop(): void {
    if (!running) return
    const { ctx } = ensureContext()
    running = false
    clearInterval(timer)
    cancelAnimationFrame(raf)
    queue.length = 0
    for (const [src, t] of pending) if (t > ctx.currentTime) src.disconnect()
    transport.release('drums')
    onStep(-1)
    onStop()
  }

  function trigger(id: TrackId): void {
    hit(id, ensureContext().ctx.currentTime, 1)
  }

  function setKit(next: KitId, tweaks: Partial<Record<TrackId, VoiceTweak>>): void {
    kit = next
    voices = tweaks
  }

  function setSwing(value: number): void {
    swing = value
  }

  function setVolume(v: number): void {
    volume = v
    if (out) out.master.gain.setTargetAtTime(v, out.ctx.currentTime, 0.01)
  }

  // Detach from the shared AudioContext (it outlives this component).
  function close(): void {
    stop()
    out?.master.disconnect()
    out = null
  }

  return { close, setKit, setSwing, setVolume, start, stop, stopAt, trigger }
}
