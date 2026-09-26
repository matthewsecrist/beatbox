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
export function createDrums({ onStep }) {
  let ctx, master, noise, timer, raf
  let volume = 0.8
  let bpm = 110
  let nextStep = 0
  let nextTime = 0
  let getPattern = () => ({})
  const pending = new Map() // source -> start time; lets stop() silence lookahead hits
  const queue = []

  function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = volume
      master.connect(ctx.destination)
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    if (ctx.state === "suspended") ctx.resume()
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
    while (nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const pattern = getPattern()
      for (const { id } of TRACKS) if (pattern[id]?.[nextStep]) VOICES[id](nextTime)
      queue.push({ step: nextStep, time: nextTime })
      nextTime += 60 / bpm / 4
      nextStep = (nextStep + 1) % STEPS
    }
  }

  function draw() {
    while (queue.length && queue[0].time <= ctx.currentTime) onStep(queue.shift().step)
    raf = requestAnimationFrame(draw)
  }

  function start(patternFn) {
    ensureContext()
    getPattern = patternFn
    nextStep = 0
    nextTime = ctx.currentTime + 0.05
    schedule()
    timer = setInterval(schedule, LOOKAHEAD_MS)
    raf = requestAnimationFrame(draw)
  }

  function stop() {
    clearInterval(timer)
    cancelAnimationFrame(raf)
    queue.length = 0
    for (const [src, t] of pending) if (t > ctx.currentTime) src.disconnect()
    onStep(-1)
  }

  function trigger(id) {
    ensureContext()
    VOICES[id](ctx.currentTime)
  }

  function setBpm(v) {
    bpm = v
  }

  function setVolume(v) {
    volume = v
    if (ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.01)
  }

  return { start, stop, trigger, setBpm, setVolume }
}
