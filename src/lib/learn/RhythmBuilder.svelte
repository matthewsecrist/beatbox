<script lang="ts">
  import { Eraser, Play, Square, Undo2 } from '@lucide/svelte'
  import { onMount } from 'svelte'

  import { BEATS_PER_BAR, type StaffNote, totalBeats } from './notation.js'
  import { createSequencer, type SeqNote, type Sequencer, SOUNDS } from './sound.js'
  import Staff from './Staff.svelte'
  import { button, chip, panel } from './ui.js'

  // Build two bars of rhythm from note lengths and rests, with the count written
  // under each note, then hear it over a click on every beat. A length that
  // won't fit in what's left of the bar can't be added.
  const BARS = 2
  const PITCH = 71 // B4, the middle line
  const CHOICES: { beats: number; label: string; rest?: boolean }[] = [
    { beats: 4, label: 'Whole (4)' },
    { beats: 3, label: 'Dotted half (3)' },
    { beats: 2, label: 'Half (2)' },
    { beats: 1, label: 'Quarter (1)' },
    { beats: 0.5, label: 'Eighth (½)' },
    { beats: 0.25, label: 'Sixteenth (¼)' },
    { beats: 2, label: 'Half rest (2)', rest: true },
    { beats: 1, label: 'Quarter rest (1)', rest: true },
    { beats: 0.5, label: 'Eighth rest (½)', rest: true }
  ]
  const EXAMPLES: [string, StaffNote[]][] = [
    ['Steady', [1, 1, 1, 1, 1, 1, 1, 1].map((beats) => ({ beats, midi: PITCH }))],
    ['Gallop', [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 2].map((beats) => ({ beats, midi: PITCH }))],
    [
      'With rests',
      [
        { beats: 1, midi: PITCH },
        { beats: 1 },
        { beats: 1, midi: PITCH },
        { beats: 0.5, midi: PITCH },
        { beats: 0.5, midi: PITCH },
        { beats: 0.5 },
        { beats: 0.5, midi: PITCH },
        { beats: 1, midi: PITCH },
        { beats: 2, midi: PITCH }
      ]
    ],
    [
      'Busy',
      [0.25, 0.25, 0.5, 1, 0.25, 0.25, 0.25, 0.25, 1, 1.5, 0.5, 2].map((beats) => ({
        beats,
        midi: PITCH
      }))
    ]
  ]

  let notes: StaffNote[] = $state([...(EXAMPLES[0]?.[1] ?? [])])
  let playing = $state(false)
  let current = $state(-1)
  let sequencer: null | Sequencer = null

  const used = $derived(totalBeats(notes))
  const leftInBar = $derived(
    used >= BARS * BEATS_PER_BAR ? 0 : BEATS_PER_BAR - (used % BEATS_PER_BAR)
  )
  // Each note's start, in 16th steps.
  const starts = $derived(notes.map((_, i) => Math.round(totalBeats(notes.slice(0, i)) * 4)))

  function notesAt(step: number): SeqNote[] {
    const out: SeqNote[] = []
    if (step % 4 === 0)
      out.push({
        channel: 'click',
        length: 1,
        midi: 72,
        sound: SOUNDS.hat,
        velocity: step % 16 ? 0.4 : 0.8
      })
    const i = starts.indexOf(step)
    const note = notes[i]
    if (note?.midi !== undefined)
      out.push({ channel: 'rhythm', length: note.beats * 4, midi: 72, sound: SOUNDS.lead })
    return out
  }

  function toggle() {
    if (playing) {
      sequencer?.stop()
      playing = false
      return
    }
    sequencer ??= createSequencer({
      bpm: () => 90,
      length: () => BARS * BEATS_PER_BAR * 4,
      notesAt,
      onStep: (step) => {
        if (step < 0) current = -1
        else {
          const i = starts.findLastIndex((s) => s <= step)
          current = i
        }
      }
    })
    sequencer.start()
    playing = true
  }

  onMount(() => () => sequencer?.stop())
</script>

<div id="rhythm-builder" class={panel}>
  <div class="flex flex-wrap gap-1.5" role="group" aria-label="Examples">
    {#each EXAMPLES as [name, example] (name)}
      <button type="button" class={chip(false)} onclick={() => (notes = [...example])}
        >{name}</button
      >
    {/each}
  </div>
  <div class="overflow-x-auto">
    <Staff id="rhythm-staff" clef="treble" {notes} time labels="counts" highlight={current} />
  </div>
  <p class="text-sm text-zinc-400">
    {#if leftInBar === 0}
      Both bars are full. Press Play, or Undo to change the end.
    {:else}
      Bar {Math.min(BARS, Math.floor(used / BEATS_PER_BAR) + 1)}: {leftInBar}
      {leftInBar === 1 ? 'beat' : 'beats'} left to fill.
    {/if}
  </p>
  <div class="flex flex-wrap gap-1.5" role="group" aria-label="Add a note or rest">
    {#each CHOICES as choice (choice.label)}
      <button
        type="button"
        disabled={choice.beats > leftInBar}
        class={[chip(false), 'disabled:opacity-30']}
        onclick={() =>
          (notes = [
            ...notes,
            choice.rest ? { beats: choice.beats } : { beats: choice.beats, midi: PITCH }
          ])}>{choice.label}</button
      >
    {/each}
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <button id="rhythm-play" type="button" class={button} onclick={toggle} aria-pressed={playing}>
      {#if playing}<Square class="size-4" /> Stop{:else}<Play class="size-4" /> Play{/if}
    </button>
    <button
      type="button"
      disabled={!notes.length}
      class="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
      onclick={() => (notes = notes.slice(0, -1))}
    >
      <Undo2 class="size-4" /> Undo
    </button>
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      onclick={() => (notes = [])}
    >
      <Eraser class="size-4" /> Clear
    </button>
  </div>
</div>
