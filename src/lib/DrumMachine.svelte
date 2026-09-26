<script lang="ts">
  import { onMount } from 'svelte'

  import type { SongStore } from './song.svelte.js'
  import type { DrumPattern, Scene, StateDetail, TransportDetail } from './types.js'

  import { createDrums, type Drums, STEPS, TRACKS } from './drums/engine.js'
  import { DEFAULT_PATTERN } from './song.svelte.js'
  import { transport } from './transport.js'

  const build = (step: (id: keyof DrumPattern, i: number) => boolean): DrumPattern => {
    const pattern = { ...DEFAULT_PATTERN }
    for (const { id } of TRACKS) pattern[id] = Array.from({ length: STEPS }, (_, i) => step(id, i))
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

  // Patterns, tempo and level live in the song store (and its undo history).
  let { store }: { store: SongStore } = $props()

  // Patterns A-D; arrangement sections pick one by index.
  const patterns = $derived(store.drums.patterns)
  const bpm = $derived(store.drums.bpm)
  const volume = $derived(store.drums.volume)
  let editing = $state(0) // tab shown in the grid
  const shown = $derived(patterns[editing] ?? empty())
  let playingPattern = $state(-1) // pattern currently sounding, -1 when stopped
  let clipboard: DrumPattern | null = $state(null)
  let songPlaying = false // while the arrangement plays, it picks the pattern
  let playing = $state(false)
  let current = $state(-1)
  let drums: Drums | null = null

  // Read on every step, so edits (and undo) are heard at once.
  const patternFn = (i: number) => () => store.drums.patterns[i] ?? {}
  const isEmpty = (p: DrumPattern | undefined) =>
    !p || Object.values(p).every((steps) => !steps.some(Boolean))

  onMount(() => {
    const engine = createDrums({
      onPattern: (i) => (playingPattern = i ?? -1),
      onStep: (s) => (current = s),
      onStop: () => {
        playing = false
        playingPattern = -1
      }
    })
    drums = engine
    // Global Play all / Stop all (song bar) and its state reports.
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

  <div id="drum-grid" class="space-y-1.5 overflow-x-auto">
    {#each TRACKS as track (track.id)}
      <div class="flex min-w-[36rem] items-center gap-2">
        <button
          type="button"
          onclick={() => drums?.trigger(track.id)}
          class="w-24 shrink-0 truncate rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
        >
          {track.label}
        </button>
        <div class="grid flex-1 grid-cols-16 gap-1">
          {#each shown[track.id] as on, i (i)}
            <button
              type="button"
              aria-label={`${track.label} step ${i + 1}`}
              aria-pressed={on}
              onclick={() => store.toggleStep(editing, track.id, i)}
              class={[
                'h-8 rounded transition-colors duration-75',
                on
                  ? 'bg-amber-400 shadow shadow-amber-400/30 hover:bg-amber-300'
                  : i % 4 === 0
                    ? 'bg-zinc-700 hover:bg-zinc-600'
                    : 'bg-zinc-800 hover:bg-zinc-700',
                current === i && editing === playingPattern && 'ring-2 ring-zinc-100/80'
              ]}
            ></button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
