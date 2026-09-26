// Run: node --test assets/svelte/
import { test } from "node:test"
import assert from "node:assert/strict"
import { createArranger } from "./arranger.js"
import { createTransport } from "./transport.js"

test("sections play back to back, announced ahead of each boundary, then stop", () => {
  const clock = { currentTime: 0 }
  const transport = createTransport(() => clock)
  transport.setBpm(120) // 2 s per bar
  const scenes = []
  let ended = false
  const arranger = createArranger({ transport, onScene: (s) => scenes.push(s), onEnd: () => (ended = true) })

  const position = arranger.start([
    { bars: 1, pads: [0], drums: true },
    { bars: 2, pads: [1], drums: false },
  ]) // grid starts at 0.05 s: boundaries at beats 0, 4, 12

  assert.deepEqual(position, { index: 0, bar: 1 })
  assert.deepEqual(scenes, [{ index: 0, beat: 0, pads: [0], drums: true }])

  clock.currentTime = 1.96 // section 2 starts at 2.05 s: inside the lookahead
  assert.deepEqual(arranger.tick(), { index: 0, bar: 1 })
  assert.deepEqual(scenes.at(-1), { index: 1, beat: 4, pads: [1], drums: false })

  clock.currentTime = 6.0 // end (12 beats = 6.05 s) announced as an empty scene
  assert.deepEqual(arranger.tick(), { index: 1, bar: 2 })
  assert.deepEqual(scenes.at(-1), { index: -1, beat: 12, pads: [], drums: false })
  assert.equal(ended, false)

  clock.currentTime = 6.06
  assert.equal(arranger.tick(), null)
  assert.equal(ended, true)
  assert.equal(transport.running, false)
})
