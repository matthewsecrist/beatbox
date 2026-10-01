<script lang="ts">
  import { Play, X } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'

  import type { SongStore } from './song.svelte.js'
  import type {
    DrumGrid,
    DrumPattern,
    DrumStep,
    Fill,
    KitId,
    LoadKitReply,
    PresetSummary,
    SaveKitReply,
    Scene,
    StateDetail,
    TrackId,
    TrackLengths,
    TransportDetail,
    Voices
  } from './types.js'

  import { crushBits } from './audio.js'
  import Channel from './Channel.svelte'
  import {
    createDrums,
    type Drums,
    gridOf,
    isAudible,
    type PatternFn,
    STEPS
  } from './drums/engine.js'
  import { euclid } from './drums/euclid.js'
  import { INSTRUMENT_IDS, INSTRUMENTS, KIT_SOUNDS, KITS, TRACKS } from './drums/kits.js'
  import { effects, panLabel } from './effects.js'
  import { help } from './help.js'
  import Info from './Info.svelte'
  import { DEFAULT_PATTERN, fillOf, STEP } from './song.svelte.js'
  import Tabs from './Tabs.svelte'

  const build = (
    step: (id: keyof DrumPattern, i: number) => boolean,
    grid: DrumGrid = STEPS
  ): DrumPattern => {
    const pattern = { ...DEFAULT_PATTERN }
    for (const { id } of TRACKS) {
      pattern[id] = Array.from({ length: grid }, (_, i) => ({ ...STEP, on: step(id, i) }))
    }
    return pattern
  }
  const empty = (grid: DrumGrid = STEPS): DrumPattern => build(() => false, grid)
  const LETTERS = ['A', 'B', 'C', 'D']
  const GRID_LABELS: [DrumGrid, string][] = [
    [16, '1/16'],
    [24, '1/16 triplets'],
    [12, '1/8 triplets']
  ]
  // Per-track hit probability; kick always lands on the downbeat so it still grooves.
  // The percussion tracks stay empty.
  const DENSITY: Partial<Record<keyof DrumPattern, number>> = {
    chat: 0.55,
    clap: 0.1,
    kick: 0.3,
    ohat: 0.1,
    snare: 0.2,
    tom: 0.1
  }
  const randomPattern = (grid: DrumGrid): DrumPattern =>
    build((id, i) => (id === 'kick' && i === 0) || Math.random() < (DENSITY[id] ?? 0), grid)

  // The instrument library by part, for the Kit tab's sound pickers.
  const LIBRARY = TRACKS.map((part) => ({
    ids: INSTRUMENT_IDS.filter((id) => INSTRUMENTS[id].part === part.id),
    part
  }))

  // What a click on a step changes. Outside Hits, a click on an off step switches it
  // on; on an on step it steps through the values. In Lock, it picks the step whose
  // tune and decay the lock sliders set (and plays it).
  type Mode = 'accent' | 'hits' | 'lock' | 'probability' | 'ratchet' | 'velocity'
  const MODES: { id: Mode; label: string }[] = [
    { id: 'hits', label: 'Hits' },
    { id: 'velocity', label: 'Velocity' },
    { id: 'accent', label: 'Accent' },
    { id: 'probability', label: 'Chance' },
    { id: 'ratchet', label: 'Ratchet' },
    { id: 'lock', label: 'Lock' }
  ]
  const LEVELS = [1, 0.75, 0.5, 0.25]
  const next = (values: number[], v: number) => values[(values.indexOf(v) + 1) % values.length] ?? v
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const semis = (v: number) => (v > 0 ? `+${v}` : String(v))
  const isLocked = (step: DrumStep) => step.tune !== undefined || step.decay !== undefined

  // Text shown on an on step: the edited value (in Lock, a locked tune), or in Hits
  // mode any ratchet.
  function badge(step: DrumStep): string {
    if (mode === 'velocity') return pct(step.velocity)
    if (mode === 'probability') return pct(step.probability)
    if (mode === 'lock') return step.tune === undefined ? '' : semis(step.tune)
    return step.ratchet > 1 ? `×${step.ratchet}` : ''
  }

  function click(track: keyof DrumPattern, i: number, step: DrumStep) {
    if (mode === 'lock') {
      lockStep = { step: i, track }
      drums?.trigger(track, step)
    }
    let patch: Partial<DrumStep>
    if (mode === 'hits') patch = { on: !step.on }
    else if (!step.on) patch = { on: true }
    else if (mode === 'lock') return
    else if (mode === 'accent') patch = { accent: !step.accent }
    else if (mode === 'ratchet') patch = { ratchet: next([1, 2, 3, 4], step.ratchet) }
    else patch = { [mode]: next(LEVELS, step[mode]) }
    store.setStep(editing, track, i, patch)
    // A percussion row stays put while you edit it, even once its last hit goes.
    added.add(track)
  }

  function describeStep(step: DrumStep): string {
    if (!step.on) return ''
    return [
      `velocity ${pct(step.velocity)}`,
      step.accent && 'accent',
      step.probability < 1 && `chance ${pct(step.probability)}`,
      step.ratchet > 1 && `ratchet ${step.ratchet}`,
      step.tune !== undefined && `tune locked ${semis(step.tune)}`,
      step.decay !== undefined && `decay locked ${pct(step.decay)}`
    ]
      .filter(Boolean)
      .join(', ')
  }

  // Patterns, tempo and level live in the song store (and its undo history).
  // The editor shows while the drums track is `selected`; the engine runs either way.
  // `kits` are the user's saved kits, which `saveKit` and `loadKit` fetch from the
  // server; signed out (`canSave` false) there are none, and nothing can be saved.
  let {
    canSave,
    kits,
    loadKit: fetchKit,
    saveKit: storeKit,
    selected,
    store
  }: {
    canSave: boolean
    kits: PresetSummary[]
    loadKit: (id: string) => Promise<LoadKitReply>
    saveKit: (name: string, kit: KitId, voices: Voices) => Promise<SaveKitReply>
    selected: boolean
    store: SongStore
  } = $props()

  type Tab = 'kit' | 'mix' | 'steps'
  const TABS: [Tab, string][] = [
    ['steps', 'Steps'],
    ['kit', 'Kit'],
    ['mix', 'Mix']
  ]
  let tab: Tab = $state('steps')

  // Patterns A-D; arrangement sections pick one by index.
  const patterns = $derived(store.drums.patterns)
  const volume = $derived(store.drums.volume)
  const swing = $derived(store.drums.swing)
  const humanize = $derived(store.drums.humanize)
  const crush = $derived(store.drums.crush)
  let picked = $state(0) // pattern tab picked (A-D)
  let fillShown = $state(false) // showing that pattern's fill bar instead
  // What the grid edits, as a pattern ref: the pattern, or its fill.
  const editing = $derived(fillShown ? fillOf(picked) : picked)
  const customFill = $derived(store.drums.customFills[picked] ?? false)
  let mode: Mode = $state('hits')
  const shown = $derived(store.drumPattern(editing) ?? empty())
  // Steps per bar in the pattern being edited (16ths, or 16th or 8th triplets).
  const grid = $derived(gridOf(shown))
  // Steps each track of that pattern loops over (polymeter): its own, or the bar.
  const lengths = $derived(store.drumLengths(editing) ?? {})
  const lengthOf = (id: TrackId) => Math.min(lengths[id] ?? grid, grid)
  // The step the lock sliders edit (UI-only), with its settings and its voice.
  let lockStep: null | { step: number; track: TrackId } = $state(null)
  const locking = $derived.by(() => {
    if (!lockStep) return null
    const step = shown[lockStep.track][lockStep.step]
    const track = TRACKS.find((t) => t.id === lockStep?.track)
    if (!step || !track) return null
    return { ...lockStep, label: track.label, value: step, voice: store.drums.voices[track.id] }
  })
  // Plays the step being locked, as it now sounds.
  const audition = () => locking && drums?.trigger(locking.track, locking.value)
  const setLock = (patch: Partial<Record<'decay' | 'tune', null | number>>) =>
    locking && store.setLocks(editing, locking.track, locking.step, patch)
  let playingPattern = $state(-1) // pattern currently sounding, -1 when stopped
  // Raw: its steps go back into the song document, which can't take state proxies.
  let clipboard: null | { lengths: TrackLengths; pattern: DrumPattern } = $state.raw(null)
  let songPlaying = false // while the arrangement plays, it picks the pattern
  let playing = $state(false)
  let current = $state(-1) // steps played since the start; -1 when stopped
  let drums: Drums | null = null
  // The saved kit last loaded or saved, with the song's kit as it was then. The Kit
  // menu shows it only while the song's kit still matches (not after an edit or undo).
  let savedKit = $state<null | { id: string; state: string }>(null)
  const kitState = $derived(JSON.stringify([store.drums.kit, store.drums.voices]))
  const kitShown = $derived(savedKit?.state === kitState ? 'saved:' + savedKit.id : store.drums.kit)
  let kitName = $state('')
  let status = $state('')
  let statusTimer: ReturnType<typeof setTimeout> | undefined
  // Mute and solo are for listening only, so they stay here rather than in the song.
  const muted = new SvelteSet<TrackId>()
  const soloed = new SvelteSet<TrackId>()
  const flip = (set: SvelteSet<TrackId>, id: TrackId) => {
    if (!set.delete(id)) set.add(id)
  }
  // The grid shows the core tracks, percussion the pattern uses, and percussion
  // added here to write into (a view setting, like mute: not saved).
  const added = new SvelteSet<TrackId>()
  const rows = $derived(
    TRACKS.filter((t) => t.core || added.has(t.id) || shown[t.id].some((s) => s.on))
  )
  const addable = $derived(TRACKS.filter((t) => !rows.includes(t)))
  // The Euclid generator: `hits` spread evenly over a cycle of `steps`, turned
  // `rotation` steps later and repeated across the bar, for one track.
  let euclidTrack: TrackId = $state('kick')
  let euclidHits = $state(3)
  let euclidSteps = $state(8)
  let euclidRotation = $state(0)
  // Kept inside the grid: a triplet grid's bar has fewer (or more) steps.
  const euclidCycle = $derived.by(() => {
    const steps = Math.min(euclidSteps, grid)
    return {
      hits: Math.min(euclidHits, steps),
      rotation: Math.min(euclidRotation, steps - 1),
      steps
    }
  })
  const euclidPreview = $derived(
    euclid(euclidCycle.hits, euclidCycle.steps, euclidCycle.rotation, grid)
  )

  // Writes the rhythm into the track, as one undo step; its row stays in the grid.
  function applyEuclid() {
    store.setHits(editing, euclidTrack, euclidPreview)
    added.add(euclidTrack)
  }

  // Fewer steps can't hold as many hits, or turn as far.
  function setEuclidSteps(n: number) {
    euclidSteps = n
    euclidHits = Math.min(euclidHits, n)
    euclidRotation = Math.min(euclidRotation, n - 1)
  }

  // Read on every step, so edits (and undo) are heard at once; mute and solo are
  // the engine's `audible`, so the pattern (and its grid) stays whole.
  const patternFn =
    (ref: number): PatternFn =>
    () => ({ lengths: store.drumLengths(ref) ?? {}, steps: store.drumPattern(ref) ?? {} })
  const isEmpty = (p: DrumPattern | undefined) =>
    !p || Object.values(p).every((steps) => !steps.some((s) => s.on))

  onMount(() => {
    const engine = createDrums({
      audible: (id) => isAudible(id, muted, soloed),
      onKick: (at, level) => effects.duck(at, level),
      onPattern: (i) => (playingPattern = i ?? -1),
      onStep: (s) => (current = s),
      onStop: () => {
        playing = false
        playingPattern = -1
      },
      output: () => effects.channel('drums')
    })
    drums = engine
    // `drums` isn't reactive, so don't rely on the effects below to pick up the loaded song.
    engine.setVolume(volume)
    engine.setSwing(swing)
    engine.setHumanize(humanize)
    engine.setCrush(crush)
    engine.setKit(store.drums.kit, store.drums.voices)
    // Song-bar Play (with no arrangement) / Stop, and its state reports.
    const onTransport = (e: CustomEvent<TransportDetail>) => {
      if (e.detail.play !== playing) toggle()
    }
    const onReport = () => report(playing)
    const onState = ({ detail }: CustomEvent<StateDetail>) => {
      if (detail.source === 'song') songPlaying = detail.playing
    }
    // Arrangement scene: play or stop from the section boundary beat.
    const onScene = ({ detail }: CustomEvent<Scene>) => {
      if (detail.drums) {
        engine.start(patternFn(detail.pattern), detail.beat, detail.pattern)
        playing = true
      } else {
        engine.stopAt(detail.beat) // `playing` goes false via onStop on that beat
      }
    }
    // A section's fill: its last bar plays its pattern's fill.
    const onFill = ({ detail }: CustomEvent<Fill>) => {
      engine.start(patternFn(fillOf(detail.pattern)), detail.beat, fillOf(detail.pattern))
    }
    window.addEventListener('beatbox:transport', onTransport)
    window.addEventListener('beatbox:report', onReport)
    window.addEventListener('beatbox:scene', onScene)
    window.addEventListener('beatbox:fill', onFill)
    window.addEventListener('beatbox:state', onState)
    return () => {
      window.removeEventListener('beatbox:transport', onTransport)
      window.removeEventListener('beatbox:report', onReport)
      window.removeEventListener('beatbox:scene', onScene)
      window.removeEventListener('beatbox:fill', onFill)
      window.removeEventListener('beatbox:state', onState)
      engine.close()
      report(false)
      clearTimeout(statusTimer)
    }
  })

  const report = (on: boolean): void => {
    window.dispatchEvent(
      new CustomEvent('beatbox:state', { detail: { playing: on, source: 'drums' } })
    )
  }
  $effect(() => report(playing))

  $effect(() => drums?.setVolume(volume))
  $effect(() => drums?.setSwing(swing))
  $effect(() => drums?.setHumanize(humanize))
  $effect(() => drums?.setCrush(crush))
  $effect(() => drums?.setKit(store.drums.kit, store.drums.voices))

  // Pick the tab (or its fill) to edit; when playing on its own, also switch to
  // it on the next bar, so a fill can be heard looping while it's written.
  function selectPattern(i: number, fill = fillShown) {
    picked = i
    fillShown = fill
    if (playing && !songPlaying) drums?.start(patternFn(editing), undefined, editing)
  }

  function toggle() {
    if (!drums) return
    if (playing) return drums.stop() // onStop clears `playing`
    drums.start(patternFn(editing), undefined, editing)
    playing = true
  }

  const setEditing = (p: DrumPattern, l?: TrackLengths) => store.setPattern(editing, p, l)

  // The Kit menu: a factory kit, or one of the user's saved kits ("saved:<id>").
  function pickKit(value: string) {
    if (value.startsWith('saved:')) {
      const id = value.slice(6)
      void fetchKit(id).then((reply) => {
        if ('error' in reply) return showStatus(reply.error)
        store.setKit(reply.kit, reply.voices)
        savedKit = { id, state: kitState }
        kitName = reply.name
      })
      return
    }
    const kit = KITS.find((k) => k.id === value)
    if (!kit) return
    store.setKit(kit.id)
    savedKit = null
  }

  // Picks a library instrument for a track and plays it, so the choice is heard.
  function pickSound(track: TrackId, value: string) {
    const sound = INSTRUMENT_IDS.find((id) => id === value)
    if (!sound) return
    store.setSound(track, sound)
    // The kit effect above would pass the new sound on too late for this hit.
    drums?.setKit(store.drums.kit, store.drums.voices)
    drums?.trigger(track)
  }

  function saveKit() {
    const state = kitState
    void storeKit(kitName, store.drums.kit, store.drums.voices).then((reply) => {
      if ('error' in reply) return showStatus(reply.error)
      savedKit = { id: reply.id, state }
      showStatus('Saved “' + reply.name + '”')
    })
  }

  function showStatus(msg: string) {
    status = msg
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => (status = ''), 3000)
  }

  const btn =
    'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95'
