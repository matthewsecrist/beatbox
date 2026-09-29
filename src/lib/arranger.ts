import type { Transport } from './transport.js'
import type { Scene, Section } from './types.js'

import { BEATS_PER_BAR } from './transport.js'

const LOOKAHEAD = 0.1

export interface Arranger {
  readonly playing: boolean
  start(list: ArrangerSection[]): null | Position
  stop(): void
  tick(): null | Position
}

export type ArrangerSection = Partial<Pick<Section, 'bpm' | 'drums' | 'pattern'>> &
  Pick<Section, 'bars' | 'pads'>

const noop = (): void => undefined

// Where playback is: section index and 1-based bar within it.
export interface Position {
  bar: number
  index: number
}

// Plays an arrangement: a list of sections ({ bars, pads, drums }) back to back on
// the shared transport. Each section boundary is announced LOOKAHEAD seconds early
// as a scene ({ index, beat, pads, drums }) so the instruments can start and stop
// exactly on `beat`. After the last section, a final empty scene stops everything
// on the end beat and `onEnd` fires once that beat has passed. A section with a
// `bpm` of its own plays at that tempo: the transport's tempo map changes on its
// boundary beats, set up front so every instrument's timing already knows it.
export function createArranger({
  onEnd = noop,
  onScene,
  transport
}: {
  onEnd?: () => void
  onScene: (scene: Scene) => void
  transport: Pick<
    Transport,
    'acquire' | 'beatAt' | 'clearTempo' | 'nextBar' | 'now' | 'release' | 'setTempo' | 'timeAt'
  >
}): Arranger {
  let playing = false
  let boundaries: number[] = [] // start beat of each section, then the end beat
  let sections: ArrangerSection[] = []
  let next = 0 // next boundary to announce

  function stop() {
    if (!playing) return
    playing = false
    transport.clearTempo()
    transport.release('song')
  }

  return {
    get playing() {
      return playing
    },

    start(list: ArrangerSection[]): null | Position {
      sections = list
      boundaries = [0]
      for (const s of sections) boundaries.push(last(boundaries) + s.bars * BEATS_PER_BAR)
      transport.acquire('song')
      const offset = transport.nextBar()
      boundaries = boundaries.map((b) => b + offset)
      // Each section's tempo from its first beat; the song tempo again after the end.
      transport.setTempo(boundaries.map((beat, i) => ({ beat, bpm: sections[i]?.bpm ?? null })))
      playing = true
      next = 0
      return tick()
    },

    stop,

    tick
  }

  // Announces boundaries due within the lookahead; returns where playback is,
  // or null when stopped.
  function tick(): null | Position {
    if (!playing) return null
    const now = transport.now()
    while (next < boundaries.length && transport.timeAt(at(boundaries, next)) < now + LOOKAHEAD) {
      const s = sections[next]
      onScene({
        beat: at(boundaries, next),
        bpm: s?.bpm ?? null,
        drums: s?.drums ?? false,
        index: s ? next : -1,
        pads: s?.pads ?? [],
        pattern: s?.pattern ?? 0
      })
      next++
    }
    if (now >= transport.timeAt(last(boundaries))) {
      stop()
      onEnd()
      return null
    }
    const beat = Math.max(at(boundaries, 0), transport.beatAt(now))
    const index = Math.max(
      0,
      boundaries.findLastIndex((b, i) => i < sections.length && b <= beat)
    )
    return { bar: Math.floor((beat - at(boundaries, index)) / BEATS_PER_BAR) + 1, index }
  }
}

// Boundaries always hold at least the start beat, so these indexes exist.
function at(list: number[], i: number): number {
  const value = list[i]
  if (value === undefined) throw new RangeError(`no boundary ${i}`)
  return value
}

const last = (list: number[]): number => at(list, list.length - 1)
