import * as Y from 'yjs'

import type { DrumPattern, Drums, Loop, Section, SongDoc, SynthParams, TrackId } from './types.js'

import { STEPS, TRACKS } from './drums/engine.js'

// The open song as a Yjs document. The instruments read the reactive mirrors
// below and change the song only through the methods here, so every edit, from
// any instrument, goes through one undo history (Y.UndoManager). The same
// document is the starting point for collaborative editing later.
//
// The document's top-level types:
//   synth        Y.Map      param -> number | wave (missing = default)
//   drums        Y.Map      bpm, volume
//   patterns     Y.Array    Y.Map per drum pattern (track -> boolean[])
//   loops        Y.Map      slot ("0"-"7") -> Loop (plain JSON; a loop changes as a whole)
//   arrangement  Y.Array    Y.Map per section (id, name, bars, drums, pattern, pads)

export const PAD_COUNT = 8
const DRUM_PATTERNS = 4

const row = (on: number[]): boolean[] => Array.from({ length: STEPS }, (_, i) => on.includes(i))

export const DEFAULT_PATTERN: DrumPattern = {
  chat: row([0, 2, 4, 6, 8, 10, 12, 14]),
  clap: row([]),
  kick: row([0, 4, 8, 12]),
  ohat: row([]),
  snare: row([4, 12]),
  tom: row([])
}

// A section as the arranger sees it: with a stable id for keyed rendering (not saved).
export type ArrangementSection = Section & { id: string; name: string }

// How long consecutive edits merge into one undo step (a slider drag, typing).
const CAPTURE_MS = 400

export class SongStore {
  arrangement: ArrangementSection[] = $state.raw([])
  canRedo = $state(false)
  canUndo = $state(false)
  drums: { bpm: number; patterns: DrumPattern[]; volume: number } = $state.raw({
    bpm: 0,
    patterns: [],
    volume: 0
  })
  // Loops by slot (null = empty pad).
  loops: (Loop | null)[] = $state.raw(Array.from({ length: PAD_COUNT }, () => null))
  synth: Partial<SynthParams> = $state.raw({})

  private readonly arrangementArray: Y.Array<Y.Map<unknown>>
  private readonly doc = new Y.Doc()
  private readonly drumsMap: Y.Map<number>
  private readonly loopsMap: Y.Map<Loop>
  private readonly patternsArray: Y.Array<Y.Map<boolean[]>>
  private readonly synthMap: Y.Map<unknown>
  private readonly undoManager: Y.UndoManager

  // `onchange` fires after every edit, undo and redo (not on load).
  constructor(song: null | SongDoc = null, onchange: () => void = () => undefined) {
    this.synthMap = this.doc.getMap('synth')
    this.drumsMap = this.doc.getMap('drums')
    this.patternsArray = this.doc.getArray('patterns')
    this.loopsMap = this.doc.getMap('loops')
    this.arrangementArray = this.doc.getArray('arrangement')
    // Loading runs before the history and listeners exist: not undoable, not a change.
    this.doc.transact(() => {
      for (const [key, value] of Object.entries(song?.synth ?? {})) this.synthMap.set(key, value)
      this.writeDrums(song?.drums ?? null)
      for (const loop of song?.loops ?? []) this.loopsMap.set(String(loop.slot), loop)
      this.arrangementArray.push((song?.arrangement ?? []).map(sectionMap))
    })

    this.undoManager = new Y.UndoManager(
      [this.synthMap, this.drumsMap, this.patternsArray, this.loopsMap, this.arrangementArray],
      { captureTimeout: CAPTURE_MS }
    )
    const syncHistory = () => {
      this.canUndo = this.undoManager.canUndo()
      this.canRedo = this.undoManager.canRedo()
    }
    this.undoManager.on('stack-item-added', syncHistory)
    this.undoManager.on('stack-item-popped', syncHistory)

    this.synthMap.observe(() => this.readSynth())
    this.drumsMap.observe(() => this.readDrums())
    this.patternsArray.observeDeep(() => this.readDrums())
    this.loopsMap.observe((e) => this.readLoops([...e.keysChanged].map(String)))
    this.arrangementArray.observeDeep(() => this.readArrangement())
    this.doc.on('afterTransaction', (tr: Y.Transaction) => {
      if (tr.changed.size > 0) onchange()
    })

    this.readSynth()
    this.readDrums()
    this.readLoops([...this.loopsMap.keys()])
    this.readArrangement()
  }

  addSection(): void {
    const last = this.arrangement.at(-1)
    this.edit(() => {
      this.arrangementArray.push([
        sectionMap(
          last
            ? { ...last, name: '', pads: [...last.pads] }
            : { bars: 4, drums: true, name: '', pads: [], pattern: 0 }
        )
      ])
    }, true)
  }

  deleteLoop(slot: number): void {
    this.edit(() => this.loopsMap.delete(String(slot)), true)
  }

  duplicateSection(index: number): void {
    const section = this.arrangement[index]
    if (!section) return
    this.edit(() => {
      this.arrangementArray.insert(index + 1, [sectionMap({ ...section, pads: [...section.pads] })])
    }, true)
  }

