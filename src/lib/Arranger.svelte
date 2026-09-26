<script>
  import { onMount, untrack } from "svelte"
  import { createArranger } from "./arranger.js"
  import { transport } from "./transport.js"

  // `sections` comes from the open song and is read once at mount; the page
  // remounts this component when a different song is opened. Edits are reported via `onchange`.
  let { sections: songSections = [], onchange } = $props()

  const PADS = 8
  const MAX_BARS = 64
  const DRUM_PATTERNS = ["A", "B", "C", "D"]
  let sections = $state(
    untrack(() => songSections.map((s) => ({ name: s.name ?? "", bars: s.bars, drums: s.drums, pattern: s.pattern ?? 0, pads: [...s.pads] }))),
  )
  let position = $state(null) // { index, bar } while the song plays
  let timer

  const totalBars = $derived(sections.reduce((n, s) => n + s.bars, 0))

  const say = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }))

  const arranger = createArranger({
    transport,
    onScene: (scene) => say("beatbox:scene", scene),
    onEnd: () => finished(),
  })

  function finished() {
    clearInterval(timer)
    position = null
  }

  function play() {
    say("beatbox:transport", { play: false }) // start from a clean slate
    position = arranger.start($state.snapshot(sections))
    timer = setInterval(() => (position = arranger.tick() ?? position), 25)
  }

  function stop() {
    arranger.stop()
    finished()
  }

  // Stop song and the global Stop all both send this: it stops the instruments and,
  // via this handler, the song.
  const onTransport = (e) => !e.detail.play && position && stop()
  const report = (on) => say("beatbox:state", { source: "song", playing: on })
  const onReport = () => report(!!position)
  $effect(() => report(!!position))

  onMount(() => {
    window.addEventListener("beatbox:transport", onTransport)
    window.addEventListener("beatbox:report", onReport)
    return () => {
      window.removeEventListener("beatbox:transport", onTransport)
      window.removeEventListener("beatbox:report", onReport)
      stop()
      report(false)
    }
  })

  // Report to the song's working copy. Not debounced, so it's up to date before
  // any later Save click (see Synth.svelte). Mount run skipped.
  let firstRun = true
  $effect(() => {
    const snapshot = $state.snapshot(sections)
    if (firstRun) return void (firstRun = false)
    onchange?.(snapshot)
  })

  function addSection() {
    const last = sections.at(-1)
    sections.push(
      last
        ? { name: "", bars: last.bars, drums: last.drums, pattern: last.pattern, pads: [...last.pads] }
        : { name: "", bars: 4, drums: true, pattern: 0, pads: [] },
    )
  }

  function move(i, delta) {
    const j = i + delta
    if (j < 0 || j >= sections.length) return
    ;[sections[i], sections[j]] = [sections[j], sections[i]]
  }

  function togglePad(section, slot) {
    section.pads = section.pads.includes(slot) ? section.pads.filter((p) => p !== slot) : [...section.pads, slot].sort()
  }

  const setBars = (section, n) => (section.bars = Math.min(MAX_BARS, Math.max(1, n)))

  const chip = (on) => [
    "h-7 min-w-7 rounded-md px-1.5 text-xs font-semibold transition active:scale-95",
    on ? "bg-amber-400 text-zinc-900 shadow shadow-amber-400/20 hover:bg-amber-300" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200",
  ]
  const iconBtn =
    "flex size-7 items-center justify-center rounded-md text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
</script>

