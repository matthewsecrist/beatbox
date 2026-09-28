<script lang="ts">
  import { Play, Plus, Search, Square, X } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import type { Drums } from './drums/engine.js'
  import type { SongStore } from './song.svelte.js'
  import type { Synth } from './synth/engine.js'
  import type { StateDetail, TransportDetail } from './types.js'

  import { createDrums } from './drums/engine.js'
  import { effects } from './effects.js'
  import {
    barsLabel,
    beatPattern,
    type FacetKey,
    facetOptions,
    FACETS,
    filterLibrary,
    LIBRARY,
    type LibraryItem,
    libraryLoop
  } from './library.js'
  import { PAD_COUNT } from './song.svelte.js'
  import { createSynth, DEFAULT_PARAMS } from './synth/engine.js'
  import { createPlayer } from './synth/looper.js'
  import { transport } from './transport.js'

  // The Loop Browser: a modal listing premade loops and beats, with search and
  // filters in the sidebar, opened by the song bar's Loops button (`open`).
  // Loops go onto a loop pad, beats into a drum pattern; both through the song
  // store, so adding one is a single undo step.
  let { open = $bindable(false), store }: { open?: boolean; store: SongStore } = $props()

  let dialog: HTMLDialogElement | undefined = $state()
  $effect(() => {
    if (open && !dialog?.open) dialog?.showModal()
  })

  // Esc, the close button or a click outside: the browser closes, and so does the preview.
  function onClose() {
    open = false
    stopPreview()
  }

  let query = $state('')
  const picked = new SvelteMap<FacetKey, string[]>()
  const results = $derived(filterLibrary(LIBRARY, query, Object.fromEntries(picked)))
  // Every label in each facet, in first-seen order, with how many items have it.
  const filtering = $derived(query !== '' || [...picked.values()].some((v) => v.length))

  function clearFilters() {
    query = ''
    picked.clear()
  }

  function togglePick(key: FacetKey, label: string) {
    const current = picked.get(key) ?? []
    picked.set(
      key,
      current.includes(label) ? current.filter((l) => l !== label) : [...current, label]
    )
  }

  const LETTERS = ['A', 'B', 'C', 'D']
  // The pad picked by hand; otherwise loops go to the first empty pad (or pad 1).
  let chosenPad: null | number = $state(null)
  const pad = $derived(
    chosenPad ??
      Math.max(
        0,
        store.loops.findIndex((l) => !l)
      )
  )
  let pattern = $state(0)
  let status = $state('')

  function add(item: LibraryItem) {
    if (item.type === 'Loop') {
      store.setLoop(libraryLoop(item, pad, store.drums.bpm))
      status = `${item.name} → pad ${pad + 1}`
      chosenPad = null
    } else {
      store.setPattern(pattern, beatPattern(item))
      status = `${item.name} → pattern ${LETTERS[pattern] ?? ''}`
    }
  }

  // Preview: plays an item on its own synth or drum engine, on the shared transport,
  // so it joins in time with anything already playing. Beats use the song's kit,
  // swing and level. One at a time; reported as `beatbox:state` so Stop all stops it.
  let previewing: null | string = $state(null) // name of the item playing
  let stopCurrent: () => void = () => undefined
  let previewSynth: null | Synth = null
  let previewDrums: Drums | null = null

  $effect(() => {
    const detail: StateDetail = { playing: previewing !== null, source: 'preview' }
    window.dispatchEvent(new CustomEvent('beatbox:state', { detail }))
  })

  function startPreview(item: LibraryItem): () => void {
    if (item.type === 'Beat') {
      // Previews play through the song's effects, so they sound as they will in it.
      const drums = (previewDrums ??= createDrums({
        id: 'preview-drums',
        onStep: () => undefined,
        output: () => effects.channel('drums')
      }))
      drums.setKit(store.drums.kit, store.drums.voices)
      drums.setSwing(store.drums.swing)
      drums.setVolume(store.drums.volume)
      const steps = beatPattern(item)
      drums.start(() => steps)
      return () => drums.stop()
    }
    previewSynth ??= createSynth(
      { volume: store.synth.volume ?? DEFAULT_PARAMS.volume },
      undefined,
      () => effects.channel('synth')
    )
    const player = createPlayer(
      previewSynth,
      'preview:',
      libraryLoop(item, 0, transport.bpm),
      transport
    )
    player.start()
    const timer = setInterval(() => player.tick(), 25)
    return () => {
      clearInterval(timer)
      player.stop()
    }
  }

  function stopPreview() {
    stopCurrent()
    stopCurrent = () => undefined
    previewing = null
  }

  function togglePreview(item: LibraryItem) {
    const same = previewing === item.name
    stopPreview()
    if (same) return
    stopCurrent = startPreview(item)
    previewing = item.name
  }

  onMount(() => {
    const onTransport = (e: CustomEvent<TransportDetail>) => {
      if (!e.detail.play) stopPreview()
    }
    window.addEventListener('beatbox:transport', onTransport)
    return () => {
      window.removeEventListener('beatbox:transport', onTransport)
      stopPreview()
      previewDrums?.close()
      previewSynth?.close()
    }
  })

  const select =
    'w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 transition hover:border-amber-400/60 focus:border-amber-400 focus:outline-none'
  const heading = 'text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500'
</script>

