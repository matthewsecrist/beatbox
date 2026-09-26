// Run: node --test assets/svelte/
import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { createDrums } from "./engine.js"
import { createTransport } from "../transport.js"

// AudioContext stand-in: records when each kick (a 150 Hz sweep) starts.
function fakeAudio() {
  const clock = { currentTime: 0 }
  const kicks = []
  const param = (onSet = () => {}) => ({
    value: 0,
    setValueAtTime: onSet,
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  })
  const node = () => ({ gain: param(), frequency: param(), connect: (n) => n, disconnect() {} })
  const ctx = {
    destination: {},
    sampleRate: 100,
    get currentTime() {
      return clock.currentTime
    },
    createGain: node,
    createBiquadFilter: node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    createBufferSource: () => ({ ...node(), start() {}, stop() {} }),
    createOscillator() {
      let hz = 0
      return {
        ...node(),
        frequency: param((v) => (hz ||= v)),
        start: (t) => hz === 150 && kicks.push(+t.toFixed(3)),
        stop() {},
      }
    },
  }
  return { clock, kicks, getCtx: () => ctx }
}

test("a queued pattern switch takes over exactly on its bar", () => {
  mock.timers.enable({ apis: ["setInterval"] })
  globalThis.requestAnimationFrame ??= () => 0
  globalThis.cancelAnimationFrame ??= () => {}
  try {
    const { clock, kicks, getCtx } = fakeAudio()
    const transport = createTransport(getCtx)
    transport.setBpm(120) // 16th = 0.125 s, bar = 2 s
    const playing = []
    const drums = createDrums({ onStep() {}, onPattern: (tag) => playing.push(tag), transport, getCtx })
    const kickOn = (step) => () => ({ kick: Array.from({ length: 16 }, (_, i) => i === step) })

    drums.start(kickOn(0), 0, "A") // grid starts at 0.05 s
    drums.start(kickOn(8), 4, "B") // switch on bar 2 (beat 4 = 2.05 s)

    clock.currentTime = 4.2
    mock.timers.tick(25)
    drums.stop()

    // A's downbeat in bar 1, then B's step 9 in bar 2 (2.05 + 1 s); nothing from A in bar 2.
    assert.deepEqual(kicks, [0.05, 3.05])
    assert.deepEqual(playing, ["A", "B"])
  } finally {
    mock.timers.reset()
  }
})
