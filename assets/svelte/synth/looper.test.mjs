// Run: node --test assets/svelte/synth/
import { test } from "node:test"
import assert from "node:assert/strict"
import { createSynth } from "./engine.js"
import { createPlayer, createRecorder } from "./looper.js"

// Minimal AudioContext stand-in with a hand-driven clock; records oscillator
// start/stop and amp disconnects so we can see what would actually sound.
function fakeAudio() {
  const clock = { now: 0 }
  const oscs = []
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
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
  globalThis.AudioContext = class {
    state = "running"
    destination = {}
    get currentTime() {
      return clock.now
    }
    createGain() {
      return node()
    }
    createBiquadFilter() {
      return node()
    }
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
    }
  }
  return { clock, oscs }
}

test("player schedules notes on the audio clock across loop cycles", () => {
  const { clock } = fakeAudio()
  const synth = createSynth({})
  const calls = []
  const spy = {
    now: () => synth.now(),
    noteOn: (midi, at, key, own) => calls.push(["on", midi, +at.toFixed(3), key, own.osc1_wave]),
    noteOff: (key, at) => calls.push(["off", key, +at.toFixed(3)]),
    cancelPending() {},
  }
  const loop = {
    length: 0.2,
    params: { osc1_wave: "sine" },
    events: [
      { t: 0, midi: 60, on: true },
      { t: 0.1, midi: 60, on: false },
    ],
  }
  const player = createPlayer(spy, "pad0:", loop)
  player.start() // loop starts at 0.05
  clock.now = 0.2
  player.tick() // horizon 0.3: covers first cycle and the next cycle's note-on

  assert.deepEqual(calls, [
    ["on", 60, 0.05, "pad0:60", "sine"],
    ["off", "pad0:60", 0.15],
    ["on", 60, 0.25, "pad0:60", "sine"],
  ])
})

test("stop silences loop notes already scheduled inside the lookahead, but not live notes", () => {
  const { clock, oscs } = fakeAudio()
  const synth = createSynth({})
  synth.noteOn(60) // live note, key 60
  const loop = {
    length: 1,
    params: {},
    events: [
      { t: 0.01, midi: 64, on: true },
      { t: 0.03, midi: 64, on: false },
    ],
  }
  const player = createPlayer(synth, "pad1:", loop)
  player.start() // note-on at 0.06 and note-off at 0.08 both scheduled now

  const [liveOsc, loopOsc] = [oscs[0], oscs[2]]
  assert.equal(+loopOsc.startAt.toFixed(3), 0.06)

  clock.now = 0.02
  player.stop()

  assert.ok(loopOsc.stopAt <= loopOsc.startAt, "pending loop note never starts")
  assert.equal(liveOsc.stopAt, undefined, "live note keeps sounding")
})

test("stopping one pad leaves another pad on the same pitch playing", () => {
  const { clock, oscs } = fakeAudio()
  const synth = createSynth({})
  const loop = { length: 1, params: {}, events: [{ t: 0.01, midi: 60, on: true }, { t: 0.5, midi: 60, on: false }] }
  const pad0 = createPlayer(synth, "pad0:", loop)
  const pad1 = createPlayer(synth, "pad1:", loop)
  pad0.start()
  pad1.start() // both note-ons scheduled at 0.06, not yet started
  const [osc0, osc1] = [oscs[0], oscs[2]]

  clock.now = 0.02
  pad0.stop()

  assert.ok(osc0.stopAt <= osc0.startAt, "stopped pad's pending note never starts")
  assert.equal(osc1.stopAt, undefined, "other pad's note still scheduled")

  clock.now = 0.3
  pad1.tick()
  pad0.tick()
  assert.equal(oscs.length, 4, "stopped pad schedules nothing further")
})

test("recorder pins held notes to the loop edges and rejects empty takes", () => {
  const { clock } = fakeAudio()
  const synth = createSynth({})
  const rec = createRecorder(synth)

  rec.start([48]) // 48 already held when recording starts
  clock.now = 0.5
  rec.note(60, true)
  clock.now = 1
  rec.note(48, false)
  clock.now = 2
  assert.deepEqual(rec.finish(), {
    length: 2,
    events: [
      { t: 0, midi: 48, on: true },
      { t: 0.5, midi: 60, on: true },
      { t: 1, midi: 48, on: false },
      { t: 2, midi: 60, on: false },
    ],
  })

  rec.start()
  clock.now = 3
  assert.equal(rec.finish(), null)
})
