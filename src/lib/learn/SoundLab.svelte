<script lang="ts">
  import type { SynthParams, Wave } from '../types.js'

  import Keyboard from './Keyboard.svelte'
  import { playGroups } from './sound.js'
  import { chip, panel } from './ui.js'

  // One oscillator through a low-pass filter and an envelope: pick a wave, set
  // the cutoff, attack and release, and hold a key or play the riff to hear them.
  const WAVES: [Wave, string][] = [
    ['sine', 'Sine'],
    ['triangle', 'Triangle'],
    ['square', 'Square'],
    ['sawtooth', 'Sawtooth']
  ]
  const RIFF = [45, 45, 57, 45, 52, 45, 55, 57]

  let wave: Wave = $state('sawtooth')
  let cutoff = $state(4000)
  let attack = $state(0.01)
  let release = $state(0.3)

  const sound = $derived<Partial<SynthParams>>({
    attack,
    filter_cutoff: cutoff,
    filter_resonance: 2,
    osc1_wave: wave,
    osc2_level: 0,
    release,
    sustain: 0.8
  })

  const riff = () =>
    playGroups(
      RIFF.map((n) => [n]),
      { gap: 0.25, length: 0.2, sound }
    )
  const note = (midi: number) => playGroups([[midi]], { length: 0.6, sound })
</script>

<div id="sound-lab" class={panel}>
  <div class="flex flex-wrap gap-1.5" role="group" aria-label="Waveform">
    {#each WAVES as [id, label] (id)}
      <button
        type="button"
        aria-pressed={wave === id}
        class={chip(wave === id)}
        onclick={() => {
          wave = id
          note(57)
        }}>{label}</button
      >
    {/each}
  </div>
  <div class="grid gap-3 sm:grid-cols-3">
    <label class="space-y-1 text-sm text-zinc-300">
      <span class="flex justify-between">Cutoff <span class="text-zinc-500">{cutoff} Hz</span></span
      >
      <input
        id="lab-cutoff"
        type="range"
        min="100"
        max="10000"
        step="50"
        bind:value={cutoff}
        class="w-full accent-amber-400"
      />
    </label>
    <label class="space-y-1 text-sm text-zinc-300">
      <span class="flex justify-between"
        >Attack <span class="text-zinc-500">{attack.toFixed(2)} s</span></span
      >
      <input
        id="lab-attack"
        type="range"
        min="0.005"
        max="1.5"
        step="0.005"
        bind:value={attack}
        class="w-full accent-amber-400"
      />
    </label>
    <label class="space-y-1 text-sm text-zinc-300">
      <span class="flex justify-between"
        >Release <span class="text-zinc-500">{release.toFixed(2)} s</span></span
      >
      <input
        id="lab-release"
        type="range"
        min="0.02"
        max="2"
        step="0.01"
        bind:value={release}
        class="w-full accent-amber-400"
      />
    </label>
  </div>
  <button
    id="play-riff"
    type="button"
    class="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-amber-300 active:scale-95"
    onclick={riff}>Play a bass riff</button
  >
  <Keyboard id="lab-keyboard" low={48} high={71} names="marked" {sound} />
</div>
