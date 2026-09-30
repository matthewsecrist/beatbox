import * as Y from 'yjs'

import type {
  Automation,
  AutomationTarget,
  DrumGrid,
  DrumPattern,
  Drums,
  DrumStep,
  Effects,
  InstrumentId,
  KitId,
  LfoTarget,
  Loop,
  Performance,
  Ramp,
  SavedStep,
  Section,
  SongDoc,
  StepLocks,
  SynthParams,
  TrackId,
  Voices,
  VoiceTweak
} from './types.js'

import { gridOf, STEPS } from './drums/engine.js'
import { KIT_SOUNDS, TRACKS } from './drums/kits.js'
import { DEFAULT_EFFECTS } from './effects.js'
import { DEFAULT_PERFORMANCE } from './synth/arp.js'
import { DEFAULT_PARAMS, LFO_DEPTH_MAX } from './synth/engine.js'

// The open song as a Yjs document. The instruments read the reactive mirrors
// below and change the song only through the methods here, so every edit, from
// any instrument, goes through one undo history (Y.UndoManager). The same
// document is the starting point for collaborative editing later.
//
// The document's top-level types:
//   synth        Y.Map      param -> number | wave (missing = default)
//   performance  Y.Map      arp, arp_rate, chord (missing = default)
//   effects      Y.Map      delay/reverb settings and send levels (missing = default)
//   drums        Y.Map      bpm, volume, swing, humanize, kit, voices (track -> VoiceTweak: tune,
//                           decay and any library instrument in place of the kit's; plain JSON)
//   patterns     Y.Array    Y.Map per drum pattern (track -> DrumStep[])
//   loops        Y.Map      slot ("0"-"7") -> Loop (plain JSON; a loop changes as a whole)
//   arrangement  Y.Array    Y.Map per section (id, name, bars, drums, pattern, pads)

export const PAD_COUNT = 8
const DRUM_PATTERNS = 4

// A step with default settings, switched off.
export const STEP: DrumStep = { accent: false, on: false, probability: 1, ratchet: 1, velocity: 1 }

const row = (on: number[]): DrumStep[] =>
  Array.from({ length: STEPS }, (_, i) => ({ ...STEP, on: on.includes(i) }))

// Every track's tweaks: the saved ones, defaults for the rest.
const fillVoices = (saved: Voices = {}): Record<TrackId, VoiceTweak> =>
  Object.fromEntries(TRACKS.map(({ id }) => [id, { decay: 1, tune: 0, ...saved[id] }])) as Record<
    TrackId,
    VoiceTweak
  >

// Kick on the beat, hats on the 8ths, snare on 2 and 4; every other track empty.
export const DEFAULT_PATTERN: DrumPattern = {
  ...(Object.fromEntries(TRACKS.map(({ id }) => [id, row([])])) as DrumPattern),
  chat: row([0, 2, 4, 6, 8, 10, 12, 14]),
  kick: row([0, 4, 8, 12]),
  snare: row([4, 12])
}

// A section as the arranger sees it: with a stable id for keyed rendering (not saved).
export type ArrangementSection = Section & { id: string; name: string }

// How long consecutive edits merge into one undo step (a slider drag, typing).
const CAPTURE_MS = 400

// Origin of transactions that load a whole song: not undoable, not a change.
const LOAD = Symbol('load')

// The drum machine as the instruments see it: every setting filled in (each
// pattern's grid is how many steps its rows have).
export type DrumState = Required<Omit<Drums, 'grids' | 'patterns' | 'voices'>> & {
  patterns: DrumPattern[]
  voices: Record<TrackId, VoiceTweak>
}

export class SongStore {
  arrangement: ArrangementSection[] = $state.raw([])
  canRedo = $state(false)
  canUndo = $state(false)
  drums: DrumState = $state.raw({
    bpm: 0,
    humanize: 0,
    kit: 'classic',
    patterns: [],
    swing: 50,
    voices: fillVoices(),
    volume: 0
  })
  // Delay and reverb settings and each instrument's sends, every one filled in.
  effects: Effects = $state.raw({ ...DEFAULT_EFFECTS })
  // Loops by slot (null = empty pad).
  loops: (Loop | null)[] = $state.raw(Array.from({ length: PAD_COUNT }, () => null))
  // Chord and arpeggiator settings, every one filled in.
  performance: Performance = $state.raw({ ...DEFAULT_PERFORMANCE })
  // A shared song opened by someone else: it plays, but every edit is refused.
  readonly readOnly: boolean
  synth: Partial<SynthParams> = $state.raw({})