<dialog
  id="loop-browser"
  bind:this={dialog}
  onclose={onClose}
  onclick={(e) => e.target === dialog && dialog.close()}
  aria-labelledby="loop-browser-title"
  class="m-auto h-[min(40rem,90vh)] w-[min(60rem,95vw)] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl shadow-black/60 [scrollbar-color:var(--color-zinc-700)_transparent] backdrop:bg-black/70 **:[scrollbar-width:thin]"
>
  <div class="flex h-full flex-col">
    <header class="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
      <h2
        id="loop-browser-title"
        class="mr-auto text-xs font-bold uppercase tracking-[0.2em] text-amber-400"
      >
        Loop Browser
      </h2>
      <span id="library-status" role="status" class="text-xs text-zinc-400">{status}</span>
      <button
        id="close-library"
        type="button"
        aria-label="Close"
        onclick={() => dialog?.close()}
        class="flex size-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <X class="size-4" />
      </button>
    </header>

    <div class="grid min-h-0 flex-1 md:grid-cols-[15rem_1fr]">
      <aside
        class="space-y-5 overflow-y-auto border-b border-zinc-800 p-4 md:border-r md:border-b-0"
      >
        <label class="relative block">
          <span class="sr-only">Search</span>
          <Search
            class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-500"
          />
          <input
            id="library-search"
            type="search"
            placeholder="Search"
            bind:value={query}
            class="w-full rounded-md border border-zinc-700 bg-zinc-900 py-1.5 pr-2 pl-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          />
        </label>

        {#each FACETS as facet (facet.key)}
          <fieldset class="space-y-1">
            <legend class={heading}>{facet.label}</legend>
            {#each facetOptions(facet.value) as [label, count] (label)}
              <label
                class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                <input
                  type="checkbox"
                  checked={picked.get(facet.key)?.includes(label) ?? false}
                  onchange={() => togglePick(facet.key, label)}
                  class="accent-amber-400"
                />
                <span class="flex-1">{label}</span>
                <span class="font-mono text-xs text-zinc-600">{count}</span>
              </label>
            {/each}
          </fieldset>
        {/each}

        <fieldset class="space-y-2">
          <legend class={heading}>Add to</legend>
          <label class="block space-y-1">
            <span class="text-xs text-zinc-400">Loops</span>
            <select
              id="library-pad"
              value={pad}
              onchange={(e) => (chosenPad = Number(e.currentTarget.value))}
              class={select}
            >
              {#each { length: PAD_COUNT }, i (i)}
                <option value={i}>Pad {i + 1}{store.loops[i] ? ' (replace)' : ''}</option>
              {/each}
            </select>
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-zinc-400">Beats</span>
            <select id="library-pattern" bind:value={pattern} class={select}>
              {#each LETTERS as letter, i (letter)}
                <option value={i}>Pattern {letter}</option>
              {/each}
            </select>
          </label>
        </fieldset>
      </aside>

      <div class="flex min-h-0 flex-col">
        <div class="flex items-center gap-2 px-4 pt-3 pb-2 text-xs text-zinc-500">
          <span id="library-count" class="mr-auto">
            {results.length} result{results.length === 1 ? '' : 's'}
          </span>
          {#if filtering}
            <button
              id="library-clear"
              type="button"
              onclick={clearFilters}
              class="rounded px-1.5 py-0.5 text-amber-400 hover:bg-zinc-900"
            >
              Clear filters
            </button>
          {/if}
        </div>
        <ul id="library-results" class="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
          {#each results as item (item.name)}
            {@const playing = previewing === item.name}
            {@const n = LIBRARY.indexOf(item)}
            <li
              class="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1.5"
            >
              <button
                id={'library-preview-' + n}
                type="button"
                aria-pressed={playing}
                aria-label={`Preview ${item.name}`}
                title="Preview"
                onclick={() => togglePreview(item)}
                class="flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-amber-400 active:scale-95 aria-pressed:bg-amber-400 aria-pressed:text-zinc-900"
              >
                {#if playing}
                  <Square class="size-4 fill-current" />
                {:else}
                  <Play class="size-4 fill-current" />
                {/if}
              </button>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-zinc-100">{item.name}</p>
                <p class="truncate text-xs text-zinc-500">
                  {item.genre} · {item.instrument}{item.type === 'Loop' ? ` (${item.sound})` : ''} ·
                  {barsLabel(item.bars)}
                </p>
              </div>
              <span
                class={[
                  'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  item.type === 'Loop'
                    ? 'bg-sky-500/15 text-sky-300'
                    : 'bg-emerald-500/15 text-emerald-300'
                ]}>{item.type}</span
              >
              <button
                id={'library-add-' + n}
                type="button"
                aria-label={`Add ${item.name} to ${item.type === 'Loop' ? `pad ${pad + 1}` : `pattern ${LETTERS[pattern] ?? ''}`}`}
                title={item.type === 'Loop'
                  ? `Add to pad ${pad + 1}`
                  : `Add to pattern ${LETTERS[pattern] ?? ''}`}
                onclick={() => add(item)}
                class="flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 transition hover:border-amber-400/60 hover:bg-zinc-800 hover:text-amber-400 active:scale-95"
              >
                <Plus class="size-4" />
              </button>
            </li>
          {:else}
            <li class="py-8 text-center text-sm text-zinc-500">Nothing matches these filters.</li>
          {/each}
        </ul>
      </div>
    </div>
  </div>
</dialog>
