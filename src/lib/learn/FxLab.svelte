<script lang="ts">
  import { Play, Square } from '@lucide/svelte'
  import { onMount } from 'svelte'

  import type { SynthParams } from '../types.js'

  import { backingAt, chordAt, hookAt, STEPS_PER_BAR } from './arrange.js'
  import { createSequencer, type SeqNote, type Sequencer, SOUNDS } from './sound.js'
  import { chip, panel } from './ui.js'

  // A melody on a loop through the sound's own effects: move the sliders (or
  // pick a starting point) while it plays. The drums stay dry, for comparison.
  type Fx = Pick<
    SynthParams,
    | 'drive'
    | 'fx_chorus_mix'
    | 'fx_crush'
    | 'fx_delay_feedback'
    | 'fx_delay_mix'
    | 'fx_reverb_mix'
    | 'fx_reverb_size'
  >

  const DRY: Fx = {
    drive: 0,
    fx_chorus_mix: 0,
    fx_crush: 0,
    fx_delay_feedback: 0.35,
    fx_delay_mix: 0,
    fx_reverb_mix: 0,
    fx_reverb_size: 2
  }
  const STARTS: [string, Partial<Fx>][] = [
    ['Dry', {}],
    ['Big hall', { fx_reverb_mix: 0.55, fx_reverb_size: 5 }],
    ['Echoes', { fx_delay_feedback: 0.55, fx_delay_mix: 0.45, fx_reverb_mix: 0.15 }],
    ['Dreamy', { fx_chorus_mix: 0.6, fx_delay_mix: 0.25, fx_reverb_mix: 0.4, fx_reverb_size: 4 }],
    ['Gritty', { drive: 0.6 }],
    ['Retro game', { fx_crush: 0.6 }]
  ]
  const SLIDERS: { key: keyof Fx; label: string; max: number; min: number }[] = [
    { key: 'fx_reverb_mix', label: 'Reverb', max: 1, min: 0 },
    { key: 'fx_reverb_size', label: 'Room size', max: 6, min: 0.3 },
    { key: 'fx_delay_mix', label: 'Echo', max: 1, min: 0 },
    { key: 'fx_delay_feedback', label: 'Echo repeats', max: 0.9, min: 0 },
    { key: 'fx_chorus_mix', label: 'Chorus', max: 1, min: 0 },
    { key: 'drive', label: 'Drive', max: 1, min: 0 },
    { key: 'fx_crush', label: 'Bitcrusher', max: 1, min: 0 }
  ]

  let fx: Fx = $state({ ...DRY })
  let start = $state('Dry')
  let drums = $state(true)
  let playing = $state(false)
  let sequencer: null | Sequencer = null

  function notesAt(step: number): SeqNote[] {
    const bar = Math.floor(step / STEPS_PER_BAR)
    const s = step % STEPS_PER_BAR
    const lead = hookAt(bar, s).map((h): SeqNote => ({
      ...h,
      channel: 'fx',
      sound: { ...SOUNDS.lead, ...fx }
    }))
    const beat = drums
      ? backingAt('drums', s, chordAt(bar)).map((h): SeqNote => ({
          ...h,
          channel: 'drums',
          sound: SOUNDS[h.drum ?? 'hat']
        }))
      : []
    return [...lead, ...beat]
  }

  function toggle() {
    if (playing) {
      sequencer?.stop()
      playing = false
      return
    }
    sequencer ??= createSequencer({ bpm: () => 100, length: () => STEPS_PER_BAR * 2, notesAt })
    sequencer.start()
    playing = true
  }

  const show = (key: keyof Fx, value: number) =>
    key === 'fx_reverb_size' ? `${value.toFixed(1)} s` : `${Math.round(value * 100)}%`

  onMount(() => () => sequencer?.stop())
</script>

<div id="fx-lab" class={panel}>
  <div class="flex flex-wrap items-center gap-3">
    <button
      id="fx-play"
      type="button"
      class="flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-amber-300 active:scale-95"
      onclick={toggle}
      aria-pressed={playing}
    >
      {#if playing}<Square class="size-4" /> Stop{:else}<Play class="size-4" /> Play the loop{/if}
    </button>
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" bind:checked={drums} class="accent-amber-400" /> Drums
    </label>
  </div>
  <div class="flex flex-wrap gap-1.5" role="group" aria-label="Starting points">
    {#each STARTS as [name, settings] (name)}
      <button
        type="button"
        aria-pressed={start === name}
        class={chip(start === name)}
        onclick={() => {
          start = name
          fx = { ...DRY, ...settings }
        }}>{name}</button
      >
    {/each}
  </div>
  <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
    {#each SLIDERS as { key, label, max, min } (key)}
      <label class="space-y-1 text-sm text-zinc-300">
        <span class="flex justify-between"
          >{label} <span class="text-zinc-500">{show(key, fx[key])}</span></span
        >
        <input
          id={`fx-${key}`}
          type="range"
          {min}
          {max}
          step="0.01"
          bind:value={fx[key]}
          oninput={() => (start = '')}
          class="w-full accent-amber-400"
        />
      </label>
    {/each}
  </div>
</div>
