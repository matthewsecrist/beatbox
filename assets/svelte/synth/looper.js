import { BEATS_PER_BAR } from "../transport.js"

// Loop recording/playback on the shared transport's beat grid. Notes are
// scheduled LOOKAHEAD seconds ahead from a ~25 ms timer, so playback stays tight
// while the main thread is busy. Loops are stored in seconds plus the tempo they
// were recorded at (`bpm`); playback converts to beats, so loops follow tempo
// changes and stay locked to the drums.
export const LOOKAHEAD = 0.1
const LATE_PRESS = 0.25 // beats (a 16th note)

// Records note on/off events from `startBeat` (a bar line; notes played during a
// count-in land on beat 0). finish() rounds the take to whole bars, drops notes
// that start past the end and closes any still held at the loop edge.
export function createRecorder(transport) {
  let startBeat = 0
  let events = []

  return {
    start(held = [], fromBeat = transport.nextBar()) {
      startBeat = fromBeat
      events = held.map((midi) => ({ beat: 0, midi, on: true }))
    },
    // Beat the take starts on (the count-in ends here).
    get startBeat() {
      return startBeat
    },
    note(midi, on) {
      events.push({ beat: Math.max(0, transport.beatAt(transport.now()) - startBeat), midi, on })
    },
    // Returns { events, length, bpm } (times in seconds at `bpm`), or null when
    // nothing usable was recorded (still counting in, or no notes).
    finish() {
      const elapsed = transport.beatAt(transport.now()) - startBeat
      if (elapsed <= 0) return null
      // Round to the nearest bar (a slightly late or early press lands on the bar
      // meant), but extend to keep notes deliberately played past that point. A note
      // within a 16th after the boundary is a late press on the next downbeat and
      // belongs to the next cycle.
      const rounded = Math.max(1, Math.round(elapsed / BEATS_PER_BAR)) * BEATS_PER_BAR
      const lastOn = Math.max(-1, ...events.filter((e) => e.on).map((e) => e.beat))
      const beats =
        lastOn >= rounded + LATE_PRESS ? Math.floor(lastOn / BEATS_PER_BAR + 1) * BEATS_PER_BAR : rounded
      const kept = []
      const held = new Set()
      for (const e of events) {
        if (e.beat >= beats) continue
        kept.push(e)
        e.on ? held.add(e.midi) : held.delete(e.midi)
      }
      for (const midi of held) kept.push({ beat: beats, midi, on: false })
      if (!kept.some((e) => e.on)) return null
      const sec = (b) => round((b * 60) / transport.bpm)
      return {
        events: kept.map((e) => ({ t: sec(e.beat), midi: e.midi, on: e.on })),
        length: sec(beats),
        bpm: transport.bpm,
      }
    },
  }
}

// Plays one loop ({ events, length, params, bpm }) on voices keyed `${prefix}${midi}`,
// from a bar line. Loops saved before tempo sync have no `bpm`; they're taken to be
// at the tempo in effect when they start.
export function createPlayer(synth, prefix, loop, transport) {
  let lengthBeats = 0
  let events = []
  let playing = false
  let startBeat = 0
  let cycleStart = 0
  let cursor = 0
  let endBeat = Infinity // set by stopAt(); playback ends exactly on this beat
  const sounding = new Set()

  function finish() {
    for (const key of sounding) synth.noteOff(key, transport.timeAt(endBeat))
    sounding.clear()
    playing = false
    transport.release(prefix)
  }

  return {
    get playing() {
      return playing
    },
    // Starts at `atBeat` (default: next bar line). Already playing: just cancels a
    // pending stopAt(), so the loop keeps its phase.
    start(atBeat = transport.nextBar()) {
      endBeat = Infinity
      if (playing) return
      const toBeats = (loop.bpm ?? transport.bpm) / 60
      lengthBeats = loop.length * toBeats
      events = loop.events.map((e) => ({ ...e, beat: e.t * toBeats }))
      transport.acquire(prefix)
      playing = true
      startBeat = cycleStart = atBeat
      cursor = 0
      this.tick()
    },
    // Stops on `beat` (a section boundary): notes before it still play, anything
    // held is released exactly on it.
    stopAt(beat) {
      if (playing) endBeat = beat
    },
    // Schedules everything due before now + LOOKAHEAD; returns loop position 0..1.
    tick() {
      if (!playing || events.length === 0) return 0
      const now = transport.now()
      for (;;) {
        const e = events[cursor]
        const beat = cycleStart + e.beat
        if (beat >= endBeat) {
          if (transport.timeAt(endBeat) < now + LOOKAHEAD) finish()
          break
        }
        const at = transport.timeAt(beat)
        if (at >= now + LOOKAHEAD) break
        const key = prefix + e.midi
        if (e.on) {
          synth.noteOn(e.midi, at, key, loop.params)
          sounding.add(key)
        } else {
          synth.noteOff(key, at)
          sounding.delete(key)
        }
        if (++cursor === events.length) {
          cursor = 0
          cycleStart += lengthBeats
        }
      }
      const into = transport.beatAt(now) - startBeat
      return !playing || into <= 0 ? 0 : (into % lengthBeats) / lengthBeats
    },
    // Stops now: releases held loop notes and silences any note scheduled but not
    // yet started, including ones whose note-off was already scheduled.
    stop() {
      if (!playing) return
      playing = false
      synth.cancelPending((key) => typeof key === "string" && key.startsWith(prefix))
      for (const key of sounding) synth.noteOff(key)
      sounding.clear()
      transport.release(prefix)
    },
  }
}

const round = (s) => Math.round(s * 1000) / 1000
