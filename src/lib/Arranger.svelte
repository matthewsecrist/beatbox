<script lang="ts">
  import { Play, Square } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'

  import type { ArrangementSection, SongStore } from './song.svelte.js'
  import type { Scene, StateDetail, TransportDetail } from './types.js'

  import { createArranger, type Position } from './arranger.js'
  import { isAudible } from './drums/engine.js'
  import { effects, type Instrument } from './effects.js'
  import { help } from './help.js'
  import Info from './Info.svelte'
  import { DEFAULT_PARAMS } from './synth/engine.js'
  import { transport } from './transport.js'

  // The track list and the arrangement: a row per track (the synth's pads, the
  // drums), a column per section. Picking a track (`track`)
  // opens it in the editor below. Sections live in the song store (and its undo
  // history); track mute and solo are for listening only, so they stay here.
  let { store, track = $bindable() }: { store: SongStore; track: Instrument } = $props()

  // Pad rows: pads with a loop, plus any a section still plays after its loop was cleared.
  const padSlots = $derived(
    store.loops.flatMap((loop, slot) =>
      loop || sections.some((s) => s.pads.includes(slot)) ? [slot] : []
    )
  )
  const MAX_BARS = 64
  const DRUM_PATTERNS = ['A', 'B', 'C', 'D']
  const INSTRUMENTS: Instrument[] = ['synth', 'drums']
  const muted = new SvelteSet<Instrument>()
  const soloed = new SvelteSet<Instrument>()
  const flip = (set: SvelteSet<Instrument>, id: Instrument) => {
    if (!set.delete(id)) set.add(id)
  }
  $effect(() => {
    for (const id of INSTRUMENTS) effects.mute(id, !isAudible(id, muted, soloed))
  })
  const synthLevel = $derived(store.synth.volume ?? DEFAULT_PARAMS.volume)
  const sections = $derived(store.arrangement)
  let position: null | Position = $state(null) // while the song (or a section) plays
  // The section playing on its own (its ▶), by id; null while the whole song plays.
  let solo: null | string = $state(null)
  let timer: ReturnType<typeof setInterval> | undefined
  // Id of the section playing now, to highlight it.
  const playingId = $derived.by(() =>
    position ? (solo ?? sections[position.index]?.id ?? null) : null
  )

  const totalBars = $derived(sections.reduce((n, s) => n + s.bars, 0))

  function say(name: 'beatbox:scene', detail: Scene): void
  function say(name: 'beatbox:state', detail: StateDetail): void
  function say(name: 'beatbox:transport', detail: TransportDetail): void
  function say(name: string, detail: unknown): void {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  }

  const arranger = createArranger({
    onEnd: () => finished(),
    onScene: (scene) => say('beatbox:scene', scene),
    transport
  })

  function finished() {
    clearInterval(timer)
    position = null
    solo = null
  }

  // Plays the whole arrangement, or just the section with id `only` (through to
  // its end, then everything stops).
  function play(only: null | string = null) {
    say('beatbox:transport', { play: false }) // start from a clean slate
    const list = only ? sections.filter((s) => s.id === only) : sections
    if (!list.length) return
    solo = only
    position = arranger.start(list)
    timer = setInterval(() => (position = arranger.tick() ?? position), 25)
  }

  function stop() {
    arranger.stop()
    finished()
  }

  // Stop song and the global Stop both send this: it stops the instruments and,
  // via this handler, the song.
  const onTransport = (e: CustomEvent<TransportDetail>) => {
    if (!e.detail.play && position) stop()
  }
  // Play song in the song bar.
  const onSong = (e: CustomEvent<TransportDetail>) => {
    if (e.detail.play && !position && sections.length) play()
  }
  const report = (on: boolean) => say('beatbox:state', { playing: on, source: 'song' })
  const onReport = () => report(!!position)
  $effect(() => report(!!position))

  onMount(() => {
    window.addEventListener('beatbox:transport', onTransport)
    window.addEventListener('beatbox:song', onSong)
    window.addEventListener('beatbox:report', onReport)
    return () => {
      window.removeEventListener('beatbox:transport', onTransport)
      window.removeEventListener('beatbox:song', onSong)
      window.removeEventListener('beatbox:report', onReport)
      stop()
      report(false)
    }
  })

  function togglePad(index: number, section: ArrangementSection, slot: number) {
    store.updateSection(index, {
      pads: section.pads.includes(slot)
        ? section.pads.filter((p) => p !== slot)
        : [...section.pads, slot].sort((a, b) => a - b)
    })
  }

  const setBars = (index: number, n: number) =>
    store.updateSection(index, { bars: Math.min(MAX_BARS, Math.max(1, n)) })

  // Track names stay in view while the sections scroll sideways.
  const cell = 'sticky left-0 z-10 bg-zinc-950 pr-2'
  const iconBtn =
    'flex size-7 items-center justify-center rounded-md text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 disabled:pointer-events-none disabled:opacity-30'
</script>

