<script lang="ts">
  import { Play, Search, Square, X } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import type { Synth } from './synth/engine.js'
  import type { Player } from './synth/looper.js'
  import type {
    LoadPresetReply,
    Loop,
    PresetSummary,
    StateDetail,
    SynthParams,
    TransportDetail
  } from './types.js'

  import { createSynth, DEFAULT_PARAMS } from './synth/engine.js'
  import { FACTORY_PRESETS } from './synth/factory_presets.js'
  import { createPlayer } from './synth/looper.js'
  import {
    filterPresets,
    PRESET_FACETS,
    type PresetFacet,
    type PresetItem,
    presetItems,
    presetLabels,
    presetPreviewLoop
  } from './synth/presets.js'
  import { transport } from './transport.js'

  let {
    loadPreset,
    onclose,
    onload,
    presets,
    previewLoop,
    selectedId,
    target
  }: {
    loadPreset: (id: string) => Promise<LoadPresetReply>
    onclose: () => void
    onload: (id: string, name: string, params: Partial<SynthParams>) => void
    presets: PresetSummary[]
    previewLoop: Loop | null
    selectedId: string
    target: string
  } = $props()

  let dialog: HTMLDialogElement | undefined
  let query = $state('')
  let status = $state('')
  const picked = new SvelteMap<PresetFacet, string[]>()
  const items = $derived(presetItems(presets))
  const results = $derived(filterPresets(items, query, Object.fromEntries(picked)))
  const filtering = $derived(query !== '' || [...picked.values()].some((labels) => labels.length))
  const facets = $derived(
    PRESET_FACETS.map((facet) => {
      const counts: Record<string, number> = {}
      for (const item of items)
        for (const label of presetLabels(item, facet.key)) {
          counts[label] = (counts[label] ?? 0) + 1
        }
      return { ...facet, options: Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)) }
    })
  )

  function togglePick(key: PresetFacet, label: string) {
    const labels = picked.get(key) ?? []
    picked.set(
      key,
      labels.includes(label) ? labels.filter((value) => value !== label) : [...labels, label]
    )
  }

  let previewing: null | string = $state(null)
  let pending: null | string = $state(null)
  let synth: null | Synth = null
  let player: null | Player = null
  let timer: ReturnType<typeof setInterval> | undefined
  let request = 0

  async function choose(item: PresetItem, preview: boolean) {
    const same = previewing === item.id || pending === item.id
    stopPreview()
    status = ''
    if (preview && same) return
    const current = request
    pending = item.id
    try {
      const factory =
        item.source === 'Factory' ? FACTORY_PRESETS[Number(item.id.slice(8))] : undefined
      const reply = factory ?? (await loadPreset(item.id))
      if (current !== request) return
      if ('error' in reply) {
        pending = null
        status = reply.error
        return
      }
      if (!preview) {
        pending = null
        onload(item.id, reply.name, reply.params)
        dialog?.close()
        return
      }
      // Base sound only: its own FX, no song sends, track mute, chord or arp settings.
      const created = createSynth({ ...DEFAULT_PARAMS, ...reply.params })
      synth = created
      await created.ready()
      if (current !== request) return
      pending = null
      let bpm = transport.bpm
      created.setTempo(bpm)
      const loop = presetPreviewLoop(
        reply.params,
        bpm,
        previewLoop,
        item.instrument.includes('Bass') ? 48 : 60
      )
      player = createPlayer(created, 'preset-preview:', loop, transport)
      player.start('now')
      timer = setInterval(() => {
        if (transport.bpm !== bpm) created.setTempo((bpm = transport.bpm))
        player?.tick()
        if (player && !player.playing) stopPreview()
      }, 25)
      previewing = item.id
      report()
    } catch (error) {
      if (current !== request) return
      stopPreview()
      status = error instanceof Error ? error.message : 'Could not load preset'
    }
  }

  function close() {
    stopPreview()
    onclose()
  }

  function report() {
    const detail: StateDetail = { playing: previewing !== null, source: 'preset-preview' }
    window.dispatchEvent(new CustomEvent('beatbox:state', { detail }))
  }

  function stopPreview() {
    // A saved preset response must not restart audio after Stop, close or another selection.
    request++
    pending = null
    clearInterval(timer)
    player?.stop()
    player = null
    synth?.close()
    synth = null
    previewing = null
    report()
  }

  onMount(() => {
    const onTransport = (event: CustomEvent<TransportDetail>) => {
      if (!event.detail.play) stopPreview()
    }
    window.addEventListener('beatbox:transport', onTransport)
    window.addEventListener('beatbox:report', report)
    return () => {
      window.removeEventListener('beatbox:transport', onTransport)
      window.removeEventListener('beatbox:report', report)
      stopPreview()
    }
  })

  const heading = 'text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500'
