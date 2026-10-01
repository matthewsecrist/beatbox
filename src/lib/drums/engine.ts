import type { Transport } from '../transport.js'
import type {
  DrumGrid,
  DrumStep,
  InstrumentId,
  KitId,
  StepLocks,
  TrackId,
  TrackLengths,
  VoiceTweak
} from '../types.js'

import { createCrusher, type Crusher, getContext, noiseBuffer } from '../audio.js'
import { transport as sharedTransport } from '../transport.js'
import { KIT_SOUNDS, TRACKS } from './kits.js'

// The straight 16th grid. A pattern can also be on 16th triplets (24 steps a
// bar) or 8th triplets (12): its rows then have that many steps.
export const STEPS = 16
export const GRIDS: DrumGrid[] = [16, 24, 12]

// A pattern's grid, from how many steps its rows have (none: 16ths).
export function gridOf(pattern: Partial<Record<TrackId, DrumStep[]>>): DrumGrid {
  const steps = Object.values(pattern).find((row) => row.length)?.length
  return GRIDS.find((grid) => grid === steps) ?? STEPS
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.1
const ACCENT = 1.4 // gain boost on accented steps
// At full humanize a hit lands up to this many seconds early or late, and up to
// this share softer or louder.
const HUMANIZE_TIME = 0.02
const HUMANIZE_GAIN = 0.3
// Square-wave pitches mixed for the 808's metallic hats and cymbals.
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]

export interface Drums {
  close(): void
  // The drums' own bitcrusher, 0-1 (0 = off).
  setCrush(amount: number): void
  setHumanize(amount: number): void
  setKit(kit: KitId, voices: Partial<Record<TrackId, VoiceTweak>>): void
  setSwing(swing: number): void
  setVolume(v: number): void
  start(patternFn: PatternFn, atBeat?: number, tag?: number): void
  stop(): void
  stopAt(beat: number): void
  // Plays a track now, with a step's locks if given.
  trigger(id: TrackId, locks?: StepLocks): void
}

const noop = (): void => undefined

// Returns the pattern to play and its track lengths (none: every track plays the
// whole bar); read on every step so edits are heard at once.
export type PatternFn = () => {
  lengths?: TrackLengths
  steps: Partial<Record<TrackId, DrumStep[]>>
}

// One hit as a voice plays it: when, how loud, and the voice's tune and decay.
interface Hit {
  gain: number
  len: number // decay multiplier
  pitch: number // frequency multiplier
  t: number
}

interface Output {
  // After the master volume, on the way out.
  crush: Crusher
  ctx: BaseAudioContext
  master: GainNode
  noise: AudioBuffer
}

