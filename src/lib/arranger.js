import { BEATS_PER_BAR } from "./transport.js"

const LOOKAHEAD = 0.1

// Plays an arrangement: a list of sections ({ bars, pads, drums }) back to back on
// the shared transport. Each section boundary is announced LOOKAHEAD seconds early
// as a scene ({ index, beat, pads, drums }) so the instruments can start and stop
// exactly on `beat`. After the last section, a final empty scene stops everything
// on the end beat and `onEnd` fires once that beat has passed.
export function createArranger({ transport, onScene, onEnd = () => {} }) {
  let playing = false
  let boundaries = [] // start beat of each section, then the end beat
  let sections = []
  let next = 0 // next boundary to announce

  function stop() {
    if (!playing) return
    playing = false
    transport.release("song")
  }

  return {
    get playing() {
      return playing
    },

    start(list) {
      sections = list
      boundaries = [0]
      for (const s of sections) boundaries.push(boundaries.at(-1) + s.bars * BEATS_PER_BAR)
      transport.acquire("song")
      const offset = transport.nextBar()
      boundaries = boundaries.map((b) => b + offset)
      playing = true
      next = 0
      return this.tick()
    },

    stop,

    // Announces boundaries due within the lookahead; returns where playback is:
    // { index, bar } (bar is 1-based within the section), or null when stopped.
    tick() {
      if (!playing) return null
      const now = transport.now()
      while (next < boundaries.length && transport.timeAt(boundaries[next]) < now + LOOKAHEAD) {
        const s = sections[next]
        onScene({
          index: s ? next : -1,
          beat: boundaries[next],
          pads: s?.pads ?? [],
          drums: s?.drums ?? false,
          pattern: s?.pattern ?? 0,
        })
        next++
      }
      if (now >= transport.timeAt(boundaries.at(-1))) {
        stop()
        onEnd()
        return null
      }
      const beat = Math.max(boundaries[0], transport.beatAt(now))
      const index = Math.max(0, boundaries.findLastIndex((b, i) => i < sections.length && b <= beat))
      return { index, bar: Math.floor((beat - boundaries[index]) / BEATS_PER_BAR) + 1 }
    },
  }
}