  private readonly arrangementArray: Y.Array<Y.Map<unknown>>
  private readonly doc = new Y.Doc()
  private readonly drumsMap: Y.Map<unknown>
  private readonly effectsMap: Y.Map<unknown>
  private readonly loopsMap: Y.Map<Loop>
  private readonly patternsArray: Y.Array<Y.Map<DrumStep[]>>
  private readonly performanceMap: Y.Map<unknown>
  private readonly synthMap: Y.Map<unknown>
  private readonly undoManager: Y.UndoManager

  // `onchange` fires after every edit, undo and redo (not on load). A `readOnly`
  // store ignores every change method, so nothing can alter the song.
  constructor(
    song: null | SongDoc = null,
    onchange: () => void = () => undefined,
    { readOnly = false }: { readOnly?: boolean } = {}
  ) {
    this.readOnly = readOnly
    this.synthMap = this.doc.getMap('synth')
    this.performanceMap = this.doc.getMap('performance')
    this.effectsMap = this.doc.getMap('effects')
    this.drumsMap = this.doc.getMap('drums')
    this.patternsArray = this.doc.getArray('patterns')
    this.loopsMap = this.doc.getMap('loops')
    this.arrangementArray = this.doc.getArray('arrangement')
    // Loading runs before the history and listeners exist: not undoable, not a change.
    this.doc.transact(() => this.write(song), LOAD)

    this.undoManager = new Y.UndoManager(
      [
        this.synthMap,
        this.performanceMap,
        this.effectsMap,
        this.drumsMap,
        this.patternsArray,
        this.loopsMap,
        this.arrangementArray
      ],
      { captureTimeout: CAPTURE_MS }
    )
    const syncHistory = () => {
      this.canUndo = this.undoManager.canUndo()
      this.canRedo = this.undoManager.canRedo()
    }
    this.undoManager.on('stack-item-added', syncHistory)
    this.undoManager.on('stack-item-popped', syncHistory)

    this.synthMap.observe(() => this.readSynth())
    this.performanceMap.observe(() => this.readPerformance())
    this.effectsMap.observe(() => this.readEffects())
    this.drumsMap.observe(() => this.readDrums())
    this.patternsArray.observeDeep(() => this.readDrums())
    this.loopsMap.observe((e) => this.readLoops([...e.keysChanged].map(String)))
    this.arrangementArray.observeDeep(() => this.readArrangement())
    this.doc.on('afterTransaction', (tr: Y.Transaction) => {
      if (tr.changed.size > 0 && tr.origin !== LOAD) onchange()
    })

    this.readSynth()
    this.readPerformance()
    this.readEffects()
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

  // Takes a lane out of every section, as one undo step.
  clearLane(target: AutomationTarget): void {
    this.edit(() => {
      this.arrangement.forEach((section, i) => {
        if (!section.automation?.[target]) return
        const automation: Automation = { ...section.automation }
        delete automation[target]
        this.writeAutomation(i, automation)
      })
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

  // Swaps in a whole song (one kept while signing in, say). Like the song the store
  // was created with, it isn't undoable and doesn't count as a change.
  replace(song: SongDoc): void {
    this.doc.transact(() => {
      this.synthMap.clear()
      this.performanceMap.clear()
      this.effectsMap.clear()
      this.drumsMap.clear()
      this.patternsArray.delete(0, this.patternsArray.length)
      this.loopsMap.clear()
      this.arrangementArray.delete(0, this.arrangementArray.length)
      this.write(song)
    }, LOAD)
    this.undoManager.clear()
    this.canUndo = false
    this.canRedo = false
  }

  // Drum tempo (also the song tempo), swing, humanize and level.
  setDrums(patch: Partial<Pick<Drums, 'bpm' | 'humanize' | 'swing' | 'volume'>>): void {
    this.edit(() => {
      for (const [key, value] of Object.entries(patch)) this.drumsMap.set(key, value)
    })
  }

  // Delay/reverb settings and send levels; a slider drag is one undo step.
  setEffects(patch: Partial<Effects>): void {
    this.edit(() => {
      for (const [key, value] of Object.entries(patch)) this.effectsMap.set(key, value)
    })
  }

  // Moves a pattern onto another grid, as one undo step: a step on a line both
  // grids share keeps its hit and settings; the others go.
  setGrid(index: number, grid: DrumGrid): void {
    const map = this.patternsArray.get(index)
    const pattern = this.drums.patterns[index]
    if (!map || !pattern || gridOf(pattern) === grid) return
    this.edit(() => {
      for (const { id } of TRACKS) {
        const row = pattern[id]
        map.set(
          id,
          Array.from({ length: grid }, (_, s) => {
            const from = (s * row.length) / grid
            return (Number.isInteger(from) ? row[from] : undefined) ?? { ...STEP }
          })
        )
      }
    }, true)
  }

  // Switches a track's steps on or off (`on[i]` for step i) as one undo step. Each
  // step keeps its other settings, as when clicked on or off.
  setHits(index: number, track: TrackId, on: boolean[]): void {
    const map = this.patternsArray.get(index)
    const steps = this.drums.patterns[index]?.[track]
    if (!map || !steps) return
    this.edit(
      () =>
        map.set(
          track,
          steps.map((s, i) => ({ ...s, on: on[i] ?? false }))
        ),
      true
    )
  }

  // A kit fills every track with its own sound, and starts each from its own tune
  // and decay; a saved kit brings its tracks' tweaks and sounds too.
  setKit(kit: KitId, voices: Voices = {}): void {
    this.edit(() => {
      this.drumsMap.set('kit', kit)
      this.drumsMap.set('voices', fillVoices(voices))
    }, true)
  }

  // Points LFO `n` elsewhere, carrying its depth over as the same share of the
  // new target's range, as one undo step. `slot` as for setParam.
  setLfoTarget(n: 1 | 2, target: LfoTarget, slot: null | number = null): void {
    const sound = this.soundOf(slot)
    const from = sound[`lfo${n}_target`] ?? DEFAULT_PARAMS[`lfo${n}_target`]
    if (from === target) return
    const share = (sound[`lfo${n}_depth`] ?? 0) / LFO_DEPTH_MAX[from]
    const depth = Math.min(1, share) * LFO_DEPTH_MAX[target]
    this.writeSound(
      slot,
      { [`lfo${n}_depth`]: Math.round(depth * 100) / 100, [`lfo${n}_target`]: target },
      true
    )
  }

  // Sets one step's parameter locks (tune, decay); null clears one, so the hit
  // follows its voice again. A slider drag is one undo step, clearing its own.
  setLocks(
    index: number,
    track: TrackId,
    step: number,
    patch: Partial<Record<keyof StepLocks, null | number>>
  ): void {
    const map = this.patternsArray.get(index)
    const steps = this.drums.patterns[index]?.[track]
    if (!map || !steps) return
    this.edit(
      () =>
        map.set(
          track,
          steps.map((s, i) => {
            if (i !== step) return s
            const next = { ...s }
            for (const key of ['decay', 'tune'] as const) {
              const value = patch[key]
              if (value === null) delete next[key]
              else if (value !== undefined) next[key] = value
            }
            return next
          })
        ),
      Object.values(patch).includes(null)
    )
  }
  setLoop(loop: Loop): void {
    this.edit(() => this.loopsMap.set(String(loop.slot), plain(loop)), true)
  }

  // One synth setting: of the keyboard's sound, or (`slot`) of that loop pad's own.
  setParam<K extends keyof SynthParams>(
    key: K,
    value: SynthParams[K],
    slot: null | number = null
  ): void {
    this.writeSound(slot, { [key]: value }, false)
  }

  // Replaces every synth setting (a preset, or Reset) as one undo step. `slot` as
  // for setParam.
  setParams(params: SynthParams, slot: null | number = null): void {
    this.writeSound(slot, params, true)
  }

  setPattern(index: number, pattern: DrumPattern): void {
    const map = this.patternsArray.get(index)
    if (!map) return
    this.edit(() => {
      for (const { id } of TRACKS) map.set(id, [...pattern[id]])
    }, true)
  }

  // Chord shape, arp pattern and rate: each change is its own undo step.
  setPerformance(patch: Partial<Performance>): void {
    this.edit(() => {
      for (const [key, value] of Object.entries(patch)) this.performanceMap.set(key, value)
    }, true)
  }

  // Sets one section's ramp for a lane; null takes the lane out of it (it keeps
  // the song's own setting there).
  setRamp(index: number, target: AutomationTarget, ramp: null | Ramp): void {
    const section = this.arrangement[index]
    if (!section) return
    const automation: Automation = { ...section.automation }
    if (ramp) automation[target] = [ramp[0], ramp[1]]
    else delete automation[target]
    this.edit(() => this.writeAutomation(index, automation), true)
  }

  // Plays `sound` from the instrument library on `track`. Picking the kit's own
  // sound drops the choice, so the track follows the kit again.
  setSound(track: TrackId, sound: InstrumentId): void {
    const voice = { ...this.drums.voices[track] }
    if (sound === KIT_SOUNDS[this.drums.kit][track]) delete voice.sound
    else voice.sound = sound
    this.edit(() => this.drumsMap.set('voices', { ...this.drums.voices, [track]: voice }), true)
  }

  // Changes one step (on/off, velocity, accent, probability, ratchet).
  setStep(index: number, track: TrackId, step: number, patch: Partial<DrumStep>): void {
    const map = this.patternsArray.get(index)
    const steps = this.drums.patterns[index]?.[track]
    if (!map || !steps) return
    this.edit(
      () =>
        map.set(
          track,
          steps.map((s, i) => (i === step ? { ...s, ...patch } : s))
        ),
      true
    )
  }

  setVoice(track: TrackId, patch: Partial<Pick<VoiceTweak, 'decay' | 'tune'>>): void {
    const voices = this.drums.voices
    this.edit(() =>
      this.drumsMap.set('voices', { ...voices, [track]: { ...voices[track], ...patch } })
    )
  }

  // The keyboard's sound (`slot` null), or a loop pad's own ({} for an empty pad).
  soundOf(slot: null | number): Partial<SynthParams> {
    return slot === null ? this.synth : (this.loops[slot]?.params ?? {})
  }

  // The song tempo from tap tempo: a run of taps is one undo step, however far
  // apart they are, starting with its `first` tempo.
  tapTempo(bpm: number, first: boolean): void {
    if (!first) this.undoManager.lastChange = Date.now()
    this.edit(() => this.drumsMap.set('bpm', bpm), first)
  }

  // The song's parts, for saving.
  toSongDoc(): SongDoc {
    const synth = this.synthMap.toJSON() as Partial<SynthParams>
    const performance = this.performanceMap.toJSON() as Partial<Performance>
    const effects = this.effectsMap.toJSON() as Partial<Effects>
    return {
      arrangement: this.arrangement.map(
        ({ automation, bars, bpm, drums, name, pads, pattern }) => ({
          // Saved only when the section automates something.
          ...(automation && Object.keys(automation).length ? { automation } : {}),
          bars,
          // Saved only when the section has its own tempo.
          ...(bpm ? { bpm } : {}),
          drums,
          name,
          pads,
          pattern
        })
      ),
      drums: {
        ...this.drums,
        // Saved only when a pattern isn't on 16ths.
        ...(this.drums.patterns.some((p) => gridOf(p) !== STEPS)
          ? { grids: this.drums.patterns.map(gridOf) }
          : {}),
        // Steps with default settings and no locks save as plain on/off.
        patterns: this.drums.patterns.map((p) =>
          Object.fromEntries(
            TRACKS.map(({ id }) => [
              id,
              p[id].map((s): SavedStep =>
                s.accent ||
                s.probability !== 1 ||
                s.ratchet !== 1 ||
                s.velocity !== 1 ||
                s.decay !== undefined ||
                s.tune !== undefined
                  ? s
                  : s.on
              )
            ])
          )
        )
      },
      effects: Object.keys(effects).length ? effects : null,
      loops: this.loops.filter((l): l is Loop => l !== null),
      performance: Object.keys(performance).length ? performance : null,
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
    if (this.readOnly) return
    if (discrete) this.undoManager.stopCapturing()
    this.doc.transact(fn)
    if (discrete) this.undoManager.stopCapturing()
  }

  private readArrangement() {
    this.arrangement = this.arrangementArray.toJSON() as ArrangementSection[]
  }

  private readDrums() {
    const get = <T>(key: string, fallback: T) =>
      (this.drumsMap.get(key) as T | undefined) ?? fallback
    this.drums = {
      bpm: get('bpm', 0),
      humanize: get('humanize', 0),
      kit: get<KitId>('kit', 'classic'),
      patterns: this.patternsArray.map((p) => p.toJSON() as DrumPattern),
      swing: get('swing', 50),
      voices: get('voices', fillVoices()),
      volume: get('volume', 0)
    }
  }

  private readEffects() {
    this.effects = { ...DEFAULT_EFFECTS, ...this.effectsMap.toJSON() }
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

  private readPerformance() {
    this.performance = { ...DEFAULT_PERFORMANCE, ...this.performanceMap.toJSON() }
  }

  private readSynth() {
    this.synth = this.synthMap.toJSON()
  }

  // A song without drums gets the default groove on pattern A.
  private write(song: null | SongDoc) {
    for (const [key, value] of Object.entries(song?.synth ?? {})) this.synthMap.set(key, value)
    for (const [key, value] of Object.entries(song?.performance ?? {})) {
      this.performanceMap.set(key, value)
    }
    for (const [key, value] of Object.entries(song?.effects ?? {})) this.effectsMap.set(key, value)
    this.writeDrums(song?.drums ?? null)
    for (const loop of song?.loops ?? []) this.loopsMap.set(String(loop.slot), loop)
    this.arrangementArray.push((song?.arrangement ?? []).map(sectionMap))
  }

  // A section's automation; none left removes the key, so it saves as before.
  private writeAutomation(index: number, automation: Automation) {
    const map = this.arrangementArray.get(index)
    if (Object.keys(automation).length) map.set('automation', automation)
    else map.delete('automation')
  }

  private writeDrums(drums: Drums | null) {
    this.drumsMap.set('bpm', drums?.bpm ?? 110)
    this.drumsMap.set('volume', drums?.volume ?? 0.8)
    this.drumsMap.set('swing', drums?.swing ?? 50)
    this.drumsMap.set('humanize', drums?.humanize ?? 0)
    this.drumsMap.set('kit', drums?.kit ?? 'classic')
    this.drumsMap.set('voices', fillVoices(drums?.voices))
    const source = drums ? drums.patterns : [DEFAULT_PATTERN]
    this.patternsArray.push(
      Array.from({ length: DRUM_PATTERNS }, (_, i) => {
        const saved = source[i] ?? {}
        const grid = drums?.grids?.[i] ?? STEPS
        const map = new Y.Map<DrumStep[]>()
        // A saved pattern may omit tracks or steps (off), and stores plain on/off
        // for steps with default settings. Its grid is how many steps each row has.
        for (const { id } of TRACKS) {
          map.set(
            id,
            Array.from({ length: grid }, (_, s) => {
              const step = saved[id]?.[s]
              return typeof step === 'object' ? { ...STEP, ...step } : { ...STEP, on: !!step }
            })
          )
        }
        return map
      })
    )
  }

  // Writes synth settings to the keyboard's sound or to a loop's. A loop keeps no
  // volume (that stays global), and keeps its notes as the same objects, so a
  // playing pad changes sound without restarting.
  private writeSound(slot: null | number, patch: Partial<SynthParams>, discrete: boolean) {
    if (slot === null) {
      this.edit(() => {
        for (const [key, value] of Object.entries(patch)) this.synthMap.set(key, value)
      }, discrete)
      return
    }
    const loop = this.loops[slot]
    if (!loop) return
    const params = plain({ ...loop.params, ...patch })
    delete params.volume
    this.edit(() => this.loopsMap.set(String(slot), { ...loop, params }), discrete)
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
  if (section.bpm) map.set('bpm', section.bpm)
  map.set('pattern', section.pattern)
  map.set('pads', [...section.pads])
  if (section.automation && Object.keys(section.automation).length) {
    map.set('automation', plain(section.automation))
  }
  return map
}