// Schedules sounds slightly ahead on the audio clock ("A Tale of Two Clocks"),
// so timing stays tight even when the main thread stutters.
export function createDrums({
  // Which tracks are heard (mute and solo). Checked on every step; the pattern
  // itself stays whole, so its grid is known even with every track silenced.
  audible = () => true,
  getCtx = getContext,
  // Name it holds the transport under; a second engine (a preview) needs its own.
  id = 'drums',
  // Each kick the pattern plays, at its audio time and gain (the sidechain).
  onKick = noop,
  onPattern = noop,
  // Each step as it sounds: how many of its grid's steps since the start (a
  // track's step is that modulo its length); -1 once stopped.
  onStep,
  onStop = noop,
  // Where the drums play into (an effects channel); the speakers by default.
  output,
  random = Math.random,
  transport = sharedTransport
}: {
  audible?: (track: TrackId) => boolean
  getCtx?: () => BaseAudioContext
  id?: string
  onKick?: (at: number, level: number) => void
  onPattern?: (tag: number | undefined) => void
  onStep: (count: number) => void
  onStop?: () => void
  output?: () => AudioNode
  random?: () => number
  transport?: Pick<Transport, 'acquire' | 'nextBar' | 'release' | 'timeAt'>
}): Drums {
  let out: null | Output = null
  let timer: ReturnType<typeof setInterval> | undefined
  let raf = 0
  let volume = 0.8
  let crush = 0
  let kit: KitId = 'classic'
  let voices: Partial<Record<TrackId, VoiceTweak>> = {}
  let swing = 50
  let humanize = 0
  let running = false
  let nextBeat = 0 // step times come from the shared transport grid, 4 beats a bar
  let origin = 0 // the beat it started on: bars (and each grid's steps) count from it
  let endBeat = Infinity // set by stopAt(): no steps from this beat on
  let getPattern: PatternFn = () => ({ steps: {} })
  // Pattern switch waiting for its beat.
  let queued: null | { beat: number; fn: PatternFn; tag: number | undefined } = null
  // source -> start time; lets stop() silence lookahead hits
  const pending = new Map<AudioScheduledSourceNode, number>()
  const queue: { count: number; time: number }[] = []

  function ensureContext(): Output {
    if (!out) {
      const ctx = getCtx()
      const master = ctx.createGain()
      master.gain.value = volume
      const crusher = createCrusher(ctx, crush)
      master.connect(crusher.node).connect(output?.() ?? ctx.destination)
      out = { crush: crusher, ctx, master, noise: noiseBuffer(ctx) }
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

  // Square waves through one filter: the 808's metallic hats and cymbals, and its
  // cowbell. They all stop on the same sample, so whichever ends first can tear
  // down the shared filter and gain.
  function ring(
    h: Hit,
    pitches: number[],
    type: BiquadFilterType,
    freq: number,
    decay: number,
    peak: number
  ) {
    const output = ensureContext()
    const { ctx } = output
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq * h.pitch
    const g = env(output, h.t, peak * h.gain, decay * h.len)
    f.connect(g)
    for (const hz of pitches) {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = hz * h.pitch
      o.connect(f)
      play(o, h.t, decay * h.len, f, g)
    }
  }

  const metal = (h: Hit, freq: number, decay: number, peak: number) =>
    ring(h, METAL, 'highpass', freq, decay, peak)

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

  // Everything is synthesized; each instrument in the library is built here.
  const SOUNDS: Record<InstrumentId, (h: Hit) => void> = {
    '606-chat': (h) => {
      hiss(h, 'highpass', 10000, 0.03, 0.15)
      metal(h, 8500, 0.035, 0.1)
    },
    '606-clap': (h) => clap(h, 1600, [0, 0.008, 0.016], 0.12, 0.6),
    '606-kick': (h) => tone(h, 160, 55, 0.04, 0.22, 1),
    '606-ohat': (h) => {
      hiss(h, 'highpass', 10000, 0.2, 0.12)
      metal(h, 8500, 0.25, 0.08)
    },
    '606-snare': (h) => {
      tone(h, 240, 220, 0.02, 0.08, 0.3, 'triangle')
      hiss(h, 'highpass', 2500, 0.14, 0.55)
    },
    '606-tom': (h) => tone(h, 220, 160, 0.1, 0.25, 0.7),
    '808-chat': (h) => metal(h, 7500, 0.06, 0.12),
    '808-clap': (h) => clap(h, 1100, [0, 0.011, 0.022, 0.033], 0.3, 0.7),
    // A short, high sine: the 808's claves.
    '808-claves': (h) => tone(h, 2500, 2500, 0.001, 0.045, 0.5),
    // A tuned sine with a small drop, like the 808's congas.
    '808-conga': (h) => tone(h, 260, 235, 0.03, 0.24, 0.8),
    // Two squares a fifth-ish apart through a band-pass: a quick clank, then a ring.
    '808-cowbell': (h) => {
      ring(h, [540, 800], 'bandpass', 800, 0.06, 0.35)
      ring(h, [540, 800], 'bandpass', 800, 0.35, 0.15)
    },
    '808-crash': (h) => {
      metal(h, 5000, 1.6, 0.12)
      hiss(h, 'highpass', 6000, 1.4, 0.1)
    },
    '808-kick': (h) => tone(h, 110, 48, 0.08, 0.9, 1),
    '808-ohat': (h) => metal(h, 7500, 0.45, 0.1),
    '808-rim': (h) => {
      tone(h, 1700, 1700, 0.001, 0.025, 0.45, 'triangle')
      tone(h, 455, 455, 0.001, 0.035, 0.4, 'triangle')
      hiss(h, 'highpass', 5000, 0.01, 0.2)
    },
    '808-snare': (h) => {
      tone(h, 180, 180, 0.01, 0.12, 0.35, 'triangle')
      tone(h, 330, 330, 0.01, 0.08, 0.25, 'triangle')
      hiss(h, 'highpass', 1800, 0.18, 0.45)
    },
    '808-tom': (h) => tone(h, 130, 95, 0.3, 0.45, 0.8),
    '909-chat': (h) => {
      hiss(h, 'highpass', 9000, 0.04, 0.3)
      metal(h, 9000, 0.04, 0.06)
    },
    '909-clap': (h) => clap(h, 1300, [0, 0.013, 0.026], 0.22, 0.75),
    '909-crash': (h) => {
      hiss(h, 'highpass', 5000, 1.8, 0.3)
      metal(h, 7000, 1.2, 0.06)
    },
    '909-kick': (h) => {
      tone(h, 230, 52, 0.05, 0.4, 1)
      hiss(h, 'lowpass', 3000, 0.012, 0.4)
    },
    '909-ohat': (h) => {
      hiss(h, 'highpass', 9000, 0.3, 0.22)
      metal(h, 9000, 0.3, 0.05)
    },
    // A long metallic wash with a bell ping on top.
    '909-ride': (h) => {
      metal(h, 5500, 1.2, 0.07)
      hiss(h, 'highpass', 8000, 0.9, 0.05)
      tone(h, 3100, 3100, 0.001, 0.5, 0.06)
    },
    '909-rim': (h) => {
      tone(h, 500, 480, 0.005, 0.03, 0.4, 'triangle')
      hiss(h, 'bandpass', 3500, 0.02, 0.5)
    },
    '909-snare': (h) => {
      tone(h, 200, 175, 0.03, 0.1, 0.5, 'triangle')
      hiss(h, 'highpass', 800, 0.25, 0.75)
    },
    '909-tom': (h) => {
      tone(h, 190, 120, 0.12, 0.3, 0.8)
      hiss(h, 'bandpass', 600, 0.03, 0.2)
    },
    bongo: (h) => {
      tone(h, 420, 390, 0.02, 0.12, 0.7)
      hiss(h, 'bandpass', 2500, 0.008, 0.25)
    },
    'classic-chat': (h) => hiss(h, 'highpass', 7000, 0.05, 0.35),
    'classic-clap': (h) => clap(h, 1500, [0, 0.01, 0.02], 0.18, 0.7),
    'classic-kick': (h) => tone(h, 150, 40, 0.12, 0.45, 1),
    'classic-ohat': (h) => hiss(h, 'highpass', 7000, 0.35, 0.3),
    'classic-snare': (h) => {
      hiss(h, 'highpass', 1000, 0.2, 0.6)
      tone(h, 220, 160, 0.05, 0.1, 0.4, 'triangle')
    },
    'classic-tom': (h) => tone(h, 140, 80, 0.2, 0.35, 0.8),
    // Lo-fi: dull and dusty, with band-limited noise and soft transients.
    'lofi-chat': (h) => hiss(h, 'bandpass', 5000, 0.04, 0.3),
    'lofi-clap': (h) => clap(h, 900, [0, 0.012, 0.024], 0.15, 0.5),
    'lofi-conga': (h) => {
      tone(h, 220, 200, 0.04, 0.2, 0.7, 'triangle')
      hiss(h, 'bandpass', 900, 0.02, 0.2)
    },
    'lofi-cowbell': (h) => {
      tone(h, 560, 560, 0.001, 0.2, 0.3, 'triangle')
      tone(h, 835, 835, 0.001, 0.2, 0.2, 'triangle')
    },
    'lofi-crash': (h) => hiss(h, 'bandpass', 5000, 1.4, 0.25),
    'lofi-kick': (h) => {
      tone(h, 120, 45, 0.1, 0.35, 1)
      hiss(h, 'lowpass', 400, 0.03, 0.25)
    },
    'lofi-ohat': (h) => hiss(h, 'bandpass', 5000, 0.25, 0.22),
    'lofi-ride': (h) => ring(h, METAL, 'bandpass', 6000, 0.9, 0.07),
    'lofi-rim': (h) => {
      tone(h, 600, 580, 0.005, 0.04, 0.35, 'triangle')
      hiss(h, 'bandpass', 2000, 0.025, 0.35)
    },
    'lofi-shaker': (h) => hiss(h, 'bandpass', 4500, 0.06, 0.25),
    'lofi-snap': (h) => hiss(h, 'bandpass', 1800, 0.04, 0.55),
    'lofi-snare': (h) => {
      tone(h, 190, 160, 0.04, 0.12, 0.35, 'triangle')
      hiss(h, 'bandpass', 1800, 0.16, 0.5)
    },
    'lofi-tom': (h) => tone(h, 110, 75, 0.2, 0.4, 0.8, 'triangle'),
    // Two overlapping grains of bright noise, so it swishes rather than clicks.
    shaker: (h) => {
      hiss(h, 'highpass', 6000, 0.05, 0.18)
      hiss(h, 'bandpass', 8000, 0.07, 0.22, 0.01)
    },
    // A sharp crack of band-passed noise with a tiny pitched click.
    snap: (h) => {
      hiss(h, 'bandpass', 2600, 0.035, 0.8)
      hiss(h, 'highpass', 5000, 0.01, 0.4)
      tone(h, 1600, 1200, 0.01, 0.015, 0.25, 'triangle')
    },
    // Trap: a long 808 boom, crisp hats for ratchet rolls.
    'trap-chat': (h) => metal(h, 10000, 0.03, 0.12),
    'trap-clap': (h) => clap(h, 1200, [0, 0.009, 0.018, 0.027], 0.35, 0.8),
    'trap-kick': (h) => {
      tone(h, 90, 40, 0.15, 1.6, 1)
      hiss(h, 'lowpass', 4000, 0.01, 0.3)
    },
    'trap-ohat': (h) => metal(h, 10000, 0.35, 0.1),
    'trap-snare': (h) => {
      tone(h, 230, 190, 0.02, 0.1, 0.4, 'triangle')
      hiss(h, 'highpass', 1500, 0.14, 0.8)
    },
    'trap-tom': (h) => tone(h, 160, 60, 0.35, 0.6, 0.8),
    woodblock: (h) => {
      tone(h, 1100, 1000, 0.005, 0.06, 0.6)
      hiss(h, 'bandpass', 1800, 0.01, 0.2)
    }
  }

  // The track's own library pick, or else its kit's sound. A step's locks replace
  // its voice's tune and decay for this hit.
  function hit(id: TrackId, t: number, gain: number, locks: StepLocks = {}) {
    const v = voices[id]
    SOUNDS[v?.sound ?? KIT_SOUNDS[kit][id]]({
      gain,
      len: locks.decay ?? v?.decay ?? 1,
      pitch: 2 ** ((locks.tune ?? v?.tune ?? 0) / 12),
      t
    })
  }

  // A random amount between -max and max, scaled by humanize. Only called with
  // humanize on, so it leaves `random` alone for Chance otherwise.
  const drift = (max: number) => (random() * 2 - 1) * humanize * max

  // Beats after the straight grid that `step` lands: swing delays every second
  // 16th, on the 16th grid only.
  const late = (step: number, steps: number) =>
    steps === STEPS && step % 2 ? ((swing - 50) / 100) * (8 / STEPS) : 0

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
      const { lengths = {}, steps: pattern } = getPattern()
      // Which step of the pattern's grid this is, counted from its bar line. After
      // the grid changes mid-bar, the next beat may sit between the new grid's
      // lines: it moves on to the next one.
      const steps = gridOf(pattern)
      const bar = origin + Math.floor((nextBeat - origin) / 4 + 1e-9) * 4
      const exact = ((nextBeat - bar) * steps) / 4
      const step = Math.round(exact)
      if (Math.abs(exact - step) > 1e-6) {
        nextBeat = bar + (Math.ceil(exact) * 4) / steps
        continue
      }
      // Steps of this grid since the start: each track loops over its own length
      // from there (polymeter), while patterns still change on the bar line.
      const count = Math.round((bar - origin) / 4) * steps + step
      // A ratcheted step spreads its hits up to where the next step lands.
      const from = nextBeat + late(step, steps)
      const span = nextBeat + 4 / steps + late(step + 1, steps) - from
      for (const { id } of TRACKS) {
        const hitStep = pattern[id]?.[count % Math.min(lengths[id] ?? steps, steps)]
        if (!hitStep?.on || !audible(id) || hitStep.velocity <= 0) continue
        if (random() >= hitStep.probability) continue
        const gain = hitStep.velocity * (hitStep.accent ? ACCENT : 1)
        // A step's ratchet hits drift together so they stay in order, never
        // earlier than now; each has its own velocity.
        const dt = humanize ? Math.max(drift(HUMANIZE_TIME), Math.min(0, ctx.currentTime - t)) : 0
        for (let r = 0; r < hitStep.ratchet; r++) {
          const at = transport.timeAt(from + (span * r) / hitStep.ratchet) + dt
          const level = humanize ? gain * (1 + drift(HUMANIZE_GAIN)) : gain
          hit(id, at, level, hitStep)
          if (id === 'kick') onKick(at, level)
        }
      }
      queue.push({ count, time: t })
      // From the bar line, so a triplet grid's thirds don't add up rounding errors.
      nextBeat = bar + ((step + 1) * 4) / steps
    }
  }

  function draw() {
    const { ctx } = ensureContext()
    for (let next = queue[0]; next && next.time <= ctx.currentTime; next = queue[0]) {
      queue.shift()
      onStep(next.count)
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
    transport.acquire(id)
    running = true
    getPattern = patternFn
    queued = null
    onPattern(tag)
    nextBeat = atBeat ?? transport.nextBar()
    origin = nextBeat
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
    transport.release(id)
    onStep(-1)
    onStop()
  }

  function trigger(id: TrackId, locks?: StepLocks): void {
    hit(id, ensureContext().ctx.currentTime, 1, locks)
  }

  function setKit(next: KitId, tweaks: Partial<Record<TrackId, VoiceTweak>>): void {
    kit = next
    voices = tweaks
  }

  function setCrush(amount: number): void {
    crush = amount
    out?.crush.set(amount)
  }

  function setHumanize(amount: number): void {
    humanize = amount
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
    out?.crush.node.disconnect()
    out = null
  }

  return { close, setCrush, setHumanize, setKit, setSwing, setVolume, start, stop, stopAt, trigger }
}

// Whether a track (a drum, or a whole instrument) sounds: with any track soloed
// only the soloed ones play (solo wins over mute), otherwise every unmuted one.
export function isAudible<T>(id: T, muted: ReadonlySet<T>, soloed: ReadonlySet<T>): boolean {
  return soloed.size > 0 ? soloed.has(id) : !muted.has(id)
}
