<script lang="ts">
  import { Play } from '@lucide/svelte'

  import Keyboard from './Keyboard.svelte'
  import { playGroups } from './sound.js'
  import { INTERVALS, MIDDLE_C, noteName } from './theory.js'
  import { button, chip, panel } from './ui.js'

  // Pick a starting note on the keyboard and an interval: both notes light up,
  // and Play sounds them one after the other, then together.
  let root = $state(MIDDLE_C)
  let steps = $state(7)

  const top = $derived(root + steps)
  const interval = $derived(INTERVALS.find((i) => i.steps === steps))

  function play() {
    playGroups([[root], [top], [root, top]], { gap: 0.6 })
  }
</script>

<div id="interval-explorer" class={panel}>
  <div class="flex flex-wrap gap-1.5" role="group" aria-label="Interval">
    {#each INTERVALS as i (i.steps)}
      <button
        type="button"
        aria-pressed={steps === i.steps}
        class={chip(steps === i.steps)}
        title={i.name}
        onclick={() => {
          steps = i.steps
          play()
        }}>{i.short}</button
      >
    {/each}
  </div>
  <div class="flex flex-wrap items-center gap-3">
    <button id="play-interval" type="button" class={button} onclick={play}>
      <Play class="size-4" /> Play
    </button>
    <p class="text-sm text-zinc-300" aria-live="polite">
      <span class="font-semibold text-amber-200">{interval?.name}</span>: {noteName(root)} up to
      {noteName(top)}, {steps} half {steps === 1 ? 'step' : 'steps'}.
    </p>
  </div>
  <Keyboard
    id="interval-keyboard"
    low={48}
    high={83}
    marked={[root, top]}
    names="marked"
    onpress={(midi: number) => (root = Math.min(midi, 83 - steps))}
  />
  <p class="text-xs text-zinc-500">Press a key to start the interval from it.</p>
</div>
