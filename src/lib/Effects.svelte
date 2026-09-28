<script lang="ts">
  import type { SongStore } from './song.svelte.js'
  import type { DelayTime, Effects } from './types.js'

  import { effects } from './effects.js'
  import { help } from './help.js'
  import Info from './Info.svelte'

  // The song's delay and reverb, and how much of each instrument goes to them.
  // Settings live in the song store (and its undo history); the shared effects
  // bus follows them, and the song tempo for the delay time.
  let { store }: { store: SongStore } = $props()

  type NumericSetting = {
    [K in keyof Effects]: Effects[K] extends number ? K : never
  }[keyof Effects]

  const settings = $derived(store.effects)

  const DELAY_TIMES: [DelayTime, string][] = [
    ['1/16', '1/16'],
    ['1/8t', '1/8T'],
    ['1/8', '1/8'],
    ['1/8d', '1/8 dotted'],
    ['1/4', '1/4'],
    ['1/4d', '1/4 dotted'],
    ['1/2', '1/2']
  ]

  const fmtPct = (v: number) => Math.round(v * 100) + '%'
  const fmtSend = (v: number) => (v === 0 ? 'off' : fmtPct(v))
  const fmtSec = (v: number) => v.toFixed(1) + ' s'

  $effect(() => effects.set($state.snapshot(settings), store.drums.bpm))
</script>

{#snippet slider(
  key: NumericSetting,
  label: string,
  max: number,
  format: (v: number) => string,
  min = 0,
  step = 0.01
)}
  <label class="block space-y-1" for={'fx-' + key}>
    <span
      class="flex items-baseline justify-between text-xs uppercase tracking-wider text-zinc-400"
    >
      <span class="flex items-center gap-1">{label}{@render info(key)}</span>
      <span class="font-mono text-amber-300 tabular-nums normal-case">{format(settings[key])}</span>
    </span>
    <input
      id={'fx-' + key}
      type="range"
      {min}
      {max}
      {step}
      value={settings[key]}
      oninput={(e) => store.setEffects({ [key]: Number(e.currentTarget.value) })}
      class="w-full cursor-pointer accent-amber-400"
    />
  </label>
{/snippet}

<!-- The ⓘ for a setting or panel. A setting's accessible name comes from its key
     ("delay_mix" -> "delay mix"), since two sliders are both labelled Mix. -->
{#snippet info(key: string, label = key.replace('_', ' '))}
  {@const text = help(key)}
  {#if text}<Info {label} {text} />{/if}
{/snippet}

{#snippet heading(name: string, title: string)}
  <h3 class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-zinc-300">
    {title}{@render info('panel_' + name, title)}
  </h3>
{/snippet}

<section
  id="effects"
  class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
>
  <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Effects</h2>
  <div class="grid gap-4 sm:grid-cols-3">
    <div class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
      {@render heading('delay', 'Delay')}
      <label class="block space-y-1" for="fx-delay_time">
        <span class="flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-400"
          >Time{@render info('delay_time')}</span
        >
        <select
          id="fx-delay_time"
          value={settings.delay_time}
          onchange={(e) => store.setEffects({ delay_time: e.currentTarget.value as DelayTime })}
          class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-amber-400/60 focus:border-amber-400 focus:outline-none"
        >
          {#each DELAY_TIMES as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>
      {@render slider('delay_feedback', 'Feedback', 0.9, fmtPct)}
      {@render slider('delay_mix', 'Mix', 1, fmtPct)}
    </div>
    <div class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
      {@render heading('reverb', 'Reverb')}
      {@render slider('reverb_size', 'Size', 6, fmtSec, 0.3, 0.1)}
      {@render slider('reverb_mix', 'Mix', 1, fmtPct)}
    </div>
    <div class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
      {@render heading('sends', 'Sends')}
      {@render slider('synth_delay', 'Synth → delay', 1, fmtSend)}
      {@render slider('synth_reverb', 'Synth → reverb', 1, fmtSend)}
      {@render slider('drums_delay', 'Drums → delay', 1, fmtSend)}
      {@render slider('drums_reverb', 'Drums → reverb', 1, fmtSend)}
    </div>
  </div>
</section>
