<script lang="ts">
  import { Headphones, Music, RotateCcw, Square } from '@lucide/svelte'
  import { onMount } from 'svelte'

  import Keyboard from './Keyboard.svelte'
  import { splitLines, TUNES, writtenName } from './notation.js'
  import { createSequencer, type SeqNote, type Sequencer, SOUNDS } from './sound.js'
  import Staff from './Staff.svelte'
  import { button, chip, panel } from './ui.js'

  // Sight-read a tune: the note to play is highlighted, and pressing its key on
  // the keyboard moves on to the next (a wrong key flashes red; after two misses
  // its name shows). Listen plays the whole tune, following along on the staff.
  let tuneIndex = $state(0)
  let current = $state(0)
  let misses = $state(0)
  let miss = $state(-1)
  let names = $state(false)
  let listening = $state(-1)
  let sequencer: null | Sequencer = null

  const tune = $derived(TUNES[tuneIndex] ?? TUNES[0])
  const notes = $derived(tune?.notes ?? [])
  const lines = $derived(splitLines(notes, 2))
  const done = $derived(current >= notes.length)
  const target = $derived(notes[current]?.midi)
  // Where each note starts, in 8th-note steps.
  const starts = $derived(
    notes.map((_, i) => Math.round(notes.slice(0, i).reduce((t, n) => t + n.beats, 0) * 2))
  )

  function choose(i: number) {
    sequencer?.stop()
    tuneIndex = i
    restart()
  }

  function listen() {
    if (listening >= 0) {
      sequencer?.stop()
      return
    }
    sequencer ??= createSequencer({
      bpm: () => 100,
      length: () => Math.round(notes.reduce((t, n) => t + n.beats, 0) * 2),
      loop: false,
      notesAt,
      onStep: (step) => {
        listening = step < 0 ? -1 : starts.findLastIndex((s) => s <= step)
      },
      stepBeats: () => 0.5
    })
    sequencer.start()
  }

  function notesAt(step: number): SeqNote[] {
    const note = notes[starts.indexOf(step)]
    return note?.midi === undefined
      ? []
      : [{ channel: 'tune', length: note.beats * 2, midi: note.midi, sound: SOUNDS.chords }]
  }

  function press(midi: number) {
    if (done || listening >= 0) return
    if (midi === target) {
      current++
      misses = 0
      miss = -1
      // Rests are skipped over.
      while (current < notes.length && notes[current]?.midi === undefined) current++
    } else {
      misses++
      miss = current
      setTimeout(() => (miss = miss === current ? -1 : miss), 400)
    }
  }

  function restart() {
    current = 0
    misses = 0
    miss = -1
  }

  onMount(() => () => sequencer?.stop())
</script>

<div id="sight-reader" class={panel}>
  <div class="flex flex-wrap gap-1.5" role="group" aria-label="Tune">
    {#each TUNES as t, i (t.name)}
      <button
        type="button"
        aria-pressed={tuneIndex === i}
        class={chip(tuneIndex === i)}
        onclick={() => choose(i)}>{t.name}</button
      >
    {/each}
  </div>
  {#if tune}
    <div class="space-y-2">
      {#each lines as line, l (`${tuneIndex}-${l}`)}
        <Staff
          clef={tune.clef}
          key={tune.key}
          notes={line.notes}
          time={l === 0}
          labels={names ? 'names' : null}
          highlight={(listening >= 0 ? listening : current) - line.offset}
          miss={miss - line.offset}
        />
      {/each}
    </div>
  {/if}
  <div class="flex flex-wrap items-center gap-2">
    <button
      id="sight-listen"
      type="button"
      class={button}
      onclick={listen}
      aria-pressed={listening >= 0}
    >
      {#if listening >= 0}<Square class="size-4" /> Stop{:else}<Headphones class="size-4" /> Listen{/if}
    </button>
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input id="sight-names" type="checkbox" bind:checked={names} class="accent-amber-400" /> Show note
      names
    </label>
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      onclick={restart}
    >
      <RotateCcw class="size-4" /> Start over
    </button>
  </div>
  <p class="min-h-5 text-sm" role="status">
    {#if done}
      <span class="font-medium text-emerald-300"
        ><Music class="inline size-4" /> You played the whole tune from the sheet music. Try another one!</span
      >
    {:else if misses >= 2 && target !== undefined}
      <span class="text-zinc-300"
        >Hint: this one is <span class="font-semibold text-amber-200"
          >{writtenName(target, tune?.key)}</span
        >.</span
      >
    {:else}
      <span class="text-zinc-400"
        >Play the highlighted note on the keyboard ({current + 1} of {notes.length}).</span
      >
    {/if}
  </p>
  <Keyboard
    id="sight-keyboard"
    low={tune?.clef === 'bass' ? 36 : 60}
    high={tune?.clef === 'bass' ? 59 : 83}
    names="marked"
    onpress={press}
  />
</div>