<section id="arrangement" class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6">
  <div class="flex flex-wrap items-center gap-3">
    <h2 class="mr-auto text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
      Arrangement
      <span class="ml-2 font-mono normal-case tracking-normal text-zinc-500">{totalBars} bars</span>
    </h2>
    <button
      id="song-play"
      type="button"
      disabled={sections.length === 0}
      aria-pressed={!!position}
      onclick={() => (position ? say("beatbox:transport", { play: false }) : play())}
      class={[
        "rounded-md px-4 py-1.5 text-sm font-semibold transition active:scale-95 disabled:pointer-events-none disabled:opacity-40",
        position ? "bg-zinc-100 text-zinc-900 hover:bg-white" : "bg-emerald-500 text-zinc-950 shadow shadow-emerald-500/20 hover:bg-emerald-400",
      ]}
    >
      {position ? "Stop song" : "Play song"}
    </button>
    <button
      id="add-section"
      type="button"
      onclick={addSection}
      disabled={sections.length >= 64}
      class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95 disabled:opacity-40"
    >
      + Section
    </button>
  </div>

  <ol id="sections" class="space-y-2">
    {#each sections as section, i (section)}
      {@const current = position?.index === i}
      <li
        id={"section-" + i}
        class={[
          "relative flex flex-wrap items-center gap-2 overflow-hidden rounded-xl border p-2 transition",
          current ? "border-amber-400/70 bg-amber-400/10" : "border-zinc-800 bg-zinc-900/80",
        ]}
      >
        <span class={["w-6 text-center font-mono text-xs", current ? "text-amber-300" : "text-zinc-500"]}>{i + 1}</span>
        <input
          type="text"
          maxlength="30"
          placeholder={"Section " + (i + 1)}
          bind:value={section.name}
          aria-label={"Section " + (i + 1) + " name"}
          class="w-32 min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 transition hover:border-zinc-700 focus:border-amber-400 focus:outline-none"
        />

        <div class="flex items-center rounded-md bg-zinc-950/60" role="group" aria-label="Length">
          <button type="button" class={iconBtn} aria-label="Fewer bars" disabled={section.bars <= 1} onclick={() => setBars(section, section.bars - 1)}>−</button>
          <span class="w-16 text-center font-mono text-xs tabular-nums text-zinc-300">
            {current ? `${position.bar}/${section.bars}` : section.bars} {section.bars === 1 && !current ? "bar" : "bars"}
          </span>
          <button type="button" class={iconBtn} aria-label="More bars" disabled={section.bars >= MAX_BARS} onclick={() => setBars(section, section.bars + 1)}>+</button>
        </div>

        <div class="flex flex-wrap items-center gap-1" role="group" aria-label="Playing in this section">
          <div class="mr-1 flex items-center gap-0.5 rounded-md bg-zinc-950/60 p-0.5" role="group" aria-label="Drum pattern">
            <span class="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Drums</span>
            <button type="button" class={chip(!section.drums)} aria-pressed={!section.drums} aria-label="No drums" onclick={() => (section.drums = false)}>–</button>
            {#each DRUM_PATTERNS as letter, p}
              {@const on = section.drums && section.pattern === p}
              <button
                type="button"
                class={chip(on)}
                aria-pressed={on}
                aria-label={"Drum pattern " + letter}
                onclick={() => {
                  section.drums = true
                  section.pattern = p
                }}>{letter}</button
              >
            {/each}
          </div>
          {#each { length: PADS } as _, slot}
            <button
              type="button"
              class={chip(section.pads.includes(slot))}
              aria-pressed={section.pads.includes(slot)}
              aria-label={"Pad " + (slot + 1)}
              onclick={() => togglePad(section, slot)}
            >
              {slot + 1}
            </button>
          {/each}
        </div>

        <div class="ml-auto flex items-center">
          <button type="button" class={iconBtn} aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
          <button type="button" class={iconBtn} aria-label="Move down" disabled={i === sections.length - 1} onclick={() => move(i, 1)}>↓</button>
          <button
            type="button"
            class={iconBtn}
            aria-label="Duplicate"
            disabled={sections.length >= 64}
            onclick={() => sections.splice(i + 1, 0, { ...$state.snapshot(section), pads: [...section.pads] })}>⧉</button
          >
          <button type="button" class={[iconBtn, "hover:text-red-400"]} aria-label="Delete section" onclick={() => sections.splice(i, 1)}>✕</button>
        </div>

        {#if current}
          <span
            class="absolute inset-x-0 bottom-0 h-0.5 bg-amber-400 transition-[width] duration-100"
            style="width: {((position.bar - 1) / section.bars) * 100}%"
          ></span>
        {/if}
      </li>
    {:else}
      <li class="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
        Add sections, pick which pads and drums play in each, then <span class="text-zinc-300">Play song</span> runs them in order.
      </li>
    {/each}
  </ol>
</section>
