<script lang="ts">
  import { Play } from '@lucide/svelte'

  import Keyboard from './Keyboard.svelte'
  import { playGroups } from './sound.js'
  import { type ChordId, chordNotes, CHORDS, keyChords, NOTE_NAMES, noteName } from './theory.js'
  import { button, chip, panel, select } from './ui.js'

  // Build a chord from a root and a type and hear it, or play the seven chords
  // of a major key. Whatever played last lights up on the keyboard.
  const CHORD_ORDER: ChordId[] = ['maj', 'min', 'dim', '7']

  let root = $state(60)
  let chord: ChordId = $state('maj')
  let keyRoot = $state(60)
  let shown: number[] = $state(chordNotes(60, 'maj'))

  const built = $derived(chordNotes(root, chord))
  const inKey = $derived(keyChords(keyRoot))

  function play(notes: number[], arpeggio = false) {
    shown = notes
    playGroups(arpeggio ? [...notes.map((n) => [n]), notes] : [notes], {
      gap: 0.35,
      length: 0.9
    })
  }
</script>

<div id="chord-explorer" class={panel}>
  <div class="flex flex-wrap items-center gap-3">
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      Root
      <select id="chord-root" class={select} bind:value={root}>
        {#each NOTE_NAMES as name, i (name)}
          <option value={60 + i}>{name}</option>
        {/each}
      </select>
    </label>
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Chord type">
      {#each CHORD_ORDER as id (id)}
        <button
          type="button"
          aria-pressed={chord === id}
          class={chip(chord === id)}
          onclick={() => {
            chord = id
            play(chordNotes(root, chord), true)
          }}>{CHORDS[id].label}</button
        >
      {/each}
    </div>
    <button id="play-chord" type="button" class={button} onclick={() => play(built, true)}>
      <Play class="size-4" /> Play chord
    </button>
  </div>
  <p class="text-sm text-zinc-300">
    {noteName(root, false)}
    {CHORDS[chord].label.toLowerCase()}:
    <span class="font-semibold text-amber-200"
      >{built.map((n) => noteName(n, false)).join(' – ')}</span
    >
  </p>
  <div class="space-y-2">
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      Chords in the key of
      <select id="key-root" class={select} bind:value={keyRoot}>
        {#each NOTE_NAMES as name, i (name)}
          <option value={60 + i}>{name} major</option>
        {/each}
      </select>
    </label>
    <div id="key-chords" class="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
      {#each inKey as c (c.numeral)}
        <button
          type="button"
          class="rounded-lg border border-zinc-700 px-2 py-2 text-center transition hover:border-amber-400/60 hover:bg-zinc-800 active:scale-95"
          onclick={() => play(c.notes)}
        >
          <span class="block text-xs text-zinc-500">{c.numeral}</span>
          <span class="block font-semibold text-zinc-100">{c.name}</span>
        </button>
      {/each}
    </div>
  </div>
  <Keyboard id="chord-keyboard" low={60} high={95} marked={shown} names="marked" />
</div>
