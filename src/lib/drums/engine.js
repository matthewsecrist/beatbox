import { getContext } from "../audio.js"
import { transport as sharedTransport } from "../transport.js"

export const TRACKS = [
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare" },
  { id: "clap", label: "Clap" },
  { id: "chat", label: "Closed Hat" },
  { id: "ohat", label: "Open Hat" },
  { id: "tom", label: "Tom" },
]

export const STEPS = 16
const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.1

// Schedules sounds slightly ahead on the audio clock ("A Tale of Two Clocks"),
// so timing stays tight even when the main thread stutters.
export function createDrums({
  onStep,
  onStop = () => {},
  onPattern = () => {},
  transport = sharedTransport,
  getCtx = getContext,
}) {
  let ctx, master, noise, timer, raf
  let volume = 0.8
  let running = false
  let nextStep = 0
  let nextBeat = 0 // step times come from the shared transport grid (4 steps per beat)
  let endBeat = Infinity // set by stopAt(): no steps from this beat on
  let getPattern = () => ({})
  let queued = null // { fn, beat, tag }: pattern switch waiting for its beat
  const pending = new Map() // source -> start time; lets stop() silence lookahead hits
  const queue = []

  function ensureContext() {
    ctx = getCtx()
    if (!master) {
      master = ctx.createGain()
      master.gain.value = volume
      master.connect(ctx.destination)
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
  }

  function env(t, peak, decay) {
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + decay)
    g.connect(master)
    return g
  }

  function tone(t, from, to, sweep, decay, peak, type = "sine") {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(to, t + sweep)
    const g = env(t, peak, decay)
    o.connect(g)
    play(o, t, decay, g)
  }

  function hiss(t, type, freq, decay, peak) {
    const src = ctx.createBufferSource()
    src.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = env(t, peak, decay)
    src.connect(f).connect(g)
    play(src, t, decay, f, g)
  }

  function play(src, t, decay, ...nodes) {
    pending.set(src, t)
    src.onended = () => {
      pending.delete(src)
      for (const n of [src, ...nodes]) n.disconnect()
    }
    src.start(t)
    src.stop(t + decay + 0.05)
  }

  const VOICES = {
    kick: (t) => tone(t, 150, 40, 0.12, 0.45, 1),
    snare: (t) => {
      hiss(t, "highpass", 1000, 0.2, 0.6)
      tone(t, 220, 160, 0.05, 0.1, 0.4, "triangle")
    },
    clap: (t) => {
      for (const dt of [0, 0.01, 0.02]) hiss(t + dt, "bandpass", 1500, 0.02, 0.7)
      hiss(t + 0.03, "bandpass", 1500, 0.18, 0.7)
    },
    chat: (t) => hiss(t, "highpass", 7000, 0.05, 0.35),
    ohat: (t) => hiss(t, "highpass", 7000, 0.35, 0.3),
    tom: (t) => tone(t, 140, 80, 0.2, 0.35, 0.8),
  }

  function schedule() {
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
    while (queue.length && queue[0].time <= ctx.currentTime) onStep(queue.shift().step)
    raf = requestAnimationFrame(draw)
  }

  // Starts at `atBeat` (default: next bar line, or at once if nothing else is
  // playing). Already running: cancels a pending stopAt() and switches to this
  // pattern on `atBeat` (default: next bar). `tag` is reported via onPattern when
  // the pattern takes over.
  function start(patternFn, atBeat, tag) {
    endBeat = Infinity
    if (running) {
      queued = { fn: patternFn, beat: atBeat ?? transport.nextBar(), tag }
      return
    }
    ensureContext()
    transport.acquire("drums")
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
  function stopAt(beat) {
    if (running) endBeat = beat
  }

  function stop() {
    if (!running) return
    running = false
    clearInterval(timer)
    cancelAnimationFrame(raf)
    queue.length = 0
    for (const [src, t] of pending) if (t > ctx.currentTime) src.disconnect()
    transport.release("drums")
    onStep(-1)
    onStop()
  }

  function trigger(id) {
    ensureContext()
    VOICES[id](ctx.currentTime)
  }

  function setVolume(v) {
    volume = v
    if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.01)
  }

  // Detach from the shared AudioContext (it outlives this component).
  function close() {
    stop()
    master?.disconnect()
    master = null
  }

  return { start, stop, stopAt, trigger, setVolume, close }
}
