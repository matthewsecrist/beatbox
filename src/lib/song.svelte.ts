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
  TrackLengths,
  Voices,
  VoiceTweak
} from './types.js'

import { gridOf, MAX_BARS, STEPS } from './drums/engine.js'
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
//   drums        Y.Map      bpm, volume, swing, humanize, crush, kit, voices (track -> VoiceTweak: tune,
//                           decay and any library instrument in place of the kit's; plain JSON),
//                           bars (per pattern: how many bars it is, 1-4),
//                           lengths (per pattern: track -> steps it loops over; plain JSON),
//                           fillLengths (the same for each pattern's own fill)
//   patterns     Y.Array    Y.Map per drum pattern (track -> DrumStep[], every bar's steps)
//   fills        Y.Array    Y.Map per pattern: its fill bar (track -> DrumStep[]); empty
//                           follows the pattern's last bar until the fill is first edited
//   loops        Y.Map      slot ("0"-"7") -> Loop (plain JSON; a loop changes as a whole)
//   arrangement  Y.Array    Y.Map per section (id, name, bars, drums, pattern, pads)

export const PAD_COUNT = 8
// The drum patterns' names; arrangement sections pick one by index.
export const PATTERN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const DRUM_PATTERNS = PATTERN_LETTERS.length

// Drum patterns are edited by "ref": 0-7 are patterns A-H, and FILL + i is pattern
// i's fill, the bar a section can play last (a drum fill into the next section).
export const FILL = DRUM_PATTERNS
export const fillOf = (pattern: number): number => FILL + pattern

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
// pattern's grid is how many steps its rows have over its bars).
// Each pattern's fill is filled in too: an untouched one (`customFills` false) is
// its pattern's last bar, with its lengths.
export type DrumState = Required<
  Omit<Drums, 'fillLengths' | 'fills' | 'grids' | 'patterns' | 'voices'>
> & {
  customFills: boolean[]
  fillLengths: TrackLengths[]
  fills: DrumPattern[]
  patterns: DrumPattern[]
  voices: Record<TrackId, VoiceTweak>
}

export class SongStore {
  arrangement: ArrangementSection[] = $state.raw([])
  canRedo = $state(false)
  canUndo = $state(false)
  drums: DrumState = $state.raw({
    bars: [],
    bpm: 0,
    crush: 0,
    customFills: [],
    fillLengths: [],
    fills: [],
    humanize: 0,
    kit: 'classic',
    lengths: [],
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
  private readonly fillsArray: Y.Array<Y.Map<DrumStep[]>>
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
    this.fillsArray = this.doc.getArray('fills')
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
        this.fillsArray,
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
    this.fillsArray.observeDeep(() => this.readDrums())
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

  // How many bars a pattern is, by ref; a fill is always one.
  drumBars(ref: number): number {
    return ref < FILL ? (this.drums.bars[ref] ?? 1) : 1
  }

  // A pattern or a fill's track lengths, by ref.
  drumLengths(ref: number): TrackLengths | undefined {
    return ref < FILL ? this.drums.lengths[ref] : this.drums.fillLengths[ref - FILL]
  }

  // A pattern or a fill's steps, by ref (see FILL), as they play.
  drumPattern(ref: number): DrumPattern | undefined {
    return ref < FILL ? this.drums.patterns[ref] : this.drums.fills[ref - FILL]
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
      this.fillsArray.delete(0, this.fillsArray.length)
      this.loopsMap.clear()
      this.arrangementArray.delete(0, this.arrangementArray.length)
      this.write(song)
    }, LOAD)
    this.undoManager.clear()
    this.canUndo = false
    this.canRedo = false
  }

  // Lets pattern `index`'s fill follow its pattern again (as if never edited),
  // as one undo step.
  resetFill(index: number): void {
    if (!this.drums.customFills[index]) return
    this.edit(() => this.followFill(index), true)
  }

