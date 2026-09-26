// Run: node --test assets/svelte/synth/
import { test } from "node:test"
import assert from "node:assert/strict"
import { createSynth } from "./engine.js"
import { createPlayer, createRecorder } from "./looper.js"
import { createTransport } from "../transport.js"

const OSCS_PER_VOICE = 3 // osc1, osc2, filter LFO; osc1 of voice n is oscs[n * 3]

// Minimal AudioContext stand-in with a hand-driven clock; records oscillator
// start/stop so we can see what would actually sound.
function fakeAudio() {
  const clock = { now: 0 }
  const oscs = []
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
    setTargetAtTime() {},
  })
  const node = (extra = {}) => ({
    gain: param(),
    frequency: param(),
    detune: param(),
    Q: param(),
    connect: (n) => n,
    disconnect() {
      this.disconnected = true
    },
    ...extra,
  })
  const ctx = {
    state: "running",
    destination: {},
    get currentTime() {
      return clock.now
    },
    createGain: () => node(),
    createBiquadFilter: () => node(),
    createOscillator() {
      const o = node({
        start(t) {
          o.startAt = t
        },
        stop(t) {
          o.stopAt = t
        },
      })
      oscs.push(o)
      return o
    },
  }
  const getCtx = () => ctx
  const transport = createTransport(getCtx)
  transport.setBpm(120) // 0.5 s per beat, 2 s per bar
  return { clock, oscs, transport, synth: createSynth({}, getCtx) }
}

// Synth stand-in that records scheduled notes as [kind, midi|key, time].
function spySynth() {
  const calls = []
  return {
    calls,
    noteOn: (midi, at) => calls.push(["on", midi, +at.toFixed(3)]),
    noteOff: (_key, at) => calls.push(["off", +at.toFixed(3)]),
    cancelPending() {},
  }
}

// One bar at 120 BPM: note on at the downbeat, off on beat 3.
const oneBar = { length: 2, bpm: 120, params: {}, events: [{ t: 0, midi: 60, on: true }, { t: 1, midi: 60, on: false }] }

test("tempo changes keep the current beat position", () => {
  const { clock, transport } = fakeAudio()
  transport.acquire("x") // grid starts at 0.05 s
  clock.now = 1.05 // beat 2 at 120 BPM
  transport.setBpm(60)

  assert.equal(transport.beatAt(1.05), 2)
  assert.equal(transport.timeAt(4), 3.05) // two more beats at 1 s each
  assert.equal(transport.nextBar(), 4)

  transport.release("x")
  assert.equal(transport.running, false)
})

test("player repeats the loop on the beat grid", () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  const player = createPlayer(synth, "pad0:", oneBar, transport)

  player.start() // first user: grid (and loop) start at 0.05 s
  clock.now = 2
  player.tick()

  assert.deepEqual(synth.calls, [["on", 60, 0.05], ["off", 1.05], ["on", 60, 2.05]])
})

test("a pad started mid-bar waits for the next bar line", () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  transport.acquire("drums")
  clock.now = 0.8 // beat 1.5

  const player = createPlayer(synth, "pad0:", oneBar, transport)
  player.start()
  assert.deepEqual(synth.calls, [])

  clock.now = 2
  player.tick()
  assert.deepEqual(synth.calls, [["on", 60, 2.05]]) // bar 2 = beat 4
})

test("loops follow tempo changes", () => {
  const { clock, transport } = fakeAudio()
  const synth = spySynth()
  const player = createPlayer(synth, "pad0:", oneBar, transport)
  player.start()

  clock.now = 0.3 // beat 0.5
  transport.setBpm(60)
  clock.now = 1.75
  player.tick()

  // Note-off is on beat 2: 1.5 beats after the change at 1 s per beat.
  assert.deepEqual(synth.calls, [["on", 60, 0.05], ["off", 1.8]])
})

test("stop silences loop notes already scheduled inside the lookahead, but not live notes", () => {
  const { clock, oscs, transport, synth } = fakeAudio()
  synth.noteOn(60) // live note, key 60
  const loop = { ...oneBar, events: [{ t: 0.01, midi: 64, on: true }, { t: 0.03, midi: 64, on: false }] }
  const player = createPlayer(synth, "pad1:", loop, transport)
  player.start() // note-on at 0.06 and note-off at 0.08 both scheduled now

  const [liveOsc, loopOsc] = [oscs[0], oscs[OSCS_PER_VOICE]]
  assert.equal(+loopOsc.startAt.toFixed(3), 0.06)

  clock.now = 0.02
  player.stop()

  assert.ok(loopOsc.stopAt <= loopOsc.startAt, "pending loop note never starts")
  assert.equal(liveOsc.stopAt, undefined, "live note keeps sounding")
})

test("stopping one pad leaves another pad on the same pitch playing", () => {
  const { clock, oscs, transport, synth } = fakeAudio()
  const loop = { ...oneBar, events: [{ t: 0.01, midi: 60, on: true }, { t: 1.5, midi: 60, on: false }] }
  const pad0 = createPlayer(synth, "pad0:", loop, transport)
  const pad1 = createPlayer(synth, "pad1:", loop, transport)
  pad0.start()
  pad1.start() // both note-ons scheduled at 0.06, not yet started
  const [osc0, osc1] = [oscs[0], oscs[OSCS_PER_VOICE]]

  clock.now = 0.02
  pad0.stop()

  assert.ok(osc0.stopAt <= osc0.startAt, "stopped pad's pending note never starts")
  assert.equal(osc1.stopAt, undefined, "other pad's note still scheduled")
  assert.equal(transport.running, true, "the other pad keeps the transport running")

  clock.now = 0.3
  pad1.tick()
  pad0.tick()
  assert.equal(oscs.length, 2 * OSCS_PER_VOICE, "stopped pad schedules nothing further")
})

test("recorder counts in, rounds the take to whole bars and closes held notes", () => {
  const { clock, transport } = fakeAudio()
  const rec = createRecorder(transport)
  transport.acquire("rec") // grid starts at 0.05 s
  rec.start([48], 4) // 48 held; take starts after a one-bar count-in (beat 4 = 2.05 s)

  clock.now = 1.0 // still counting in: lands on beat 0 of the take
  rec.note(60, true)
  clock.now = 2.55 // take beat 1
  rec.note(48, false)
  clock.now = 6.05 // take beat 8: starts past the rounded end, dropped
  rec.note(64, true)
  clock.now = 6.3 // 8.5 beats in -> rounds to 2 bars (8 beats = 4 s)

  assert.deepEqual(rec.finish(), {
    length: 4,
    bpm: 120,
    events: [
      { t: 0, midi: 48, on: true },
      { t: 0, midi: 60, on: true },
      { t: 0.5, midi: 48, on: false },
      { t: 4, midi: 60, on: false },
    ],
  })

  rec.start([], 12)
  clock.now = 7 // still in the count-in
  assert.equal(rec.finish(), null)
})
