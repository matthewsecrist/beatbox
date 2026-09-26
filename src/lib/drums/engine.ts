import type { Transport } from '../transport.js'
import type { TrackId } from '../types.js'

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

export const STEPS = 16
const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.1

export interface Drums {
  close(): void
  setVolume(v: number): void
  start(patternFn: PatternFn, atBeat?: number, tag?: number): void
  stop(): void
  stopAt(beat: number): void
  trigger(id: TrackId): void
}

const noop = (): void => undefined

// Returns the pattern to play; read on every step so edits are heard at once.
export type PatternFn = () => Partial<Record<TrackId, boolean[]>>

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
  transport = sharedTransport
}: {
  getCtx?: () => BaseAudioContext
  onPattern?: (tag: number | undefined) => void
  onStep: (step: number) => void
  onStop?: () => void
  transport?: Pick<Transport, 'acquire' | 'nextBar' | 'release' | 'timeAt'>
}): Drums {
  let out: null | Output = null
  let timer: ReturnType<typeof setInterval> | undefined
  let raf = 0
  let volume = 0.8
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
    t: number,
    from: number,
    to: number,
    sweep: number,
    decay: number,
    peak: number,
    type: OscillatorType = 'sine'
  ) {
    const o = ensureContext().ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(to, t + sweep)
    const g = env(ensureContext(), t, peak, decay)
    o.connect(g)
    play(o, t, decay, g)
  }

  function hiss(t: number, type: BiquadFilterType, freq: number, decay: number, peak: number) {
    const output = ensureContext()
    const { ctx } = output
    const src = ctx.createBufferSource()
    src.buffer = output.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = env(output, t, peak, decay)
    src.connect(f).connect(g)
    play(src, t, decay, f, g)
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

  const VOICES: Record<TrackId, (t: number) => void> = {
    chat: (t) => hiss(t, 'highpass', 7000, 0.05, 0.35),
    clap: (t) => {
      for (const dt of [0, 0.01, 0.02]) hiss(t + dt, 'bandpass', 1500, 0.02, 0.7)
      hiss(t + 0.03, 'bandpass', 1500, 0.18, 0.7)
    },
    kick: (t) => tone(t, 150, 40, 0.12, 0.45, 1),
    ohat: (t) => hiss(t, 'highpass', 7000, 0.35, 0.3),
    snare: (t) => {
      hiss(t, 'highpass', 1000, 0.2, 0.6)
      tone(t, 220, 160, 0.05, 0.1, 0.4, 'triangle')
    },
    tom: (t) => tone(t, 140, 80, 0.2, 0.35, 0.8)
  }

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
      for (const { id } of TRACKS) if (pattern[id]?.[nextStep]) VOICES[id](t)
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
    VOICES[id](ensureContext().ctx.currentTime)
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

  return { close, setVolume, start, stop, stopAt, trigger }
}
