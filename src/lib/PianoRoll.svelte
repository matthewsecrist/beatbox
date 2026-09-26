<script lang="ts">
  import { Play, Square, X } from '@lucide/svelte'
  import { onMount, untrack } from 'svelte'

  import type { Loop } from './types.js'

  import {
    clampNote,
    fitToLength,
    loopFromNotes,
    newNoteId,
    type Note,
    type NoteLoop,
    notesFromLoop,
    quantize,
    snap,
    snapDown
  } from './synth/notes.js'
  import { BEATS_PER_BAR } from './transport.js'

  // Note editor for one loop pad. Opens on `loop` (the parent remounts it when the
  // loop is replaced from outside, e.g. re-recorded) and reports every finished
  // edit as a whole new loop through `onchange`.
  let {
    bpm,
    loop,
    onchange,
    onclose,
    onpreview,
    ontoggle,
    playing,
    position,
    slot
  }: {
    // Current song tempo; used for loops recorded before tempo sync.
    bpm: number
    loop: Loop
    onchange: (loop: Loop) => void
    onclose: () => void
    onpreview: (midi: number) => void
    ontoggle: () => void
    playing: boolean
    // Playhead, 0..1 through the loop.
    position: number
    slot: number
  } = $props()

  const LOWEST = 24 // C1
  const HIGHEST = 108 // C8
  const RANGE = [LOWEST, HIGHEST] as const
  const ROW = 12 // px per semitone
  const BAR_PX = 256
  const MAX_BARS = 32
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const GRIDS = [
    { label: '1/4', value: 1 },
    { label: '1/8', value: 0.5 },
    { label: '1/16', value: 0.25 },
    { label: '1/32', value: 0.125 }
  ]

  const tempo = untrack(() => loop.bpm ?? bpm)
  let view: NoteLoop = $state(untrack(() => notesFromLoop(loop, tempo)))
  let grid = $state(0.25)
  let selected: null | number = $state(null)
  // Length of the next drawn note: the last one drawn or resized.
  let drawLength = $state(0.25)

  const bars = $derived(view.beats / BEATS_PER_BAR)
  const pitches = Array.from({ length: HIGHEST - LOWEST + 1 }, (_, i) => HIGHEST - i)
  const noteName = (midi: number) =>
    (NOTE_NAMES[midi % 12] ?? '') + String(Math.floor(midi / 12) - 1)
  const isBlack = (midi: number) => noteName(midi).includes('#')
  const pct = (beats: number) => `${(beats / view.beats) * 100}%`

  let gridEl: HTMLDivElement | undefined = $state()
  let scroller: HTMLDivElement | undefined = $state()

  function commit() {
    onchange(loopFromNotes($state.snapshot(loop), $state.snapshot(view), tempo))
  }

  function remove(id: number) {
    if (selected === id) selected = null
    setNotes(view.notes.filter((n) => n.id !== id))
  }

  function setBars(n: number) {
    const beats = Math.min(MAX_BARS, Math.max(1, n)) * BEATS_PER_BAR
    view = { beats, notes: fitToLength(view.notes, beats) }
    commit()
  }

  function setNotes(notes: Note[]) {
    view.notes = notes
    commit()
  }

  // Dragging: a new or grabbed note moves (body) or changes length (right edge or
  // while drawing), snapped to the grid. The edit is committed on release.
  let drag: null | {
    changed: boolean
    id: number
    mode: 'move' | 'resize'
    origin: Note
    x: number
    y: number
  } = null

  function beginDrag(e: PointerEvent, note: Note, mode: 'move' | 'resize', changed: boolean) {
    selected = note.id
    drag = { changed, id: note.id, mode, origin: { ...note }, x: e.clientX, y: e.clientY }
    gridEl?.setPointerCapture(e.pointerId)
  }

  function onGridDown(e: PointerEvent) {
    if (e.button !== 0 || e.target !== gridEl) return
    const { beat, midi } = pointAt(e)
    const note = clampNote(
      { id: newNoteId(), length: drawLength, midi, start: snapDown(beat, grid) },
      view.beats,
      RANGE
    )
    view.notes.push(note)
    onpreview(note.midi)
    beginDrag(e, note, 'resize', true)
  }

  function onNoteDown(e: PointerEvent, note: Note) {
    e.stopPropagation()
    if (e.button === 2) return
    const edge = e.target instanceof HTMLElement && e.target.dataset.edge !== undefined
    onpreview(note.midi)
    beginDrag(e, note, edge ? 'resize' : 'move', false)
  }

  // On a focused note: arrow keys nudge it (by the grid, or a semitone; an octave with
  // Shift), Delete removes it.
  function onNoteKey(e: KeyboardEvent, id: number) {
    const index = view.notes.findIndex((n) => n.id === id)
    const note = view.notes[index]
    if (!note) return
    selected = id
    const moves: Record<string, Partial<Note>> = {
      ArrowDown: { midi: note.midi - (e.shiftKey ? 12 : 1) },
      ArrowLeft: { start: note.start - grid },
      ArrowRight: { start: note.start + grid },
      ArrowUp: { midi: note.midi + (e.shiftKey ? 12 : 1) }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(note.id)
    } else if (e.key in moves) {
      e.preventDefault()
      const next = clampNote({ ...note, ...moves[e.key] }, view.beats, RANGE)
      if (next.midi !== note.midi) onpreview(next.midi)
      view.notes[index] = next
      commit()
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag || !gridEl) return
    const { origin } = drag
    const width = gridEl.getBoundingClientRect().width
    const dBeats = ((e.clientX - drag.x) / width) * view.beats
    const index = view.notes.findIndex((n) => n.id === drag?.id)
    const current = view.notes[index]
    if (!current) return
    let next: Note
    if (drag.mode === 'move') {
      const dRows = Math.round((e.clientY - drag.y) / ROW)
      next = { ...origin, midi: origin.midi - dRows, start: snap(origin.start + dBeats, grid) }
    } else {
      const end = snap(origin.start + origin.length + dBeats, grid)
      next = { ...origin, length: Math.max(grid, end - origin.start) }
    }
    next = clampNote(next, view.beats, RANGE)
    if (next.midi !== current.midi) onpreview(next.midi)
    if (
      next.start !== current.start ||
      next.length !== current.length ||
      next.midi !== current.midi
    ) {
      view.notes[index] = next
      drag.changed = true
    }
  }

  function onPointerUp() {
    if (!drag) return
    const { changed, id, mode } = drag
    drag = null
    const note = view.notes.find((n) => n.id === id)
    if (note && mode === 'resize') drawLength = note.length
    if (changed) commit()
  }

  function pointAt(e: PointerEvent): { beat: number; midi: number } {
    const rect = gridEl?.getBoundingClientRect()
    if (!rect) return { beat: 0, midi: LOWEST }
    return {
      beat: ((e.clientX - rect.left) / rect.width) * view.beats,
      midi: HIGHEST - Math.floor((e.clientY - rect.top) / ROW)
    }
  }

  // Open on the loop's notes (or middle C for an empty loop).
  onMount(() => {
    const midis = view.notes.map((n) => n.midi)
    const center = midis.length ? (Math.min(...midis) + Math.max(...midis)) / 2 : 60
    if (scroller) scroller.scrollTop = (HIGHEST - center) * ROW - scroller.clientHeight / 2
  })

  const btn =
    'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40'
  const iconBtn =
    'flex size-7 items-center justify-center rounded-md text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 disabled:pointer-events-none disabled:opacity-30'
