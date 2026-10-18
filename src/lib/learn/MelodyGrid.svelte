<script lang="ts">
  import { Dices, Eraser, Lightbulb, Play, Square } from '@lucide/svelte'
  import { onMount } from 'svelte'

  import {
    backingAt,
    EXAMPLE_MELODY,
    type Melody,
    MELODY_CELLS,
    MELODY_CHORDS,
    MELODY_ROWS,
    melodyAt,
    type Part,
    randomMelody,
    STEPS_PER_BAR
  } from './arrange.js'
  import { createSequencer, playGroups, type SeqNote, type Sequencer, SOUNDS } from './sound.js'
  import { noteName } from './theory.js'
  import { button, chip, panel } from './ui.js'

  // Draw a melody on the notes of the pentatonic scale (one note per column, so
  // tapping a column's other row moves it) and hear it over a backing of drums,
  // bass and chords, each of which can be switched off.
  let melody: Melody = $state(Array<null>(MELODY_CELLS).fill(null))
  let backing: Exclude<Part, 'melody'>[] = $state(['drums', 'bass', 'chords'])
  let playing = $state(false)
  let current = $state(-1)
  let sequencer: null | Sequencer = null

  const rows = [...MELODY_ROWS.keys()].reverse()
  const BACKING: [Exclude<Part, 'melody'>, string][] = [
    ['drums', 'Drums'],
    ['bass', 'Bass'],
    ['chords', 'Chords']
  ]

  function notesAt(step: number): SeqNote[] {
    const chord = MELODY_CHORDS[Math.floor(step / STEPS_PER_BAR)] ?? MELODY_CHORDS[0]
    const s = step % STEPS_PER_BAR
    const notes: SeqNote[] = melodyAt(melody, step).map((h) => ({
      ...h,
      channel: 'lead',
      sound: SOUNDS.lead
    }))
    if (!chord) return notes
    for (const part of backing) {
      for (const h of backingAt(part, s, chord)) {
        const sound = part === 'drums' ? SOUNDS[h.drum ?? 'hat'] : SOUNDS[part]
        notes.push({ ...h, channel: part, sound, velocity: part === 'chords' ? 0.5 : 0.8 })
      }
    }
    return notes
  }

  function tap(cell: number, row: number) {
    melody[cell] = melody[cell] === row ? null : row
    const midi = MELODY_ROWS[row]
    if (!playing && melody[cell] !== null && midi !== undefined)
      playGroups([[midi]], { length: 0.3, sound: SOUNDS.lead })
  }

  function toggle() {
    if (playing) {
      sequencer?.stop()
      playing = false
      return
    }
    sequencer ??= createSequencer({
      bpm: () => 100,
      length: () => STEPS_PER_BAR * MELODY_CHORDS.length,
      notesAt,
      onStep: (step) => (current = step < 0 ? -1 : Math.floor(step / 2))
    })
    sequencer.start()
    playing = true
  }

  onMount(() => () => sequencer?.stop())
</script>

<div id="melody-grid" class={panel}>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[30rem] table-fixed border-separate border-spacing-0.5">
      <tbody>
        {#each rows as row (row)}
          {@const midi = MELODY_ROWS[row] ?? 0}
          <tr>
            <th
              class={[
                'w-10 pr-1 text-left text-xs font-medium',
                midi % 12 === 0 ? 'text-amber-300' : 'text-zinc-500'
              ]}
            >
              {noteName(midi, false)}
            </th>
            {#each melody as on, cell (cell)}
              <td>
                <button
                  type="button"
                  aria-label={`${noteName(midi)}, beat ${cell / 2 + 1}`}
                  aria-pressed={on === row}
                  onclick={() => tap(cell, row)}
                  class={[
                    'block h-6 w-full rounded-sm transition active:scale-90',
                    on === row
                      ? 'bg-amber-400'
                      : cell % 8 === 0
                        ? 'bg-zinc-700 hover:bg-zinc-600'
                        : cell % 2 === 0
                          ? 'bg-zinc-800 hover:bg-zinc-700'
                          : 'bg-zinc-800/60 hover:bg-zinc-700',
                    current === cell && 'ring-2 ring-zinc-100'
                  ]}
                ></button>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <button id="melody-play" type="button" class={button} onclick={toggle} aria-pressed={playing}>
      {#if playing}<Square class="size-4" /> Stop{:else}<Play class="size-4" /> Play{/if}
    </button>
    {#each BACKING as [part, label] (part)}
      <button
        type="button"
        aria-pressed={backing.includes(part)}
        class={chip(backing.includes(part))}
        onclick={() =>
          (backing = backing.includes(part)
            ? backing.filter((p) => p !== part)
            : [...backing, part])}>{label}</button
      >
    {/each}
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <button
      id="melody-example"
      type="button"
      class="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
      onclick={() => (melody = [...EXAMPLE_MELODY])}
    >
      <Lightbulb class="size-4" /> Example
    </button>
    <button
      id="melody-random"
      type="button"
      class="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
      onclick={() => (melody = randomMelody())}
    >
      <Dices class="size-4" /> Surprise me
    </button>
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      onclick={() => (melody = Array<null>(MELODY_CELLS).fill(null))}
    >
      <Eraser class="size-4" /> Clear
    </button>
  </div>
</div>