</script>

<section
  id="drums"
  aria-label="Drums"
  hidden={!selected}
  class="@container space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
>
  <div class="flex items-center justify-between gap-3">
    <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Drums</h2>
    <button
      id="drums-play"
      type="button"
      onclick={toggle}
      aria-pressed={playing}
      class={[
        'w-20 rounded-md px-4 py-1.5 text-sm font-semibold transition active:scale-95',
        playing
          ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
          : 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/20 hover:bg-amber-300'
      ]}
    >
      {playing ? 'Stop' : 'Play'}
    </button>
  </div>

  <Tabs id="drum-tabs" label="Drums editor" tabs={TABS} bind:value={tab}>
    {#if tab === 'steps'}
      <div id="drum-controls" class="grid max-w-xl gap-x-6 gap-y-2 sm:grid-cols-2">
        <label
          class="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"
          for="drums-swing"
        >
          <span class="flex items-center gap-1"
            >Swing<Info label="Swing" text={help('swing') ?? ''} /></span
          >
          <input
            id="drums-swing"
            type="range"
            min="50"
            max="75"
            step="1"
            value={swing}
            disabled={store.readOnly}
            oninput={(e) => store.setDrums({ swing: Number(e.currentTarget.value) })}
            class="min-w-0 flex-1 cursor-pointer accent-amber-400 disabled:cursor-default"
          />
          <span class="w-8 font-mono text-amber-300 tabular-nums">{swing}%</span>
        </label>
        <label
          class="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"
          for="drums-humanize"
        >
          <span class="flex items-center gap-1"
            >Humanize<Info label="Humanize" text={help('humanize') ?? ''} /></span
          >
          <input
            id="drums-humanize"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={humanize}
            disabled={store.readOnly}
            oninput={(e) => store.setDrums({ humanize: Number(e.currentTarget.value) })}
            class="min-w-0 flex-1 cursor-pointer accent-amber-400 disabled:cursor-default"
          />
          <span class="w-8 font-mono text-amber-300 tabular-nums"
            >{humanize ? `${Math.round(humanize * 100)}%` : 'off'}</span
          >
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div
          id="drum-patterns"
          class="flex gap-1 rounded-lg bg-zinc-900 p-1"
          role="group"
          aria-label="Pattern"
        >
          {#each LETTERS as letter, i (letter)}
            <button
              id={'drums-pattern-' + letter.toLowerCase()}
              type="button"
              aria-pressed={picked === i}
              aria-label={`Pattern ${letter}${playingPattern === i || playingPattern === fillOf(i) ? ' (playing)' : ''}`}
              onclick={() => selectPattern(i)}
              class={[
                'relative h-8 w-10 rounded-md text-sm font-bold transition active:scale-95',
                picked === i
                  ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/20'
                  : isEmpty(patterns[i])
                    ? 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300'
                    : 'text-zinc-300 hover:bg-zinc-800'
              ]}
            >
              {letter}
              {#if playingPattern === i || playingPattern === fillOf(i)}
                <span
                  class="absolute right-1 top-1 size-1.5 animate-pulse rounded-full bg-emerald-400"
                ></span>
              {/if}
            </button>
          {/each}
        </div>
        <div
          id="drum-fill-switch"
          class="flex items-center gap-1 rounded-lg bg-zinc-900 p-1"
          role="group"
          aria-label="Pattern or its fill"
        >
          {#each [false, true] as fill (fill)}
            <button
              id={fill ? 'drums-show-fill' : 'drums-show-pattern'}
              type="button"
              aria-pressed={fillShown === fill}
              onclick={() => selectPattern(picked, fill)}
              class={[
                'rounded-md px-3 py-1 text-xs font-semibold transition active:scale-95',
                fillShown === fill
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              ]}
            >
              {fill ? 'Fill' : 'Pattern'}
            </button>
          {/each}
          <Info label="Fill" text={help('drums_fill') ?? ''} />
        </div>
        <span id="drums-editing" class="text-xs text-zinc-500"
          >{store.readOnly ? 'Showing' : 'Editing'}
          {LETTERS[picked]}{fillShown
            ? customFill
              ? ' fill'
              : ` fill (the same as ${LETTERS[picked]} until you change it)`
            : ''}</span
        >
        <label class="mr-auto flex items-center gap-1 text-xs text-zinc-500" for="drums-grid">
          <span class="flex items-center gap-1"
            >Grid<Info label="Grid" text={help('drums_grid') ?? ''} /></span
          >
          <select
            id="drums-grid"
            value={grid}
            disabled={store.readOnly || fillShown || !isEmpty(shown)}
            title={fillShown
              ? 'A fill is on its pattern’s grid'
              : isEmpty(shown)
                ? undefined
                : 'Clear the pattern to change its grid'}
            onchange={(e) => store.setGrid(editing, Number(e.currentTarget.value) as DrumGrid)}
            class="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 disabled:opacity-60"
          >
            {#each GRID_LABELS as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>
        </label>
        {#if !store.readOnly}
          <button
            id="drums-copy"
            type="button"
            class={btn}
            onclick={() => (clipboard = { lengths, pattern: shown })}
          >
            Copy
          </button>
          <button
            id="drums-paste"
            type="button"
            class={[btn, 'disabled:pointer-events-none disabled:opacity-40']}
            disabled={!clipboard}
            onclick={() => clipboard && setEditing(clipboard.pattern, clipboard.lengths)}
          >
            Paste
          </button>
          <button
            id="drums-clear"
            type="button"
            class={btn}
            onclick={() => setEditing(empty(grid))}
          >
            Clear
          </button>
          <button
            id="drums-randomize"
            type="button"
            class={btn}
            onclick={() => setEditing(randomPattern(grid))}
          >
            Randomize
          </button>
          <button
            id="drums-reset"
            type="button"
            class={[btn, 'disabled:pointer-events-none disabled:opacity-40']}
            disabled={fillShown && !customFill}
            title={fillShown ? 'Make the fill the same as its pattern again' : undefined}
            onclick={() => (fillShown ? store.resetFill(picked) : setEditing(DEFAULT_PATTERN))}
          >
            Reset
          </button>
        {/if}
      </div>

      {#if !store.readOnly}
        <div
          id="drum-edit-mode"
          class="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-zinc-900 p-1"
          role="group"
          aria-label="Step edit"
        >
          {#each MODES as m (m.id)}
            <span class="flex items-center gap-0.5 pr-1">
              <button
                id={'drums-mode-' + m.id}
                type="button"
                aria-pressed={mode === m.id}
                onclick={() => (mode = m.id)}
                class={[
                  'rounded-md px-3 py-1 text-xs font-semibold transition active:scale-95',
                  mode === m.id
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                ]}
              >
                {m.label}
              </button>
              <Info label={m.label} text={help('step_' + m.id) ?? ''} />
            </span>
          {/each}
        </div>
        {#if mode === 'lock'}
          <div
            id="drum-locks"
            class="flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-zinc-900 px-3 py-2"
            role="group"
            aria-label="Step locks"
          >
            {#if locking}
              {@const { value, voice } = locking}
              <span
                id="drums-lock-target"
                class="text-xs font-semibold uppercase tracking-wider text-zinc-400"
                >{locking.label} step {locking.step + 1}</span
              >
              <label class="flex items-center gap-2 text-xs text-zinc-400">
                Tune
                <input
                  id="drums-lock-tune"
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={value.tune ?? voice.tune}
                  oninput={(e) => setLock({ tune: Number(e.currentTarget.value) })}
                  onchange={audition}
                  class="w-28 cursor-pointer accent-sky-400"
                />
                <span
                  class={[
                    'w-12 font-mono tabular-nums',
                    value.tune === undefined ? 'text-zinc-500' : 'text-sky-300'
                  ]}>{value.tune === undefined ? 'Voice' : semis(value.tune)}</span
                >
              </label>
              <label class="flex items-center gap-2 text-xs text-zinc-400">
                Decay
                <input
                  id="drums-lock-decay"
                  type="range"
                  min="0.25"
                  max="2"
                  step="0.05"
                  value={value.decay ?? voice.decay}
                  oninput={(e) => setLock({ decay: Number(e.currentTarget.value) })}
                  onchange={audition}
                  class="w-28 cursor-pointer accent-sky-400"
                />
                <span
                  class={[
                    'w-12 font-mono tabular-nums',
                    value.decay === undefined ? 'text-zinc-500' : 'text-sky-300'
                  ]}>{value.decay === undefined ? 'Voice' : pct(value.decay)}</span
                >
              </label>
              <button
                id="drums-lock-clear"
                type="button"
                class={[btn, 'disabled:pointer-events-none disabled:opacity-40']}
                disabled={!isLocked(value)}
                onclick={() => setLock({ decay: null, tune: null })}
              >
                Clear
              </button>
            {:else}
              <span class="text-xs text-zinc-500"
                >Click a step to lock its tune and decay for that hit.</span
              >
            {/if}
          </div>
        {/if}
        <div
          id="drum-euclid"
          class="flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-zinc-900 px-3 py-2"
          role="group"
          aria-label="Euclidean rhythm"
        >
          <span
            class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-400"
            >Euclid<Info label="Euclid" text={help('drums_euclid') ?? ''} /></span
          >
          <select
            id="drums-euclid-track"
            bind:value={euclidTrack}
            aria-label="Euclid track"
            class="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
          >
            {#each TRACKS as track (track.id)}
              <option value={track.id}>{track.label}</option>
            {/each}
          </select>
          <label class="flex items-center gap-2 text-xs text-zinc-400">
            Hits
            <input
              id="drums-euclid-hits"
              type="range"
              min="0"
              max={euclidCycle.steps}
              step="1"
              value={euclidCycle.hits}
              oninput={(e) => (euclidHits = Number(e.currentTarget.value))}
              class="w-20 cursor-pointer accent-amber-400"
            />
            <span class="w-5 font-mono text-amber-300 tabular-nums">{euclidCycle.hits}</span>
          </label>
          <label class="flex items-center gap-2 text-xs text-zinc-400">
            Steps
            <input
              id="drums-euclid-steps"
              type="range"
              min="1"
              max={grid}
              step="1"
              value={euclidCycle.steps}
              oninput={(e) => setEuclidSteps(Number(e.currentTarget.value))}
              class="w-20 cursor-pointer accent-amber-400"
            />
            <span class="w-5 font-mono text-amber-300 tabular-nums">{euclidCycle.steps}</span>
          </label>
          <label class="flex items-center gap-2 text-xs text-zinc-400">
            Rotate
            <input
              id="drums-euclid-rotation"
              type="range"
              min="0"
              max={euclidCycle.steps - 1}
              step="1"
              value={euclidCycle.rotation}
              oninput={(e) => (euclidRotation = Number(e.currentTarget.value))}
              class="w-20 cursor-pointer accent-amber-400"
            />
            <span class="w-5 font-mono text-amber-300 tabular-nums">{euclidCycle.rotation}</span>
          </label>
          <div
            id="drums-euclid-preview"
            class="grid w-40 gap-0.5"
            style:grid-template-columns={`repeat(${grid}, minmax(0, 1fr))`}
            aria-hidden="true"
          >
            {#each euclidPreview as on, i (i)}
              <span
                class={[
                  'h-3 rounded-sm',
                  on ? 'bg-amber-400' : i % (grid / 4) === 0 ? 'bg-zinc-700' : 'bg-zinc-800'
                ]}
              ></span>
            {/each}
          </div>
          <button id="drums-euclid-apply" type="button" class={btn} onclick={applyEuclid}>
            Apply
          </button>
        </div>
      {/if}

      <div id="drum-grid" class="space-y-1.5 overflow-x-auto">
        <div class="flex min-w-[40rem] items-center justify-end gap-2">
          <span
            class="flex w-16 shrink-0 items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500"
            >Length<Info label="Length" text={help('drums_length') ?? ''} /></span
          >
          {#if !store.readOnly}
            <span class="size-7 shrink-0"></span>
          {/if}
        </div>
        {#each rows as track (track.id)}
          {@const heard = isAudible(track.id, muted, soloed)}
          {@const len = lengthOf(track.id)}
          <div class="flex min-w-[40rem] items-center gap-2">
            <button
              type="button"
              onclick={() => drums?.trigger(track.id)}
              class="w-24 shrink-0 truncate rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
            >
              {track.label}
            </button>
            <button
              id={'drums-mute-' + track.id}
              type="button"
              aria-label={`Mute ${track.label}`}
              aria-pressed={muted.has(track.id)}
              title={soloed.size && muted.has(track.id) ? 'Muted (a solo overrides it)' : 'Mute'}
              onclick={() => flip(muted, track.id)}
              class={[
                'size-7 shrink-0 rounded-md border text-xs font-bold transition active:scale-95',
                muted.has(track.id)
                  ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              ]}>M</button
            >
            <button
              id={'drums-solo-' + track.id}
              type="button"
              aria-label={`Solo ${track.label}`}
              aria-pressed={soloed.has(track.id)}
              title="Solo"
              onclick={() => flip(soloed, track.id)}
              class={[
                'size-7 shrink-0 rounded-md border text-xs font-bold transition active:scale-95',
                soloed.has(track.id)
                  ? 'border-amber-400 bg-amber-400 text-zinc-900'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              ]}>S</button
            >
            <div
              class={['grid flex-1 gap-1 transition-opacity', !heard && 'opacity-40']}
              style:grid-template-columns={`repeat(${grid}, minmax(0, 1fr))`}
            >
              {#each shown[track.id] as step, i (i)}
                {@const detail = describeStep(step)}
                <button
                  type="button"
                  aria-label={`${track.label} step ${i + 1}${detail && ', ' + detail}`}
                  aria-pressed={step.on}
                  disabled={store.readOnly}
                  onclick={() => click(track.id, i, step)}
                  style:opacity={step.on ? 0.35 + 0.65 * step.velocity : undefined}
                  class={[
                    'relative h-8 rounded text-[10px] font-bold text-zinc-900 transition-colors duration-75 disabled:pointer-events-none',
                    step.on
                      ? 'bg-amber-400 shadow shadow-amber-400/30 hover:bg-amber-300'
                      : i % (grid / 4) === 0
                        ? 'bg-zinc-700 hover:bg-zinc-600'
                        : 'bg-zinc-800 hover:bg-zinc-700',
                    step.on &&
                      step.probability < 1 &&
                      'outline-dashed outline-2 -outline-offset-4 outline-zinc-900/70',
                    // Past the track's length: never played.
                    i >= len && 'brightness-50',
                    current >= 0 &&
                      current % len === i &&
                      editing === playingPattern &&
                      'ring-2 ring-zinc-100/80',
                    mode === 'lock' &&
                      locking?.track === track.id &&
                      locking.step === i &&
                      'ring-2 ring-sky-400'
                  ]}
                >
                  {#if step.on}
                    {badge(step)}
                    {#if step.accent}
                      <span class="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-rose-600"
                      ></span>
                    {/if}
                    {#if isLocked(step)}
                      <span class="absolute bottom-0.5 left-0.5 size-1.5 rounded-full bg-sky-700"
                      ></span>
                    {/if}
                  {/if}
                </button>
              {/each}
            </div>
            <input
              id={'drums-length-' + track.id}
              type="number"
              min="1"
              max={grid}
              value={len}
              disabled={store.readOnly}
              aria-label={`${track.label} length`}
              title={`${track.label} loops over ${len} steps`}
              onchange={(e) => {
                store.setLength(editing, track.id, e.currentTarget.valueAsNumber || null)
                // Out of range (or unchanged), the store keeps its value: show it again.
                e.currentTarget.value = String(lengthOf(track.id))
              }}
              class="w-16 shrink-0 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs tabular-nums text-zinc-200 disabled:opacity-60"
            />
            {#if !store.readOnly}
              {#if !track.core && !shown[track.id].some((s) => s.on)}
                <button
                  id={'drums-hide-' + track.id}
                  type="button"
                  aria-label={`Hide ${track.label}`}
                  title="Hide this empty track"
                  onclick={() => added.delete(track.id)}
                  class="grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
                >
                  <X class="size-3.5" />
                </button>
              {:else}
                <span class="size-7 shrink-0"></span>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
      {#if !store.readOnly && addable.length}
        <label
          class="flex w-fit items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"
          for="drums-add-track"
        >
          <span class="flex items-center gap-1"
            >Add track<Info label="Add track" text={help('drums_tracks') ?? ''} /></span
          >
          <select
            id="drums-add-track"
            value=""
            onchange={(e) => {
              const track = addable.find((t) => t.id === e.currentTarget.value)
              if (track) added.add(track.id)
              e.currentTarget.value = ''
            }}
            class="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm normal-case text-zinc-200"
          >
            <option value="" disabled>Choose…</option>
            {#each addable as track (track.id)}
              <option value={track.id}>{track.label}</option>
            {/each}
          </select>
        </label>
      {/if}
    {:else if tab === 'kit'}
      <div id="kit-bar" class="flex flex-wrap items-center gap-2">
        <label
          class="flex min-w-60 items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"
          for="drums-kit"
        >
          <span class="flex items-center gap-1"
            >Kit<Info label="Kit" text={help('kit') ?? ''} /></span
          >
          <select
            id="drums-kit"
            value={kitShown}
            disabled={store.readOnly}
            onchange={(e) => pickKit(e.currentTarget.value)}
            class="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm normal-case text-zinc-200"
          >
            <optgroup label="Factory">
              {#each KITS as kit (kit.id)}
                <option value={kit.id}>{kit.label}</option>
              {/each}
            </optgroup>
            {#if kits.length}
              <optgroup label="Saved">
                {#each kits as kit (kit.id)}
                  <option value={'saved:' + kit.id}>{kit.name}</option>
                {/each}
              </optgroup>
            {/if}
          </select>
        </label>
        {#if !store.readOnly}
          <input
            id="kit-name"
            type="text"
            maxlength="60"
            placeholder={canSave ? 'Kit name' : 'Sign in to save kits'}
            disabled={!canSave}
            bind:value={kitName}
            class="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 transition focus:border-amber-400 focus:outline-none disabled:opacity-60"
          />
          <button
            id="save-kit"
            type="button"
            disabled={!canSave || kitName.trim() === ''}
            onclick={saveKit}
            class="rounded-md bg-amber-400 px-4 py-1 text-sm font-semibold text-zinc-900 shadow shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            Save kit
          </button>
          <span id="kit-status" class="text-xs text-zinc-400" aria-live="polite">{status}</span>
        {/if}
      </div>
      <label
        class="flex max-w-sm items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"
        for="drums-crush"
      >
        <span class="flex items-center gap-1"
          >Crush<Info label="Crush" text={help('drums_crush') ?? ''} /></span
        >
        <input
          id="drums-crush"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={crush}
          disabled={store.readOnly}
          oninput={(e) => store.setDrums({ crush: Number(e.currentTarget.value) })}
          class="min-w-0 flex-1 cursor-pointer accent-amber-400 disabled:cursor-default"
        />
        <span class="w-12 font-mono text-amber-300 tabular-nums"
          >{crush ? `${crushBits(crush)}-bit` : 'off'}</span
        >
      </label>
      <div
        id="drum-voices"
        class="grid max-w-4xl grid-cols-[auto_minmax(0,1.5fr)_auto_1fr_1fr_1fr] items-center gap-x-4 gap-y-2"
      >
        <span></span>
        <span class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500"
          >Sound<Info label="Sound" text={help('drums_sound') ?? ''} /></span
        >
        <span></span>
        <span class="text-[10px] uppercase tracking-wider text-zinc-500">Tune</span>
        <span class="text-[10px] uppercase tracking-wider text-zinc-500">Decay</span>
        <span class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500"
          >Pan<Info label="Pan" text={help('drums_voice_pan') ?? ''} /></span
        >
        {#each TRACKS as track (track.id)}
          {@const voice = store.drums.voices[track.id]}
          <span class="text-xs font-semibold uppercase tracking-wide text-zinc-400"
            >{track.label}</span
          >
          <select
            id={'drums-sound-' + track.id}
            value={voice.sound ?? KIT_SOUNDS[store.drums.kit][track.id]}
            disabled={store.readOnly}
            onchange={(e) => pickSound(track.id, e.currentTarget.value)}
            aria-label={`${track.label} sound`}
            class={[
              'min-w-0 rounded-md border bg-zinc-800 px-2 py-1 text-sm text-zinc-200',
              voice.sound ? 'border-amber-400/60' : 'border-zinc-700'
            ]}
          >
            {#each LIBRARY as { ids, part } (part.id)}
              <optgroup label={part.label}>
                {#each ids as id (id)}
                  <option value={id}>{INSTRUMENTS[id].label}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
          <button
            id={'drums-preview-' + track.id}
            type="button"
            aria-label={`Play ${track.label}`}
            title="Play"
            onclick={() => drums?.trigger(track.id)}
            class="grid size-7 place-items-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95"
          >
            <Play class="size-3.5" />
          </button>
          <input
            id={'drums-tune-' + track.id}
            type="range"
            min="-12"
            max="12"
            step="1"
            value={voice.tune}
            disabled={store.readOnly}
            oninput={(e) => store.setVoice(track.id, { tune: Number(e.currentTarget.value) })}
            aria-label={`${track.label} tune`}
            title={`Tune ${voice.tune} semitones`}
            class="w-full cursor-pointer accent-amber-400 disabled:cursor-default"
          />
          <input
            id={'drums-decay-' + track.id}
            type="range"
            min="0.25"
            max="2"
            step="0.05"
            value={voice.decay}
            disabled={store.readOnly}
            oninput={(e) => store.setVoice(track.id, { decay: Number(e.currentTarget.value) })}
            aria-label={`${track.label} decay`}
            title={`Decay ${pct(voice.decay)}`}
            class="w-full cursor-pointer accent-amber-400 disabled:cursor-default"
          />
          <input
            id={'drums-pan-' + track.id}
            type="range"
            min="-1"
            max="1"
            step="0.05"
            value={voice.pan ?? 0}
            disabled={store.readOnly}
            oninput={(e) => store.setVoice(track.id, { pan: Number(e.currentTarget.value) })}
            ondblclick={() => store.setVoice(track.id, { pan: 0 })}
            aria-label={`${track.label} pan`}
            title={`Pan ${panLabel(voice.pan ?? 0)} (double-click to centre)`}
            class="w-full cursor-pointer accent-amber-400 disabled:cursor-default"
          />
        {/each}
      </div>
    {:else}
      <Channel instrument="drums" {store} />
    {/if}
  </Tabs>
</section>