<!-- A track's name (picks it for the editor), with its mute, solo and level. -->
{#snippet trackHead(
  id: Instrument,
  label: string,
  level: number,
  onlevel: (v: number) => void,
  about = ''
)}
  {@const heard = isAudible(id, muted, soloed)}
  <div class={[cell, 'flex items-center gap-1.5 border-t border-zinc-800 py-1.5']}>
    <button
      id={'track-' + id}
      type="button"
      aria-pressed={track === id}
      onclick={() => (track = id)}
      class={[
        'w-20 shrink-0 truncate rounded-md px-2 py-1 text-left text-xs font-bold uppercase tracking-wider transition active:scale-95',
        track === id
          ? 'bg-amber-400 text-zinc-900'
          : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
      ]}>{label}</button
    >
    <button
      id={'track-mute-' + id}
      type="button"
      aria-label={`Mute ${label}`}
      aria-pressed={muted.has(id)}
      title={soloed.size && muted.has(id) ? 'Muted (a solo overrides it)' : 'Mute'}
      onclick={() => flip(muted, id)}
      class={[
        'size-6 shrink-0 rounded-md border text-[10px] font-bold transition active:scale-95',
        muted.has(id)
          ? 'border-rose-500 bg-rose-500/20 text-rose-300'
          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
      ]}>M</button
    >
    <button
      id={'track-solo-' + id}
      type="button"
      aria-label={`Solo ${label}`}
      aria-pressed={soloed.has(id)}
      title="Solo"
      onclick={() => flip(soloed, id)}
      class={[
        'size-6 shrink-0 rounded-md border text-[10px] font-bold transition active:scale-95',
        soloed.has(id)
          ? 'border-amber-400 bg-amber-400 text-zinc-900'
          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
      ]}>S</button
    >
    <input
      id={'track-level-' + id}
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={level}
      disabled={store.readOnly}
      oninput={(e) => onlevel(Number(e.currentTarget.value))}
      aria-label={`${label} level`}
      title={`Level ${Math.round(level * 100)}%`}
      class={[
        'min-w-0 flex-1 cursor-pointer accent-amber-400 transition-opacity disabled:cursor-default',
        !heard && 'opacity-40'
      ]}
    />
    {#if about}<Info label={`${label} level`} text={about} />{/if}
  </div>
{/snippet}

<section
  id="arrangement"
  aria-label="Tracks and arrangement"
  class="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
>
  <div class="overflow-x-auto">
    <div
      id="sections"
      class="grid w-max min-w-full items-stretch gap-x-2"
      style:grid-template-columns={`min(18rem, 60vw) ${sections.map(() => '10rem ').join('')}1fr`}
    >
      <!-- Header row: the arrangement's length, then one card per section. -->
      <div class={[cell, 'flex items-end gap-2 pb-2']}>
        <h2 class="mr-auto text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
          Tracks
          <span class="ml-1 font-mono normal-case tracking-normal text-zinc-500"
            >{totalBars} bars</span
          >
        </h2>
        {#if !store.readOnly}
          <button
            id="add-section"
            type="button"
            onclick={() => store.addSection()}
            disabled={sections.length >= 64}
            class="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95 disabled:opacity-40"
          >
            + Section
          </button>
        {/if}
      </div>
      {#each sections as section, i (section.id)}
        {@const current = playingId === section.id}
        {@const alone = current && solo === section.id}
        <div
          id={'section-' + i}
          role="group"
          aria-label={'Section ' + (i + 1)}
          class={[
            'relative mb-2 space-y-1 overflow-hidden rounded-lg border p-1.5 transition',
            current ? 'border-amber-400/70 bg-amber-400/10' : 'border-zinc-800 bg-zinc-900/80'
          ]}
        >
          <div class="flex items-center gap-1">
            <button
              id={'section-play-' + i}
              type="button"
              aria-pressed={alone}
              aria-label={alone ? `Stop section ${i + 1}` : `Play section ${i + 1} on its own`}
              title={alone ? 'Stop' : 'Play just this section'}
              onclick={() => (alone ? say('beatbox:transport', { play: false }) : play(section.id))}
              class={[
                iconBtn,
                'shrink-0 hover:text-emerald-400',
                alone && 'bg-zinc-100 text-zinc-900 hover:bg-white hover:text-zinc-900'
              ]}
            >
              {#if alone}<Square class="size-3.5 fill-current" />{:else}<Play
                  class="size-3.5 fill-current"
                />{/if}
            </button>
            <input
              type="text"
              maxlength="30"
              placeholder={'Section ' + (i + 1)}
              value={section.name}
              readonly={store.readOnly}
              disabled={store.readOnly}
              oninput={(e) => store.updateSection(i, { name: e.currentTarget.value })}
              aria-label={'Section ' + (i + 1) + ' name'}
              class="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 transition hover:border-zinc-700 focus:border-amber-400 focus:outline-none disabled:hover:border-transparent"
            />
          </div>
          <div
            class="flex items-center justify-between rounded-md bg-zinc-950/60"
            role="group"
            aria-label="Length"
          >
            <button
              type="button"
              class={iconBtn}
              aria-label="Fewer bars"
              disabled={store.readOnly || section.bars <= 1}
              onclick={() => setBars(i, section.bars - 1)}>−</button
            >
            <span class="font-mono text-xs tabular-nums text-zinc-300">
              {current ? `${position?.bar ?? 1}/${section.bars}` : section.bars}
              {section.bars === 1 && !current ? 'bar' : 'bars'}
            </span>
            <button
              type="button"
              class={iconBtn}
              aria-label="More bars"
              disabled={store.readOnly || section.bars >= MAX_BARS}
              onclick={() => setBars(i, section.bars + 1)}>+</button
            >
          </div>
          {#if !store.readOnly}
            <div class="flex items-center justify-between">
              <button
                type="button"
                class={iconBtn}
                aria-label="Move earlier"
                disabled={i === 0}
                onclick={() => store.moveSection(i, -1)}>←</button
              >
              <button
                type="button"
                class={iconBtn}
                aria-label="Move later"
                disabled={i === sections.length - 1}
                onclick={() => store.moveSection(i, 1)}>→</button
              >
              <button
                type="button"
                class={iconBtn}
                aria-label="Duplicate"
                disabled={sections.length >= 64}
                onclick={() => store.duplicateSection(i)}>⧉</button
              >
              <button
                type="button"
                class={[iconBtn, 'hover:text-red-400']}
                aria-label="Delete section"
                onclick={() => store.removeSection(i)}>✕</button
              >
            </div>
          {/if}
          {#if current}
            <span
              class="absolute inset-x-0 bottom-0 h-0.5 bg-amber-400 transition-[width] duration-100"
              style="width: {(((position?.bar ?? 1) - 1) / section.bars) * 100}%"
            ></span>
          {/if}
        </div>
      {/each}
      <div></div>

      <!-- Synth: its loop pads, one row each. -->
      {@render trackHead(
        'synth',
        'Synth',
        synthLevel,
        (v) => store.setParam('volume', v),
        help('volume')
      )}
      {#each sections as section (section.id)}<div class="border-t border-zinc-800"></div>{/each}
      <div class="border-t border-zinc-800"></div>
      {#if !padSlots.length}
        <p class={[cell, 'col-span-full pb-1.5 pl-6 text-xs text-zinc-600']}>
          {store.readOnly ? 'No loops.' : 'No loops yet: record or draw one on a pad below.'}
        </p>
      {/if}
      {#each padSlots as slot (slot)}
        <div
          class={[
            cell,
            'flex items-center pl-6 text-xs',
            store.loops[slot] ? 'text-zinc-300' : 'text-zinc-600'
          ]}
        >
          Pad {slot + 1}
        </div>
        {#each sections as section, i (section.id)}
          {@const on = section.pads.includes(slot)}
          <button
            type="button"
            aria-pressed={on}
            disabled={store.readOnly}
            aria-label={`Section ${i + 1}: pad ${slot + 1}`}
            onclick={() => togglePad(i, section, slot)}
            class={[
              'my-0.5 h-6 rounded transition active:scale-95 disabled:pointer-events-none',
              on
                ? 'bg-amber-400 shadow shadow-amber-400/20 hover:bg-amber-300'
                : 'bg-zinc-900 hover:bg-zinc-800'
            ]}
          ></button>
        {/each}
        <div></div>
      {/each}

      <!-- Drums: which pattern each section plays. -->
      {@render trackHead(
        'drums',
        'Drums',
        store.drums.volume,
        (v) => store.setDrums({ volume: v }),
        help('drums_level')
      )}
      {#each sections as section, i (section.id)}
        <div class="border-t border-zinc-800 py-1.5">
          <select
            value={section.drums ? section.pattern : -1}
            disabled={store.readOnly}
            aria-label={`Section ${i + 1}: drum pattern`}
            onchange={(e) => {
              const p = Number(e.currentTarget.value)
              store.updateSection(i, p < 0 ? { drums: false } : { drums: true, pattern: p })
            }}
            class={[
              // Options get their own colours: the popup can't use the translucent amber background.
              'w-full rounded-md border px-2 py-1 text-xs font-semibold disabled:pointer-events-none [&_option]:bg-zinc-900 [&_option]:text-zinc-200',
              section.drums
                ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            ]}
          >
            <option value={-1}>No drums</option>
            {#each DRUM_PATTERNS as letter, p (letter)}
              <option value={p}>Pattern {letter}</option>
            {/each}
          </select>
        </div>
      {/each}
      <div class="border-t border-zinc-800"></div>
    </div>
  </div>
  {#if !sections.length}
    <p
      class="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-500"
    >
      {#if store.readOnly}
        This song has no sections yet.
      {:else}
        Add sections, pick which pads and drums play in each, then <span class="text-zinc-300"
          >Play song</span
        > runs them in order. Pick a track to edit it below.
      {/if}
    </p>
  {/if}
</section>
