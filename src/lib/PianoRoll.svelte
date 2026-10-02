<script lang="ts">
  import { Play, Square, X } from '@lucide/svelte'
  import { onMount, untrack } from 'svelte'

  import type { Loop, NoteBend } from './types.js'

  import { HELP } from './help.js'
  import Info from './Info.svelte'
  import {
    bendDurations,
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

  // Note editor for one loop pad. Opens on `loop` and reports every finished edit
  // as a whole new loop through `onchange`; when `loop` changes from outside (undo,
  // redo), it reloads the notes from it.
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
    // Sounds a pitch, at a note's velocity when it has one.
    onpreview: (midi: number, velocity?: number) => void
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
  // Velocity lane: a bar per note, as tall as its velocity. Notes never go below
  // MIN_VELOCITY, so one can't vanish by accident.
  const LANE = 56
  const MIN_VELOCITY = 0.05
  const BAR_PX = 256
  const MAX_BARS = 32
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const GRIDS = [
    { label: '1/4', value: 1 },
    { label: '1/8', value: 0.5 },
    { label: '1/16', value: 0.25 },
    { label: '1/32', value: 0.125 }
  ]

  let tempo = untrack(() => loop.bpm ?? bpm)
  let view: NoteLoop = $state(untrack(() => notesFromLoop(loop, tempo)))
  // The last loop sent up, as JSON: when `loop` comes back different (undo, redo),
  // the notes are reloaded from it.
  let sent = untrack(() => JSON.stringify(loop))
  let grid = $state(0.25)
  let selected: null | number = $state(null)
  let mode: 'bend' | 'notes' = $state('notes')
  const selectedNote = $derived(view.notes.find((n) => n.id === selected))
  // Length of the next drawn note: the last one drawn or resized.
  let drawLength = $state(0.25)

  const bars = $derived(view.beats / BEATS_PER_BAR)
  const pitches = Array.from({ length: HIGHEST - LOWEST + 1 }, (_, i) => HIGHEST - i)
  const noteName = (midi: number) =>
    (NOTE_NAMES[midi % 12] ?? '') + String(Math.floor(midi / 12) - 1)
  const isBlack = (midi: number) => noteName(midi).includes('#')
  const pct = (beats: number) => `${(beats / view.beats) * 100}%`

  let gridEl: HTMLDivElement | undefined = $state()
  let laneEl: HTMLDivElement | undefined = $state()
  let scroller: HTMLDivElement | undefined = $state()

  function bendPath(note: Note): string {
    const [into, out] = bendDurations(note.bend, note.length)
    const y = ROW / 2
    return `M 0 ${y - (note.bend?.in?.semitones ?? 0) * ROW} L ${(into / note.length) * 100} ${y} L ${(1 - out / note.length) * 100} ${y} L 100 ${y - (note.bend?.out?.semitones ?? 0) * ROW}`
  }

  function clearBend() {
    if (!selectedNote?.bend) return
    delete selectedNote.bend
    commit()
  }

  function commit() {
    const next = loopFromNotes($state.snapshot(loop), $state.snapshot(view), tempo)
    sent = JSON.stringify(next)
    onchange(next)
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

  function setBend(side: 'in' | 'out', key: 'duration' | 'semitones', value: number) {
    const note = selectedNote
    if (!note || !Number.isFinite(value)) return
    const bend: NoteBend = { ...note.bend }
    const ramp = {
      duration: Math.min(0.25, note.length / 2),
      semitones: 0,
      ...bend[side],
      [key]:
        key === 'semitones'
          ? Math.min(48, Math.max(-48, value))
          : Math.min(128, Math.max(1 / 192, value))
    }
    if (ramp.semitones === 0) delete bend[side]
    else bend[side] = ramp
    if (bend.in || bend.out) note.bend = bend
    else delete note.bend
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

  $effect(() => {
    const json = JSON.stringify(loop)
    if (json === sent) return
    sent = json
    untrack(() => {
      tempo = loop.bpm ?? bpm
      view = notesFromLoop(loop, tempo)
      selected = null
      drag = null
    })
  })

  function beginDrag(e: PointerEvent, note: Note, mode: 'move' | 'resize', changed: boolean) {
    selected = note.id
    drag = { changed, id: note.id, mode, origin: { ...note }, x: e.clientX, y: e.clientY }
    gridEl?.setPointerCapture(e.pointerId)
  }

  function onGridDown(e: PointerEvent) {
    if (mode === 'bend' || e.button !== 0 || e.target !== gridEl) return
    const { beat, midi } = pointAt(e)
    const note = clampNote(
      { id: newNoteId(), length: drawLength, midi, start: snapDown(beat, grid), velocity: 1 },
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
    selected = note.id
    if (mode === 'bend') return
    const edge = e.target instanceof HTMLElement && e.target.dataset.edge !== undefined
    onpreview(note.midi, note.velocity)
    beginDrag(e, note, edge ? 'resize' : 'move', false)
  }

  // On a focused note: arrow keys nudge it (by the grid, or a semitone; an octave with
  // Shift), Delete removes it.
  function onNoteKey(e: KeyboardEvent, id: number) {
    const index = view.notes.findIndex((n) => n.id === id)
    const note = view.notes[index]
    if (!note) return
    selected = id
    if (mode === 'bend' && e.key.startsWith('Arrow')) return
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
      if (next.midi !== note.midi) onpreview(next.midi, next.velocity)
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
    if (next.midi !== current.midi) onpreview(next.midi, next.velocity)
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

  // Velocity lane: pressing sets the velocity of the notes under the pointer from
  // its height, and dragging paints across notes (just the selected one, when it's
  // under the pointer, so one note of a chord can be set alone). Committed on release.
  let painting: null | { changed: boolean } = null

  function onLaneDown(e: PointerEvent) {
    if (e.button !== 0) return
    // Pressing a note's bar picks that note, so a chord's notes can be set one by one.
    const bar = e.target instanceof HTMLElement ? e.target.dataset.velocity : undefined
    if (bar !== undefined) selected = Number(bar)
    painting = { changed: false }
    laneEl?.setPointerCapture(e.pointerId)
    paintVelocity(e)
  }

  function onLaneUp() {
    if (painting?.changed) {
      commit()
      // Let the edited note be heard at its new velocity (the selected one, if set).
      const note = view.notes.find((n) => n.id === selected)
      if (note) onpreview(note.midi, note.velocity)
    }
    painting = null
  }

  // On a focused velocity bar: up/down by 5% (25% with Shift).
  function onVelocityKey(e: KeyboardEvent, note: Note) {
    const steps: Record<string, number> = { ArrowDown: -1, ArrowUp: 1 }
    const step = steps[e.key]
    if (step === undefined) return
    e.preventDefault()
    selected = note.id
    const next = note.velocity + step * (e.shiftKey ? 0.25 : 0.05)
    note.velocity = Math.round(Math.min(1, Math.max(MIN_VELOCITY, next)) * 100) / 100
    onpreview(note.midi, note.velocity)
    commit()
  }

  function paintVelocity(e: PointerEvent) {
    const rect = laneEl?.getBoundingClientRect()
    if (!painting || !rect) return
    const beat = ((e.clientX - rect.left) / rect.width) * view.beats
    const high = 1 - (e.clientY - rect.top) / rect.height
    const velocity = Math.round(Math.min(1, Math.max(MIN_VELOCITY, high)) * 100) / 100
    const under = view.notes.filter((n) => n.start <= beat && beat < n.start + n.length)
    const chosen = under.filter((n) => n.id === selected)
    for (const note of chosen.length ? chosen : under) {
      if (note.velocity === velocity) continue
      note.velocity = velocity
      painting.changed = true
    }
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
    <label class="flex items-center gap-2 text-xs text-zinc-400">
      Edit
      <select
        id="roll-mode"
        bind:value={mode}
        class="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
      >
        <option value="notes">Notes</option>
        <option value="bend">Bend</option>
      </select>
      <Info label="Bend" text={HELP.roll_bend} />
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

  {#if mode === 'bend'}
    <div id="roll-bend" class="flex flex-wrap items-center gap-3 rounded-lg bg-zinc-950/60 p-3">
      {#if selectedNote}
        <span class="font-mono text-xs text-amber-300">{noteName(selectedNote.midi)}</span>
        {#each ['in', 'out'] as side (side)}
          {@const direction = side as 'in' | 'out'}
          <label class="flex items-center gap-1.5 text-xs text-zinc-400">
            Bend {side} (semitones)
            <Info
              label={`Bend ${side}`}
              text={direction === 'in' ? HELP.roll_bend_in : HELP.roll_bend_out}
            />
            <input
              id={`roll-bend-${side}`}
              aria-label={`Bend ${side} (semitones)`}
              type="number"
              min="-48"
              max="48"
              step="1"
              value={selectedNote.bend?.[direction]?.semitones ?? 0}
              onchange={(e) => setBend(direction, 'semitones', e.currentTarget.valueAsNumber)}
              class="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200"
            />
          </label>
          <label class="flex items-center gap-1.5 text-xs text-zinc-400">
            {side === 'in' ? 'In' : 'Out'} time (beats)
            <Info label={`Bend ${side} time`} text={HELP.roll_bend_duration} />
            <input
              id={`roll-bend-${side}-duration`}
              aria-label={`Bend ${side} time (beats)`}
              type="number"
              min={1 / 192}
              max="128"
              step="any"
              disabled={!selectedNote.bend?.[direction]}
              value={selectedNote.bend?.[direction]?.duration ??
                Math.min(0.25, selectedNote.length / 2)}
              onchange={(e) => setBend(direction, 'duration', e.currentTarget.valueAsNumber)}
              class="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 disabled:opacity-40"
            />
          </label>
        {/each}
        <button
          id="roll-bend-clear"
          type="button"
          class={btn}
          disabled={!selectedNote.bend}
          onclick={clearBend}
        >
          Clear bend
        </button>
      {:else}
        <p class="text-xs text-zinc-400">Select a note to bend it into or out of its pitch.</p>
      {/if}
    </div>
  {/if}

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
        aria-label={mode === 'bend'
          ? 'Bends: select a note, then set its bend in and out above'
          : 'Notes: click to add, drag to move, drag the right edge to resize, right-click to delete; a focused note moves with the arrow keys'}
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
            aria-label={`${noteName(note.midi)} at beat ${note.start + 1}, ${note.length} beats, velocity ${Math.round(note.velocity * 100)}%${note.bend ? `, bend in ${note.bend.in?.semitones ?? 0}, bend out ${note.bend.out?.semitones ?? 0} semitones` : ''}`}
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
              'absolute cursor-grab rounded-sm border text-left font-mono text-[9px] leading-none text-zinc-900 active:cursor-grabbing',
              selected === note.id
                ? 'z-10 border-white bg-amber-300 shadow shadow-amber-400/40'
                : 'border-amber-600 bg-amber-400 hover:bg-amber-300'
            ]}
            style="left: {pct(note.start)}; width: {pct(note.length)}; top: {(HIGHEST - note.midi) *
              ROW}px; height: {ROW - 1}px; opacity: {0.4 + 0.6 * note.velocity}"
          >
            <span class="pointer-events-none block truncate pl-0.5">{noteName(note.midi)}</span>
            {#if note.bend}
              <svg
                data-bend={note.id}
                aria-hidden="true"
                viewBox={`0 0 100 ${ROW}`}
                preserveAspectRatio="none"
                class="pointer-events-none absolute inset-0 size-full overflow-visible"
              >
                <path
                  d={bendPath(note)}
                  fill="none"
                  stroke="white"
                  stroke-width="1.5"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
            {/if}
            {#if mode === 'notes'}
              <span data-edge class="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"></span>
            {/if}
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

    <!-- Velocity lane: stays at the bottom while the notes scroll up and down, and
         scrolls sideways with them. -->
    <div
      class="sticky bottom-0 z-30 flex border-t border-zinc-700 bg-zinc-950"
      style="height: {LANE}px; min-width: 100%"
    >
      <div
        class="sticky left-0 z-10 flex w-12 shrink-0 items-start justify-end border-r border-zinc-800 bg-zinc-950 pt-1 pr-1.5 font-mono text-[9px] text-zinc-500"
      >
        Vel
      </div>
      <div
        bind:this={laneEl}
        id="roll-velocity"
        role="group"
        aria-label="Velocity: drag up or down over notes to set how hard they play; a focused bar moves with the arrow keys"
        class="relative flex-1 cursor-ns-resize touch-none select-none"
        style="width: max(100%, {bars * BAR_PX}px); min-width: {bars * BAR_PX}px"
        onpointerdown={onLaneDown}
        onpointermove={paintVelocity}
        onpointerup={onLaneUp}
        onpointercancel={onLaneUp}
      >
        {#each view.notes as note (note.id)}
          <div
            role="slider"
            tabindex="0"
            data-velocity={note.id}
            aria-label={`Velocity of ${noteName(note.midi)} at beat ${note.start + 1}`}
            aria-valuemin={Math.round(MIN_VELOCITY * 100)}
            aria-valuemax={100}
            aria-valuenow={Math.round(note.velocity * 100)}
            aria-valuetext={`${Math.round(note.velocity * 100)}%`}
            onkeydown={(e) => onVelocityKey(e, note)}
            onfocus={() => (selected = note.id)}
            class={[
              'absolute bottom-0 rounded-t-sm border-t-2 outline-none focus-visible:ring-1 focus-visible:ring-amber-400',
              selected === note.id
                ? 'z-10 border-white bg-amber-300/60'
                : 'border-amber-400 bg-amber-400/25'
            ]}
            style="left: {pct(note.start)}; width: max(3px, {pct(
              note.length
            )}); height: {note.velocity * 100}%"
          ></div>
        {/each}
      </div>
    </div>
  </div>

  <p class="text-xs text-zinc-500">
    {#if mode === 'bend'}
      Select a note · negative Bend in scoops up, negative Bend out dives down · times follow the
      tempo; if both bends are too long, they shrink together to fit · Play to hear the bends
    {:else}
      Click to add a note and drag to set its length · drag a note to move it, its right edge to
      resize · right-click or double-click to delete · arrow keys nudge the selected note · drag up
      or down in the Vel lane to set how hard notes play
    {/if}
  </p>
</section>