  moveSection(index: number, delta: number): void {
    const section = this.arrangement[index]
    const target = index + delta
    if (!section || target < 0 || target >= this.arrangement.length) return
    this.edit(() => {
      this.arrangementArray.delete(index, 1)
      this.arrangementArray.insert(target, [sectionMap(section)])
    }, true)
  }

  redo(): void {
    this.undoManager.redo()
  }

  removeSection(index: number): void {
    if (!this.arrangement[index]) return
    this.edit(() => this.arrangementArray.delete(index, 1), true)
  }

  // Drum tempo and level (also the song tempo).
  setDrums(patch: Partial<Pick<Drums, 'bpm' | 'volume'>>): void {
    this.edit(() => {
      for (const [key, value] of Object.entries(patch)) this.drumsMap.set(key, value)
    })
  }

  setLoop(loop: Loop): void {
    this.edit(() => this.loopsMap.set(String(loop.slot), plain(loop)), true)
  }

  setParam<K extends keyof SynthParams>(key: K, value: SynthParams[K]): void {
    this.edit(() => this.synthMap.set(key, value))
  }

  // Replaces every synth setting (a preset, or Reset) as one undo step.
  setParams(params: SynthParams): void {
    this.edit(() => {
      for (const [key, value] of Object.entries(params)) this.synthMap.set(key, value)
    }, true)
  }

  setPattern(index: number, pattern: DrumPattern): void {
    const map = this.patternsArray.get(index)
    if (!map) return
    this.edit(() => {
      for (const { id } of TRACKS) map.set(id, [...pattern[id]])
    }, true)
  }

  toggleStep(index: number, track: TrackId, step: number): void {
    const map = this.patternsArray.get(index)
    const steps = this.drums.patterns[index]?.[track]
    if (!map || !steps) return
    this.edit(() =>
      map.set(
        track,
        steps.map((on, i) => (i === step ? !on : on))
      )
    )
  }

  // The song's parts, for saving.
  toSongDoc(): SongDoc {
    const synth = this.synthMap.toJSON() as Partial<SynthParams>
    return {
      arrangement: this.arrangement.map(({ bars, drums, name, pads, pattern }) => ({
        bars,
        drums,
        name,
        pads,
        pattern
      })),
      drums: this.drums,
      loops: this.loops.filter((l): l is Loop => l !== null),
      synth: Object.keys(synth).length ? synth : null
    }
  }

  undo(): void {
    this.undoManager.undo()
  }

  updateSection(index: number, patch: Partial<Section>): void {
    const map = this.arrangementArray.get(index)
    if (!map) return
    // Renaming merges keystrokes into one step; other changes are steps of their own.
    this.edit(
      () => {
        for (const [key, value] of Object.entries(patch)) map.set(key, value)
      },
      !('name' in patch)
    )
  }

  // One undoable change. `discrete` edits never merge with the ones around them.
  private edit(fn: () => void, discrete = false): void {
    if (discrete) this.undoManager.stopCapturing()
    this.doc.transact(fn)
    if (discrete) this.undoManager.stopCapturing()
  }

  private readArrangement() {
    this.arrangement = this.arrangementArray.toJSON() as ArrangementSection[]
  }

  private readDrums() {
    this.drums = {
      bpm: this.drumsMap.get('bpm') ?? 0,
      patterns: this.patternsArray.map((p) => p.toJSON() as DrumPattern),
      volume: this.drumsMap.get('volume') ?? 0
    }
  }

  // Keeps unchanged loops as the same objects, so players only rebuild what changed.
  private readLoops(changed: string[]) {
    const next = [...this.loops]
    for (const key of changed) {
      const slot = Number(key)
      if (slot >= 0 && slot < PAD_COUNT) next[slot] = this.loopsMap.get(key) ?? null
    }
    this.loops = next
  }

  private readSynth() {
    this.synth = this.synthMap.toJSON()
  }

  // A song without drums gets the default groove on pattern A.
  private writeDrums(drums: Drums | null) {
    this.drumsMap.set('bpm', drums?.bpm ?? 110)
    this.drumsMap.set('volume', drums?.volume ?? 0.8)
    const source = drums ? drums.patterns : [DEFAULT_PATTERN]
    this.patternsArray.push(
      Array.from({ length: DRUM_PATTERNS }, (_, i) => {
        const saved = source[i] ?? {}
        const map = new Y.Map<boolean[]>()
        // A saved pattern may omit tracks or steps; fill them in as off.
        for (const { id } of TRACKS) {
          map.set(
            id,
            Array.from({ length: STEPS }, (_, s) => !!saved[id]?.[s])
          )
        }
        return map
      })
    )
  }
}

// A plain copy: Svelte state proxies can't go into a Yjs document.
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function sectionMap(section: Section): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  map.set('id', crypto.randomUUID())
  map.set('name', section.name ?? '')
  map.set('bars', section.bars)
  map.set('drums', section.drums)
  map.set('pattern', section.pattern)
  map.set('pads', [...section.pads])
  return map
}