  // Makes pattern `index` 1-4 bars long, as one undo step: added bars repeat the
  // ones it has, and bars taken off go, with any track length past the new end.
  setBars(index: number, bars: number): void {
    const map = this.patternsArray.get(index)
    const pattern = this.drums.patterns[index]
    const from = this.drumBars(index)
    if (!map || !pattern || bars === from || bars < 1 || bars > MAX_BARS) return
    const was = pattern.kick.length
    const steps = (was / from) * bars
    this.edit(() => {
      for (const { id } of TRACKS)
        map.set(
          id,
          Array.from({ length: steps }, (_, i) => ({ ...STEP, ...pattern[id][i % was] }))
        )
      this.writeLengths(index, within(this.drums.lengths[index] ?? {}, steps))
      this.writeBars(index, bars)
    }, true)
  }

  // Drum tempo (also the song tempo), swing, humanize, crush and level.
  setDrums(patch: Partial<Pick<Drums, 'bpm' | 'crush' | 'humanize' | 'swing' | 'volume'>>): void {
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

  // Puts an empty pattern on another grid, as one undo step. A pattern with hits
  // keeps its grid (Clear it first), so no hit is ever moved or lost. Its tracks
  // go back to the whole pattern.
  setGrid(index: number, grid: DrumGrid): void {
    const map = this.patternsArray.get(index)
    const pattern = this.drums.patterns[index]
    const fill = this.drums.fills[index]
    const bars = this.drumBars(index)
    if (!map || !pattern || !fill || gridOf(pattern, bars) === grid) return
    const hits = (p: DrumPattern) => Object.values(p).some((row) => row.some((s) => s.on))
    // Its fill moves with it, so it too must be empty.
    if (hits(pattern) || hits(fill)) return
    this.edit(() => {
      for (const { id } of TRACKS)
        map.set(
          id,
          Array.from({ length: grid * bars }, () => ({ ...STEP }))
        )
      this.writeLengths(index, {})
      this.followFill(index)
    }, true)
  }

  // Switches a track's steps on or off (`on[i]` for step i) as one undo step. Each
  // step keeps its other settings, as when clicked on or off.
  setHits(index: number, track: TrackId, on: boolean[]): void {
    const steps = this.drumPattern(index)?.[track]
    if (!steps) return
    this.edit(
      () =>
        this.patternMap(index)?.set(
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

  // How many steps `track` loops over in pattern `index` (polymeter), kept to
  // 1 up to the pattern's steps; all of them (or null) plays the whole pattern again.
  setLength(index: number, track: TrackId, length: null | number): void {
    const pattern = this.drumPattern(index)
    const lengths = this.drumLengths(index)
    if (!pattern || !lengths) return
    const total = pattern.kick.length
    const next = { ...lengths }
    if (length === null || length >= total) delete next[track]
    else next[track] = Math.max(1, Math.round(length))
    this.edit(() => {
      this.patternMap(index)
      this.writeLengths(index, next)
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
    const steps = this.drumPattern(index)?.[track]
    if (!steps) return
    this.edit(
      () =>
        this.patternMap(index)?.set(
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

  // Whether a pad plays its loop once and stops (a one-shot) or loops; kept on
  // the loop, with its notes and sound.
  setLoopOnce(slot: number, once: boolean): void {
    const loop = this.loops[slot]
    if (!loop) return
    const next: Loop = { ...loop }
    if (once) next.once = true
    else delete next.once
    this.setLoop(next)
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

  // Replaces pattern `index`, its track lengths (none: the whole pattern) and its
  // `bars`, as one undo step. A fill, always one bar, takes the pattern's last bar.
  setPattern(index: number, pattern: DrumPattern, lengths: TrackLengths = {}, bars = 1): void {
    if (!this.drumPattern(index)) return
    const steps = index < FILL ? pattern : lastBar(pattern, bars)
    this.edit(() => {
      const map = this.patternMap(index)
      for (const { id } of TRACKS) map?.set(id, [...steps[id]])
      this.writeLengths(index, within(lengths, steps.kick.length))
      if (index < FILL) this.writeBars(index, bars)
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
    const steps = this.drumPattern(index)?.[track]
    if (!steps) return
    this.edit(
      () =>
        this.patternMap(index)?.set(
          track,
          steps.map((s, i) => (i === step ? { ...s, ...patch } : s))
        ),
      true
    )
  }

  setVoice(track: TrackId, patch: Partial<Pick<VoiceTweak, 'decay' | 'pan' | 'tune'>>): void {
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
    const { bars, customFills, fillLengths, fills, lengths, ...drumState } = this.drums
    // Only edited fills are saved; one following its pattern is null.
    const savedFills = fills.map((f, i) => (customFills[i] ? savedPattern(f) : null))
    const savedFillLengths = fillLengths.map((l, i) => (customFills[i] ? l : {}))
    return {
      arrangement: this.arrangement.map(
        ({ automation, bars, bpm, drums, fill, name, pads, pattern }) => ({
          // Saved only when the section automates something.
          ...(automation && Object.keys(automation).length ? { automation } : {}),
          bars,
          // Saved only when the section has its own tempo.
          ...(bpm ? { bpm } : {}),
          drums,
          // Saved only when the section plays its fill.
          ...(fill ? { fill } : {}),
          name,
          pads,
          pattern
        })
      ),
      drums: {
        ...drumState,
        // Saved only when a pattern is longer than a bar.
        ...(bars.some((b) => b > 1) ? { bars } : {}),
        // Saved only when a pattern isn't on 16ths.
        ...(this.drums.patterns.some((p, i) => gridOf(p, bars[i]) !== STEPS)
          ? { grids: this.drums.patterns.map((p, i) => gridOf(p, bars[i])) }
          : {}),
        // Saved only when a fill has been edited.
        ...(savedFills.some(Boolean) ? { fills: savedFills } : {}),
        ...(savedFillLengths.some((l) => Object.keys(l).length)
          ? { fillLengths: savedFillLengths }
          : {}),
        // Saved only when a track has a length of its own.
        ...(lengths.some((l) => Object.keys(l).length) ? { lengths } : {}),
        patterns: this.drums.patterns.map(savedPattern)
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

  // Lets fill `index` follow its pattern again: an empty map, and its lengths cleared.
  private followFill(index: number) {
    this.fillsArray.get(index)?.clear()
    this.writeLengths(fillOf(index), {})
  }

  // The map holding a pattern or fill's steps, to edit inside a transaction. A fill
  // still following its pattern starts as a copy of its last bar (steps and
  // lengths), so the first edit changes only what it touches.
  private patternMap(ref: number): undefined | Y.Map<DrumStep[]> {
    if (ref < FILL) return this.patternsArray.get(ref)
    const index = ref - FILL
    const map = this.fillsArray.get(index)
    const fill = this.drums.fills[index]
    if (map && fill && map.size === 0) {
      for (const { id } of TRACKS)
        map.set(
          id,
          fill[id].map((s) => ({ ...s }))
        )
      this.writeLengths(ref, { ...this.drums.fillLengths[index] })
    }
    return map
  }

  private readArrangement() {
    this.arrangement = this.arrangementArray.toJSON() as ArrangementSection[]
  }

  private readDrums() {
    const get = <T>(key: string, fallback: T) =>
      (this.drumsMap.get(key) as T | undefined) ?? fallback
    const lengths = get<TrackLengths[]>('lengths', [])
    const fillLengths = get<TrackLengths[]>('fillLengths', [])
    const saved = get<number[]>('bars', [])
    const patterns = this.patternsArray.map((p) => p.toJSON() as DrumPattern)
    const bars = patterns.map((_, i) => saved[i] ?? 1)
    // An untouched fill is its pattern's last bar.
    const customFills = this.fillsArray.map((f) => f.size > 0)
    const followed = patterns.map((p, i) => lastBar(p, bars[i] ?? 1))
    this.drums = {
      bars,
      bpm: get('bpm', 0),
      crush: get('crush', 0),
      customFills,
      fillLengths: customFills.map((custom, i) =>
        custom
          ? (fillLengths[i] ?? {})
          : within(lengths[i] ?? {}, followed[i]?.kick.length ?? STEPS)
      ),
      fills: this.fillsArray.map((f, i) =>
        customFills[i] ? (f.toJSON() as DrumPattern) : (followed[i] ?? ({} as DrumPattern))
      ),
      humanize: get('humanize', 0),
      kit: get<KitId>('kit', 'classic'),
      lengths,
      patterns,
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

  // Pattern `index`'s length in bars.
  private writeBars(index: number, bars: number) {
    this.drumsMap.set(
      'bars',
      Array.from({ length: DRUM_PATTERNS }, (_, i) => (i === index ? bars : this.drumBars(i)))
    )
  }

  private writeDrums(drums: Drums | null) {
    this.drumsMap.set('bpm', drums?.bpm ?? 110)
    this.drumsMap.set('volume', drums?.volume ?? 0.8)
    this.drumsMap.set('swing', drums?.swing ?? 50)
    this.drumsMap.set('humanize', drums?.humanize ?? 0)
    this.drumsMap.set('crush', drums?.crush ?? 0)
    this.drumsMap.set('kit', drums?.kit ?? 'classic')
    this.drumsMap.set('voices', fillVoices(drums?.voices))
    const bars = (i: number) => drums?.bars?.[i] ?? 1
    this.drumsMap.set(
      'bars',
      Array.from({ length: DRUM_PATTERNS }, (_, i) => bars(i))
    )
    this.drumsMap.set(
      'lengths',
      Array.from({ length: DRUM_PATTERNS }, (_, i) => drums?.lengths?.[i] ?? {})
    )
    this.drumsMap.set(
      'fillLengths',
      Array.from({ length: DRUM_PATTERNS }, (_, i) => drums?.fillLengths?.[i] ?? {})
    )
    const source = drums ? drums.patterns : [DEFAULT_PATTERN]
    const grid = (i: number) => drums?.grids?.[i] ?? STEPS
    this.patternsArray.push(
      Array.from({ length: DRUM_PATTERNS }, (_, i) =>
        patternMap(source[i] ?? {}, grid(i) * bars(i))
      )
    )
    // A fill saved as null (or left out) follows its pattern: an empty map.
    this.fillsArray.push(
      Array.from({ length: DRUM_PATTERNS }, (_, i) => {
        const saved = drums?.fills?.[i]
        return saved ? patternMap(saved, grid(i)) : new Y.Map<DrumStep[]>()
      })
    )
  }

  // A pattern or fill's track lengths, by ref.
  private writeLengths(ref: number, lengths: TrackLengths) {
    const key = ref < FILL ? 'lengths' : 'fillLengths'
    const index = ref < FILL ? ref : ref - FILL
    const all = (this.drumsMap.get(key) as TrackLengths[] | undefined) ?? []
    this.drumsMap.set(
      key,
      Array.from({ length: DRUM_PATTERNS }, (_, i) => (i === index ? lengths : (all[i] ?? {})))
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

// A pattern's last bar (its rows are `bars` bars long): what an untouched fill plays.
const lastBar = (p: DrumPattern, bars: number): DrumPattern =>
  Object.fromEntries(
    Object.entries(p).map(([id, row]) => [id, row.slice(row.length - row.length / bars)])
  ) as DrumPattern

// The track lengths shorter than `steps`; the rest play the whole pattern.
const within = (lengths: TrackLengths, steps: number): TrackLengths =>
  Object.fromEntries(Object.entries(lengths).filter(([, n]) => n < steps))

// A saved pattern (or fill) as a map of full rows on its grid: it may omit tracks
// or steps (off), and stores plain on/off for steps with default settings.
function patternMap(saved: Partial<Record<TrackId, SavedStep[]>>, grid: number) {
  const map = new Y.Map<DrumStep[]>()
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
}

// A pattern as saved: steps with default settings and no locks save as plain on/off.
function savedPattern(p: DrumPattern): Partial<Record<TrackId, SavedStep[]>> {
  return Object.fromEntries(
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
}

function sectionMap(section: Section): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  map.set('id', crypto.randomUUID())
  map.set('name', section.name ?? '')
  map.set('bars', section.bars)
  map.set('drums', section.drums)
  if (section.bpm) map.set('bpm', section.bpm)
  map.set('pattern', section.pattern)
  if (section.fill) map.set('fill', true)
  map.set('pads', [...section.pads])
  if (section.automation && Object.keys(section.automation).length) {
    map.set('automation', plain(section.automation))
  }
  return map
}
