<script lang="ts">
  import { onMount } from 'svelte'

  import type { SongStore } from './song.svelte.js'
  import type { DrumPattern, DrumStep, Scene, StateDetail, TransportDetail } from './types.js'

  import { createDrums, type Drums, KITS, STEPS, TRACKS } from './drums/engine.js'
  import { effects } from './effects.js'
  import { DEFAULT_PATTERN, STEP } from './song.svelte.js'
  import { transport } from './transport.js'

  const build = (step: (id: keyof DrumPattern, i: number) => boolean): DrumPattern => {
    const pattern = { ...DEFAULT_PATTERN }
    for (const { id } of TRACKS) {
      pattern[id] = Array.from({ length: STEPS }, (_, i) => ({ ...STEP, on: step(id, i) }))
    }
    return pattern
  }
  const empty = (): DrumPattern => build(() => false)
  const LETTERS = ['A', 'B', 'C', 'D']
  // Per-track hit probability; kick always lands on the downbeat so it still grooves.
  const DENSITY: Record<keyof DrumPattern, number> = {
    chat: 0.55,
    clap: 0.1,
    kick: 0.3,
    ohat: 0.1,
    snare: 0.2,
    tom: 0.1
  }
  const randomPattern = (): DrumPattern =>
    build((id, i) => (id === 'kick' && i === 0) || Math.random() < DENSITY[id])

  // What a click on a step changes. Outside Hits, a click on an off step switches it
  // on; on an on step it steps through the values.
  type Mode = 'accent' | 'hits' | 'probability' | 'ratchet' | 'velocity'
  const MODES: { id: Mode; label: string }[] = [
    { id: 'hits', label: 'Hits' },
    { id: 'velocity', label: 'Velocity' },
    { id: 'accent', label: 'Accent' },
    { id: 'probability', label: 'Chance' },
    { id: 'ratchet', label: 'Ratchet' }
  ]
  const LEVELS = [1, 0.75, 0.5, 0.25]
  const next = (values: number[], v: number) => values[(values.indexOf(v) + 1) % values.length] ?? v
  const pct = (v: number) => `${Math.round(v * 100)}%`

  // Text shown on an on step: the edited value, or in Hits mode any ratchet.
  function badge(step: DrumStep): string {
    if (mode === 'velocity') return pct(step.velocity)
    if (mode === 'probability') return pct(step.probability)
    return step.ratchet > 1 ? `×${step.ratchet}` : ''
  }

  function click(track: keyof DrumPattern, i: number, step: DrumStep) {
    let patch: Partial<DrumStep>
    if (mode === 'hits') patch = { on: !step.on }
    else if (!step.on) patch = { on: true }
    else if (mode === 'accent') patch = { accent: !step.accent }
    else if (mode === 'ratchet') patch = { ratchet: next([1, 2, 3, 4], step.ratchet) }
    else patch = { [mode]: next(LEVELS, step[mode]) }
    store.setStep(editing, track, i, patch)
  }

  function describeStep(step: DrumStep): string {
    if (!step.on) return ''
    return [
      `velocity ${pct(step.velocity)}`,
      step.accent && 'accent',
      step.probability < 1 && `chance ${pct(step.probability)}`,
      step.ratchet > 1 && `ratchet ${step.ratchet}`
    ]
      .filter(Boolean)
      .join(', ')
  }

  // Patterns, tempo and level live in the song store (and its undo history).
  let { store }: { store: SongStore } = $props()

  // Patterns A-D; arrangement sections pick one by index.
  const patterns = $derived(store.drums.patterns)
  const bpm = $derived(store.drums.bpm)
  const volume = $derived(store.drums.volume)
  const swing = $derived(store.drums.swing)
  let editing = $state(0) // tab shown in the grid
  let mode: Mode = $state('hits')
  const shown = $derived(patterns[editing] ?? empty())
  let playingPattern = $state(-1) // pattern currently sounding, -1 when stopped
  // Raw: its steps go back into the song document, which can't take state proxies.
  let clipboard: DrumPattern | null = $state.raw(null)
  let songPlaying = false // while the arrangement plays, it picks the pattern
  let playing = $state(false)
  let current = $state(-1)
  let drums: Drums | null = null

  // Read on every step, so edits (and undo) are heard at once.
  const patternFn = (i: number) => () => store.drums.patterns[i] ?? {}
  const isEmpty = (p: DrumPattern | undefined) =>
    !p || Object.values(p).every((steps) => !steps.some((s) => s.on))

  onMount(() => {
    const engine = createDrums({
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
    window.addEventListener('beatbox:transport', onTransport)
    window.addEventListener('beatbox:report', onReport)
    window.addEventListener('beatbox:scene', onScene)
    window.addEventListener('beatbox:state', onState)
    return () => {
      window.removeEventListener('beatbox:transport', onTransport)
      window.removeEventListener('beatbox:report', onReport)
      window.removeEventListener('beatbox:scene', onScene)
      window.removeEventListener('beatbox:state', onState)
      engine.close()
      report(false)
    }
  })

  const report = (on: boolean): void => {
    window.dispatchEvent(
      new CustomEvent('beatbox:state', { detail: { playing: on, source: 'drums' } })
    )
  }
  $effect(() => report(playing))

  // The tempo slider is the song's tempo: it drives the shared transport, so loop
  // pads follow it too. (Saved with the song as drums.bpm.)
  $effect(() => transport.setBpm(bpm))
  $effect(() => drums?.setVolume(volume))
  $effect(() => drums?.setSwing(swing))
  $effect(() => drums?.setKit(store.drums.kit, store.drums.voices))

  // Pick the tab to edit; when playing on its own, also switch to it on the next bar.
  function selectPattern(i: number) {
    editing = i
    if (playing && !songPlaying) drums?.start(patternFn(i), undefined, i)
  }

  function toggle() {
    if (!drums) return
    if (playing) return drums.stop() // onStop clears `playing`
    drums.start(patternFn(editing), undefined, editing)
    playing = true
  }

  const setEditing = (p: DrumPattern) => store.setPattern(editing, p)

  const btn =
    'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95'
</script>

<div
  class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
>
  <div class="flex flex-wrap items-center gap-3">
    <h2 class="mr-auto text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Drums</h2>
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
    <label
      class="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"
      for="drums-bpm"
      title="Song tempo — loops follow it too"
    >
      Tempo
      <input
        id="drums-bpm"
        type="range"
        min="60"
        max="200"
        step="1"
        value={bpm}
        oninput={(e) => store.setDrums({ bpm: Number(e.currentTarget.value) })}
        class="w-28 cursor-pointer accent-amber-400"
      />
      <span class="w-8 font-mono text-amber-300 tabular-nums">{bpm}</span>
    </label>
    <label
      class="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"
      for="drums-volume"
    >
      Level
      <input
        id="drums-volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        oninput={(e) => store.setDrums({ volume: Number(e.currentTarget.value) })}
        class="w-24 cursor-pointer accent-amber-400"
      />
    </label>
    <label
      class="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"
      for="drums-swing"
      title="Delays every second 16th: 50% is straight, 66% a triplet shuffle"
    >
      Swing
      <input
        id="drums-swing"
        type="range"
        min="50"
        max="75"
        step="1"
        value={swing}
        oninput={(e) => store.setDrums({ swing: Number(e.currentTarget.value) })}
        class="w-24 cursor-pointer accent-amber-400"
      />
      <span class="w-8 font-mono text-amber-300 tabular-nums">{swing}%</span>
    </label>
    <label
      class="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"
      for="drums-kit"
      title="Synthesized kits; choosing one resets tune and decay"
    >
      Kit
      <select
        id="drums-kit"
        value={store.drums.kit}
        onchange={(e) => {
          const kit = KITS.find((k) => k.id === e.currentTarget.value)
          if (kit) store.setKit(kit.id)
        }}
        class="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm normal-case text-zinc-200"
      >
        {#each KITS as kit (kit.id)}
          <option value={kit.id}>{kit.label}</option>
        {/each}
      </select>
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
          aria-pressed={editing === i}
          aria-label={`Pattern ${letter}${playingPattern === i ? ' (playing)' : ''}`}
          onclick={() => selectPattern(i)}
          class={[
            'relative h-8 w-10 rounded-md text-sm font-bold transition active:scale-95',
            editing === i
              ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/20'
              : isEmpty(patterns[i])
                ? 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300'
                : 'text-zinc-300 hover:bg-zinc-800'
          ]}
        >
          {letter}
          {#if playingPattern === i}
            <span class="absolute right-1 top-1 size-1.5 animate-pulse rounded-full bg-emerald-400"
            ></span>
          {/if}
        </button>
      {/each}
    </div>
    <span class="mr-auto text-xs text-zinc-500">Editing {LETTERS[editing]}</span>
    <button id="drums-copy" type="button" class={btn} onclick={() => (clipboard = shown)}>
      Copy
    </button>
    <button
      id="drums-paste"
      type="button"
      class={[btn, 'disabled:pointer-events-none disabled:opacity-40']}
      disabled={!clipboard}
      onclick={() => clipboard && setEditing(clipboard)}
    >
      Paste
    </button>
    <button id="drums-clear" type="button" class={btn} onclick={() => setEditing(empty())}>
      Clear
    </button>
    <button
      id="drums-randomize"
      type="button"
      class={btn}
      onclick={() => setEditing(randomPattern())}
    >
      Randomize
    </button>
    <button id="drums-reset" type="button" class={btn} onclick={() => setEditing(DEFAULT_PATTERN)}>
      Reset
    </button>
  </div>

  <div
    id="drum-edit-mode"
    class="flex w-fit gap-1 rounded-lg bg-zinc-900 p-1"
    role="group"
    aria-label="Step edit"
  >
    {#each MODES as m (m.id)}
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
    {/each}
  </div>

  <div id="drum-grid" class="space-y-1.5 overflow-x-auto">
    <div
      class="flex min-w-[48rem] justify-end gap-2 text-[10px] uppercase tracking-wider text-zinc-500"
      aria-hidden="true"
    >
      <span class="w-16 text-center">Tune</span>
      <span class="w-16 text-center">Decay</span>
    </div>
    {#each TRACKS as track (track.id)}
      <div class="flex min-w-[48rem] items-center gap-2">
        <button
          type="button"
          onclick={() => drums?.trigger(track.id)}
          class="w-24 shrink-0 truncate rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
        >
          {track.label}
        </button>
        <div class="grid flex-1 grid-cols-16 gap-1">
          {#each shown[track.id] as step, i (i)}
            {@const detail = describeStep(step)}
            <button
              type="button"
              aria-label={`${track.label} step ${i + 1}${detail && ', ' + detail}`}
              aria-pressed={step.on}
              onclick={() => click(track.id, i, step)}
              style:opacity={step.on ? 0.35 + 0.65 * step.velocity : undefined}
              class={[
                'relative h-8 rounded text-[10px] font-bold text-zinc-900 transition-colors duration-75',
                step.on
                  ? 'bg-amber-400 shadow shadow-amber-400/30 hover:bg-amber-300'
                  : i % 4 === 0
                    ? 'bg-zinc-700 hover:bg-zinc-600'
                    : 'bg-zinc-800 hover:bg-zinc-700',
                step.on &&
                  step.probability < 1 &&
                  'outline-dashed outline-2 -outline-offset-4 outline-zinc-900/70',
                current === i && editing === playingPattern && 'ring-2 ring-zinc-100/80'
              ]}
            >
              {#if step.on}
                {badge(step)}
                {#if step.accent}
                  <span class="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-rose-600"></span>
                {/if}
              {/if}
            </button>
          {/each}
        </div>
        <input
          id={'drums-tune-' + track.id}
          type="range"
          min="-12"
          max="12"
          step="1"
          value={store.drums.voices[track.id].tune}
          oninput={(e) => store.setVoice(track.id, { tune: Number(e.currentTarget.value) })}
          aria-label={`${track.label} tune`}
          title={`Tune ${store.drums.voices[track.id].tune} semitones`}
          class="w-16 shrink-0 cursor-pointer accent-amber-400"
        />
        <input
          id={'drums-decay-' + track.id}
          type="range"
          min="0.25"
          max="2"
          step="0.05"
          value={store.drums.voices[track.id].decay}
          oninput={(e) => store.setVoice(track.id, { decay: Number(e.currentTarget.value) })}
          aria-label={`${track.label} decay`}
          title={`Decay ${pct(store.drums.voices[track.id].decay)}`}
          class="w-16 shrink-0 cursor-pointer accent-amber-400"
        />
      </div>
    {/each}
  </div>
</div>