</script>

<section
  id="piano-roll"
  class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
  aria-label={`Piano roll, loop pad ${slot + 1}`}
>
  <div class="flex flex-wrap items-center gap-2">
    <h2 class="mr-auto text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">
      Piano roll
      <span class="ml-2 font-mono tracking-normal text-zinc-500 normal-case">Pad {slot + 1}</span>
    </h2>
    <button
      id="roll-play"
      type="button"
      aria-pressed={playing}
      onclick={ontoggle}
      class={[
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition active:scale-95',
        playing
          ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
          : 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/20 hover:bg-amber-300'
      ]}
    >
      {#if playing}
        <Square class="size-3.5 fill-current" /> Stop
      {:else}
        <Play class="size-3.5 fill-current" /> Play
      {/if}
    </button>
    <div class="flex items-center rounded-md bg-zinc-950/60" role="group" aria-label="Loop length">
      <button
        id="roll-bars-down"
        type="button"
        class={iconBtn}
        aria-label="Fewer bars"
        disabled={bars <= 1}
        onclick={() => setBars(bars - 1)}>−</button
      >
      <span id="roll-bars" class="w-16 text-center font-mono text-xs text-zinc-300 tabular-nums">
        {bars}
        {bars === 1 ? 'bar' : 'bars'}
      </span>
      <button
        id="roll-bars-up"
        type="button"
        class={iconBtn}
        aria-label="More bars"
        disabled={bars >= MAX_BARS}
        onclick={() => setBars(bars + 1)}>+</button
      >
    </div>
    <label class="flex items-center gap-2 text-xs tracking-wider text-zinc-400 uppercase">
      Grid
      <select
        id="roll-grid"
        bind:value={grid}
        class="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 normal-case transition hover:border-amber-400/60 focus:border-amber-400 focus:outline-none"
      >
        {#each GRIDS as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
    <button
      id="roll-quantize"
      type="button"
      class={btn}
      disabled={view.notes.length === 0}
      onclick={() => setNotes(quantize(view.notes, grid, view.beats))}
    >
      Quantize
    </button>
    <button
      id="roll-clear"
      type="button"
      class={btn}
      disabled={view.notes.length === 0}
      onclick={() => {
        selected = null
        setNotes([])
      }}
    >
      Clear
    </button>
    <button
      id="roll-close"
      type="button"
      class={iconBtn}
      aria-label="Close piano roll"
      onclick={onclose}
    >
      <X class="size-4" />
    </button>
  </div>

  <div
    bind:this={scroller}
    class="relative max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950"
  >
    <div class="flex" style="height: {pitches.length * ROW}px; min-width: 100%">
      <!-- Pitch labels: stay put while the grid scrolls sideways. -->
      <div class="sticky left-0 z-20 w-12 shrink-0 border-r border-zinc-800 bg-zinc-950">
        {#each pitches as midi (midi)}
          <div
            class={[
              'flex items-center justify-end pr-1.5 font-mono text-[9px]',
              isBlack(midi) ? 'bg-zinc-900 text-zinc-600' : 'text-zinc-500',
              midi % 12 === 0 && 'border-b border-zinc-700 text-zinc-300'
            ]}
            style="height: {ROW}px"
          >
            {midi % 12 === 0 ? noteName(midi) : ''}
          </div>
        {/each}
      </div>

      <div
        bind:this={gridEl}
        id="roll-grid-area"
        role="application"
        aria-label="Notes: click to add, drag to move, drag the right edge to resize, right-click to delete; a focused note moves with the arrow keys"
        class="relative flex-1 cursor-crosshair touch-none outline-none select-none focus-visible:ring-1 focus-visible:ring-amber-400/60"
        style="width: max(100%, {bars * BAR_PX}px); min-width: {bars *
          BAR_PX}px; background-image: linear-gradient(to right, rgb(113 113 122 / 0.55) 1px, transparent 1px), linear-gradient(to right, rgb(63 63 70 / 0.8) 1px, transparent 1px), linear-gradient(to right, rgb(39 39 42 / 0.9) 1px, transparent 1px); background-size: {100 /
          bars}% 100%, {100 / view.beats}% 100%, {(100 * grid) / view.beats}% 100%"
        onpointerdown={onGridDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        oncontextmenu={(e) => e.preventDefault()}
      >
        {#each pitches as midi (midi)}
          {#if isBlack(midi)}
            <div
              class="pointer-events-none absolute inset-x-0 bg-black/30"
              style="top: {(HIGHEST - midi) * ROW}px; height: {ROW}px"
            ></div>
          {/if}
        {/each}

        {#each view.notes as note (note.id)}
          <button
            type="button"
            data-note={note.id}
            aria-label={`${noteName(note.midi)} at beat ${note.start + 1}, ${note.length} beats`}
            aria-pressed={selected === note.id}
            onpointerdown={(e) => onNoteDown(e, note)}
            oncontextmenu={(e) => {
              e.preventDefault()
              remove(note.id)
            }}
            ondblclick={() => remove(note.id)}
            onkeydown={(e) => onNoteKey(e, note.id)}
            onfocus={() => (selected = note.id)}
            class={[
              'absolute cursor-grab overflow-hidden rounded-sm border text-left font-mono text-[9px] leading-none text-zinc-900 active:cursor-grabbing',
              selected === note.id
                ? 'z-10 border-white bg-amber-300 shadow shadow-amber-400/40'
                : 'border-amber-600 bg-amber-400 hover:bg-amber-300'
            ]}
            style="left: {pct(note.start)}; width: {pct(note.length)}; top: {(HIGHEST - note.midi) *
              ROW}px; height: {ROW - 1}px"
          >
            <span class="pointer-events-none pl-0.5">{noteName(note.midi)}</span>
            <span data-edge class="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"></span>
          </button>
        {/each}

        {#if playing}
          <div
            class="pointer-events-none absolute inset-y-0 z-10 w-px bg-zinc-100/80"
            style="left: {position * 100}%"
          ></div>
        {/if}
      </div>
    </div>
  </div>

  <p class="text-xs text-zinc-500">
    Click to add a note and drag to set its length · drag a note to move it, its right edge to
    resize · right-click or double-click to delete · arrow keys nudge the selected note
  </p>
</section>
