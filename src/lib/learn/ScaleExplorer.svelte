<script lang="ts">
  import { Play } from '@lucide/svelte'

  import Keyboard from './Keyboard.svelte'
  import { playGroups } from './sound.js'
  import { NOTE_NAMES, noteName, type ScaleId, scaleNotes, SCALES } from './theory.js'
  import { button, chip, panel, select } from './ui.js'

  // A root and a scale: its notes light up, with the steps between them, and
  // Play scale runs up it and back down.
  const SCALE_ORDER: ScaleId[] = ['major', 'minor', 'pentatonic', 'blues']

  let root = $state(60)
  let scale: ScaleId = $state('major')

  const notes = $derived(scaleNotes(root, scale))
  const pattern = $derived(SCALES[scale].pattern)

  function play() {
    playGroups(
      [...notes, ...notes.slice(0, -1).reverse()].map((n) => [n]),
      {
        gap: 0.28,
        length: 0.26
      }
    )
  }
</script>

<div id="scale-explorer" class={panel}>
  <div class="flex flex-wrap items-center gap-3">
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      Root
      <select id="scale-root" class={select} bind:value={root}>
        {#each NOTE_NAMES as name, i (name)}
          <option value={60 + i}>{name}</option>
        {/each}
      </select>
    </label>
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Scale">
      {#each SCALE_ORDER as id (id)}
        <button
          type="button"
          aria-pressed={scale === id}
          class={chip(scale === id)}
          onclick={() => (scale = id)}>{SCALES[id].label}</button
        >
      {/each}
    </div>
    <button id="play-scale" type="button" class={button} onclick={play}>
      <Play class="size-4" /> Play scale
    </button>
  </div>
  <ol class="flex flex-wrap items-center gap-1 text-sm" aria-label="Notes and steps">
    {#each notes as note, i (i)}
      <li class="rounded bg-zinc-800 px-2 py-0.5 font-semibold text-amber-200">
        {noteName(note, false)}
      </li>
      {#if pattern[i] !== undefined}
        <li class="text-xs text-zinc-500">
          {pattern[i] === 1 ? 'half' : pattern[i] === 2 ? 'whole' : `${pattern[i]} half`}
        </li>
      {/if}
    {/each}
  </ol>
  <Keyboard id="scale-keyboard" low={60} high={84} marked={notes} names="marked" />
</div>
