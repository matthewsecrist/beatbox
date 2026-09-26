// Loop recording/playback against the synth's audio clock. Notes are scheduled
// LOOKAHEAD seconds ahead from a ~25 ms timer, so playback stays tight while the
// main thread is busy.
export const LOOKAHEAD = 0.1

// Records note on/off events relative to start(); held notes at start/finish are
// pinned to the loop edges so every "on" has a matching "off".
export function createRecorder(synth) {
  let start = 0
  let events = []

  return {
    start(held = []) {
      start = synth.now()
      events = held.map((midi) => ({ t: 0, midi, on: true }))
    },
    note(midi, on) {
      events.push({ t: round(synth.now() - start), midi, on })
    },
    // Returns { events, length } or null when nothing usable was recorded.
    finish() {
      const length = round(synth.now() - start)
      const held = new Set()
      for (const e of events) e.on ? held.add(e.midi) : held.delete(e.midi)
      for (const midi of held) events.push({ t: length, midi, on: false })
      if (length < 0.1 || !events.some((e) => e.on)) return null
      return { events, length }
    },
  }
}

// Plays one loop ({ events, length, params }) on voices keyed `${prefix}${midi}`.
export function createPlayer(synth, prefix, loop) {
  let playing = false
  let startTime = 0
  let cycleStart = 0
  let cursor = 0
  const sounding = new Set()

  return {
    get playing() {
      return playing
    },
    start() {
      playing = true
      startTime = cycleStart = synth.now() + 0.05
      cursor = 0
      this.tick()
    },
    // Schedules everything due before now + LOOKAHEAD; returns loop position 0..1.
    tick() {
      if (!playing || loop.events.length === 0) return 0
      const now = synth.now()
      for (;;) {
        const e = loop.events[cursor]
        const at = cycleStart + e.t
        if (at >= now + LOOKAHEAD) break
        const key = prefix + e.midi
        if (e.on) {
          synth.noteOn(e.midi, at, key, loop.params)
          sounding.add(key)
        } else {
          synth.noteOff(key, at)
          sounding.delete(key)
        }
        if (++cursor === loop.events.length) {
          cursor = 0
          cycleStart += loop.length
        }
      }
      return Math.max(0, (now - startTime) % loop.length) / loop.length
    },
    // Releases held loop notes and silences any note scheduled but not yet started,
    // including ones whose note-off was already scheduled inside the lookahead.
    stop() {
      if (!playing) return
      playing = false
      synth.cancelPending((key) => typeof key === "string" && key.startsWith(prefix))
      for (const key of sounding) synth.noteOff(key)
      sounding.clear()
    },
  }
}

const round = (s) => Math.round(s * 1000) / 1000
