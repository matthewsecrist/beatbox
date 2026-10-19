<script lang="ts">
  import { Flame } from '@lucide/svelte'

  import { type Clef, randomNatural, spell } from './notation.js'
  import { playGroups } from './sound.js'
  import Staff from './Staff.svelte'
  import { chip, panel } from './ui.js'

  // Name that note: a note appears on the staff and you pick its letter. A
  // streak counts the right answers in a row.
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

  let clef: Clef = $state('treble')
  let midi = $state(67)
  let streak = $state(0)
  let best = $state(0)
  let result: '' | 'no' | 'yes' = $state('')
  let wrong: null | string = $state(null)

  const letter = $derived(spell(midi).letter)

  function guess(choice: string) {
    if (result === 'yes') return
    playGroups([[midi]], { length: 0.5 })
    if (choice === letter) {
      result = 'yes'
      streak++
      best = Math.max(best, streak)
      setTimeout(next, 700)
    } else {
      result = 'no'
      wrong = choice
      streak = 0
    }
  }

  function next() {
    let fresh = midi
    while (fresh === midi) fresh = randomNatural(clef)
    midi = fresh
    result = ''
    wrong = null
  }
</script>

<div id="note-game" class={panel}>
  <div class="flex flex-wrap items-center gap-1.5">
    <div class="mr-auto flex gap-1.5" role="group" aria-label="Clef">
      {#each [['treble', 'Treble'], ['bass', 'Bass']] as const as [id, label] (id)}
        <button
          type="button"
          aria-pressed={clef === id}
          class={chip(clef === id)}
          onclick={() => {
            clef = id
            streak = 0
            next()
          }}>{label}</button
        >
      {/each}
    </div>
    <span class="flex items-center gap-1 text-sm text-zinc-300" title="Right in a row">
      <Flame class="size-4 text-amber-400" /> Streak {streak}
      <span class="text-zinc-500">· best {best}</span>
    </span>
  </div>
  <div class="mx-auto w-40">
    <Staff id="game-staff" {clef} notes={[{ beats: 4, midi }]} />
  </div>
  <div class="grid grid-cols-7 gap-1.5" role="group" aria-label="Note name">
    {#each LETTERS as l (l)}
      <button
        type="button"
        data-letter={l}
        onclick={() => guess(l)}
        class={[
          'rounded-lg border py-2 text-lg font-bold transition active:scale-95',
          result === 'yes' && l === letter
            ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200'
            : wrong === l
              ? 'border-red-400 bg-red-400/10 text-red-200'
              : 'border-zinc-700 text-zinc-100 hover:border-amber-400/60 hover:bg-zinc-800'
        ]}>{l}</button
      >
    {/each}
  </div>
  <p class="min-h-5 text-sm" role="status">
    {#if result === 'yes'}
      <span class="font-medium text-emerald-300">Yes, {letter}! Here comes the next one…</span>
    {:else if result === 'no'}
      <span class="text-zinc-300"
        >Not quite. Count up or down from a note you know and try again.</span
      >
    {/if}
  </p>
</div>