</script>

<dialog
  id="preset-browser"
  {@attach (node: HTMLDialogElement) => {
    dialog = node
    node.showModal()
    node.querySelector('input')?.focus()
  }}
  onclose={close}
  onclick={(event) => event.target === dialog && dialog.close()}
  aria-labelledby="preset-browser-title"
  aria-describedby="preset-browser-description"
  class="m-auto h-[min(40rem,90dvh)] w-[min(60rem,95vw)] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl shadow-black/60 [scrollbar-color:var(--color-zinc-700)_transparent] backdrop:bg-black/70 **:[scrollbar-width:thin]"
>
  <div class="flex h-full flex-col">
    <header class="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
      <div class="mr-auto">
        <h2
          id="preset-browser-title"
          class="text-xs font-bold uppercase tracking-[0.2em] text-amber-400"
        >
          Preset Browser
        </h2>
        <p id="preset-browser-description" class="mt-1 text-xs text-zinc-500">
          Preview {previewLoop ? 'the selected loop' : 'an example note'} with the base sound. Load into
          {target}.
        </p>
      </div>
      <button
        id="close-presets"
        type="button"
        aria-label="Close presets"
        onclick={() => dialog?.close()}
        class="flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        ><X class="size-4" /></button
      >
    </header>
    <div
      class="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] md:grid-cols-[15rem_1fr] md:grid-rows-1"
    >
      <aside
        class="space-y-5 overflow-y-auto border-b border-zinc-800 p-4 md:border-r md:border-b-0"
      >
        <label class="relative block">
          <span class="sr-only">Search presets</span>
          <Search
            class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-500"
          />
          <input
            id="preset-search"
            type="search"
            placeholder="Search presets"
            bind:value={query}
            class="w-full rounded-md border border-zinc-700 bg-zinc-900 py-1.5 pr-2 pl-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          />
        </label>
        {#each facets as facet (facet.key)}
          <fieldset class="space-y-1">
            <legend class={heading}>{facet.label}</legend>
            {#each facet.options as [label, count] (label)}
              <label
                class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                <input
                  type="checkbox"
                  checked={picked.get(facet.key)?.includes(label) ?? false}
                  onchange={() => togglePick(facet.key, label)}
                  class="accent-amber-400"
                />
                <span class="flex-1">{label}</span><span class="font-mono text-xs text-zinc-600"
                  >{count}</span
                >
              </label>
            {/each}
          </fieldset>
        {/each}
      </aside>
      <div class="flex min-h-0 flex-col">
        <div class="flex items-center gap-2 px-4 pt-3 pb-2 text-xs text-zinc-500">
          <span id="preset-count" class="mr-auto"
            >{results.length} result{results.length === 1 ? '' : 's'}</span
          >
          {#if filtering}
            <button
              id="preset-clear"
              type="button"
              onclick={() => {
                query = ''
                picked.clear()
              }}
              class="rounded px-1.5 py-0.5 text-amber-400 hover:bg-zinc-900">Clear filters</button
            >
          {/if}
        </div>
        <p id="preset-browser-status" role="status" class="px-4 text-xs text-zinc-400">{status}</p>
        <ul id="preset-results" class="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
          {#each results as item (item.id)}
            {@const playing = previewing === item.id}
            <li
              data-preset-id={item.id}
              class="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1.5"
            >
              <button
                type="button"
                aria-pressed={playing}
                aria-label={`${playing ? 'Stop previewing' : 'Preview'} ${item.name}`}
                title="Preview base preset"
                onclick={() => choose(item, true)}
                class="flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-amber-400 active:scale-95 aria-pressed:bg-amber-400 aria-pressed:text-zinc-900"
              >
                {#if playing}<Square class="size-4 fill-current" />{:else}<Play
                    class="size-4 fill-current"
                  />{/if}
              </button>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-zinc-100">{item.name}</p>
                <p class="truncate text-xs text-zinc-500">
                  {item.source}{item.instrument.length
                    ? ` · ${item.instrument.join(', ')}`
                    : ''}{selectedId === item.id ? ' · Loaded' : ''}{pending === item.id
                    ? ' · Loading…'
                    : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Load ${item.name}`}
                onclick={() => choose(item, false)}
                class="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-amber-400/60 hover:bg-zinc-800 hover:text-amber-400"
                >Load</button
              >
            </li>
          {:else}
            <li class="py-8 text-center text-sm text-zinc-500">Nothing matches these filters.</li>
          {/each}
        </ul>
      </div>
    </div>
  </div>
</dialog>
