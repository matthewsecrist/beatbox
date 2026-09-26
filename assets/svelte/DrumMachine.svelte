<script>
  import { onMount, untrack } from "svelte"
  import { STEPS, TRACKS, createDrums } from "./drums/engine.js"

  const row = (on) => Array.from({ length: STEPS }, (_, i) => on.includes(i))
  const DEFAULT_PATTERN = {
    kick: row([0, 4, 8, 12]),
    snare: row([4, 12]),
    clap: row([]),
    chat: row([0, 2, 4, 6, 8, 10, 12, 14]),
    ohat: row([]),
    tom: row([]),
  }
  const clone = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, [...v]]))
  // Per-track hit probability; kick always lands on the downbeat so it still grooves.
  const DENSITY = { kick: 0.3, snare: 0.2, clap: 0.1, chat: 0.55, ohat: 0.1, tom: 0.1 }
  const randomPattern = () =>
    Object.fromEntries(
      TRACKS.map(({ id }) => [id, Array.from({ length: STEPS }, (_, i) => (id === "kick" && i === 0) || Math.random() < DENSITY[id])]),
    )

  // `drums` comes from the open song and is read once at mount; the page remounts
  // this component when a different song is opened.
  let { drums: songDrums = null, live } = $props()
  const initial = untrack(() => songDrums)
  const fromSong = (p) => Object.fromEntries(TRACKS.map(({ id }) => [id, Array.from({ length: STEPS }, (_, i) => !!p?.[id]?.[i])]))

  let pattern = $state(initial ? fromSong(initial.pattern) : clone(DEFAULT_PATTERN))
  let bpm = $state(initial?.bpm ?? 110)
  let volume = $state(initial?.volume ?? 0.8)
  let playing = $state(false)
  let current = $state(-1)
  let drums = null

  onMount(() => {
    drums = createDrums({ onStep: (s) => (current = s) })
    return () => drums.close()
  })

  // Push to the song's working copy. Not debounced, so the push is on the socket
  // before any later Save click (see Synth.svelte). The mount run is skipped so an
  // untouched song isn't marked dirty.
  let firstRun = true
  $effect(() => {
    const snapshot = { bpm, volume, pattern: $state.snapshot(pattern) }
    if (firstRun) return void (firstRun = false)
    live.pushEvent("update_drums", { drums: snapshot })
  })

  $effect(() => drums?.setBpm(bpm))
  $effect(() => drums?.setVolume(volume))

  function toggle() {
    if (playing) drums.stop()
    else drums.start(() => pattern)
    playing = !playing
  }

  const btn =
    "rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95"
</script>

<div class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6">
  <div class="flex flex-wrap items-center gap-3">
    <h2 class="mr-auto text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Drums</h2>
    <button
      id="drums-play"
      type="button"
      onclick={toggle}
      aria-pressed={playing}
      class={[
        "w-20 rounded-md px-4 py-1.5 text-sm font-semibold transition active:scale-95",
        playing
          ? "bg-zinc-100 text-zinc-900 hover:bg-white"
          : "bg-amber-400 text-zinc-900 shadow shadow-amber-400/20 hover:bg-amber-300",
      ]}
    >
      {playing ? "Stop" : "Play"}
    </button>
    <label class="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400" for="drums-bpm">
      BPM
      <input
        id="drums-bpm"
        type="range"
        min="60"
        max="200"
        step="1"
        bind:value={bpm}
        class="w-28 cursor-pointer accent-amber-400"
      />
      <span class="w-8 font-mono text-amber-300 tabular-nums">{bpm}</span>
    </label>
    <label class="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400" for="drums-volume">
      Level
      <input
        id="drums-volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={volume}
        class="w-24 cursor-pointer accent-amber-400"
      />
    </label>
    <button id="drums-clear" type="button" class={btn} onclick={() => (pattern = Object.fromEntries(TRACKS.map((t) => [t.id, row([])])))}>
      Clear
    </button>
    <button id="drums-randomize" type="button" class={btn} onclick={() => (pattern = randomPattern())}>
      Randomize
    </button>
    <button id="drums-reset" type="button" class={btn} onclick={() => (pattern = clone(DEFAULT_PATTERN))}>
      Reset
    </button>
  </div>

  <div id="drum-grid" class="space-y-1.5 overflow-x-auto">
    {#each TRACKS as track (track.id)}
      <div class="flex min-w-[36rem] items-center gap-2">
        <button
          type="button"
          onclick={() => drums.trigger(track.id)}
          class="w-24 shrink-0 truncate rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
        >
          {track.label}
        </button>
        <div class="grid flex-1 grid-cols-16 gap-1">
          {#each pattern[track.id] as on, i}
            <button
              type="button"
              aria-label={`${track.label} step ${i + 1}`}
              aria-pressed={on}
              onclick={() => (pattern[track.id][i] = !on)}
              class={[
                "h-8 rounded transition-colors duration-75",
                on
                  ? "bg-amber-400 shadow shadow-amber-400/30 hover:bg-amber-300"
                  : i % 4 === 0
                    ? "bg-zinc-700 hover:bg-zinc-600"
                    : "bg-zinc-800 hover:bg-zinc-700",
                current === i && "ring-2 ring-zinc-100/80",
              ]}
            ></button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
