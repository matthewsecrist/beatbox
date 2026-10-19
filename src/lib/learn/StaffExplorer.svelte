<script lang="ts">
  import Keyboard from './Keyboard.svelte'
  import { type Clef, type StaffNote, staffPosition, writtenName } from './notation.js'
  import Staff from './Staff.svelte'
  import { chip, panel } from './ui.js'

  // Press keys and watch where each note lands on the staff: the last eight
  // pressed, as quarter notes, with their names underneath.
  let clef: Clef = $state('treble')
  let played: number[] = $state([])

  const notes = $derived(played.map((midi): StaffNote => ({ beats: 1, midi })))
  const last = $derived(played.at(-1))

  function pick(next: Clef) {
    clef = next
    played = []
  }

  function where(midi: number): string {
    const p = staffPosition(midi, clef)
    if (p < -1 || p > 9) return 'on a ledger line'
    if (p === -1) return 'just below the staff'
    if (p === 9) return 'just above the staff'
    const from = ' (counting from the bottom)'
    return p % 2 === 0 ? `on line ${p / 2 + 1}${from}` : `in space ${(p + 1) / 2}${from}`
  }
</script>

<div id="staff-explorer" class={panel}>
  <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Clef">
    <button
      type="button"
      aria-pressed={clef === 'treble'}
      class={chip(clef === 'treble')}
      onclick={() => pick('treble')}>Treble clef</button
    >
    <button
      type="button"
      aria-pressed={clef === 'bass'}
      class={chip(clef === 'bass')}
      onclick={() => pick('bass')}>Bass clef</button
    >
  </div>
  <Staff id="explorer-staff" {clef} {notes} labels="names" />
  <p class="min-h-5 text-sm text-zinc-300" aria-live="polite">
    {#if last !== undefined}
      <span class="font-semibold text-amber-200">{writtenName(last)}</span> sits {where(last)}.
    {:else}
      Press some keys to see them on the staff.
    {/if}
  </p>
  <Keyboard
    id="staff-keyboard"
    low={clef === 'treble' ? 60 : 36}
    high={clef === 'treble' ? 84 : 60}
    onpress={(midi: number) => (played = [...played, midi].slice(-8))}
  />
</div>
