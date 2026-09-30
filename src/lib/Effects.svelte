<script lang="ts">
  import type { Instrument } from './effects.js'
  import type { SongStore } from './song.svelte.js'
  import type { DelayTime, Effects } from './types.js'

  import { masterFilterHz } from './effects.js'
  import { help } from './help.js'
  import Info from './Info.svelte'

  // One part of the song's effects: the shared delay and reverb, the sidechain
  // and the master stage (`master`), or how much of one instrument goes to them
  // (its sends). Settings live in the song store (and its undo history); Workspace
  // keeps the effects bus in step.
  let { part, store }: { part: 'master' | Instrument; store: SongStore } = $props()

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
  const fmtHz = (hz: number) =>
    hz >= 1000 ? (hz / 1000).toFixed(1) + ' kHz' : Math.round(hz) + ' Hz'
  // The DJ filter: which side and where its cutoff is.
  const fmtFilter = (v: number) =>
    v === 0 ? 'off' : `${v < 0 ? 'Low-pass' : 'High-pass'} ${fmtHz(masterFilterHz(v))}`
  const panel = 'space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4'
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
      disabled={store.readOnly}
      oninput={(e) => store.setEffects({ [key]: Number(e.currentTarget.value) })}
      class="w-full cursor-pointer accent-amber-400 disabled:cursor-default"
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

<!-- A two-way switch for an on/off setting; `labels` name its off and on sides. -->
{#snippet toggle(key: 'comp_on' | 'delay_pingpong', label: string, labels: [string, string])}
  <div class="space-y-1">
    <span class="flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-400"
      >{label}{@render info(key, label)}</span
    >
    <div
      id={'fx-' + key}
      class="grid grid-cols-2 gap-1 rounded-lg bg-zinc-950/60 p-1"
      role="group"
      aria-label={label}
    >
      {#each [false, true] as on (on)}
        <button
          type="button"
          aria-pressed={settings[key] === on}
          disabled={store.readOnly}
          onclick={() => store.setEffects({ [key]: on })}
          class={[
            'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:pointer-events-none',
            settings[key] === on
              ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
          ]}
        >
          {labels[on ? 1 : 0]}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

<!-- A note-value menu (at the tempo playing), for the delay time and the duck's release. -->
{#snippet noteSelect(key: 'delay_time' | 'duck_release', label: string)}
  <label class="block space-y-1" for={'fx-' + key}>
    <span class="flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-400"
      >{label}{@render info(key)}</span
    >
    <select
      id={'fx-' + key}
      value={settings[key]}
      disabled={store.readOnly}
      onchange={(e) => store.setEffects({ [key]: e.currentTarget.value as DelayTime })}
      class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-amber-400/60 focus:border-amber-400 focus:outline-none disabled:cursor-default disabled:hover:border-zinc-700"
    >
      {#each DELAY_TIMES as [value, text] (value)}
        <option {value}>{text}</option>
      {/each}
    </select>
  </label>
{/snippet}

{#if part === 'master'}
  <div id="effects" class="grid gap-4 sm:grid-cols-2">
    <div class={panel}>
      {@render heading('delay', 'Delay')}
      {@render noteSelect('delay_time', 'Time')}
      {@render toggle('delay_pingpong', 'Bounce', ['Straight', 'Ping-pong'])}
      {@render slider('delay_feedback', 'Feedback', 0.9, fmtPct)}
      {@render slider('delay_mix', 'Mix', 1, fmtPct)}
    </div>
    <div class={panel}>
      {@render heading('reverb', 'Reverb')}
      {@render slider('reverb_size', 'Size', 6, fmtSec, 0.3, 0.1)}
      {@render slider('reverb_mix', 'Mix', 1, fmtPct)}
    </div>
    <div id="fx-duck" class={panel}>
      {@render heading('duck', 'Sidechain')}
      {@render slider('duck_amount', 'Amount', 1, fmtSend)}
      {@render noteSelect('duck_release', 'Release')}
    </div>
    <div id="fx-master" class={panel}>
      {@render heading('master', 'Master')}
      {@render toggle('comp_on', 'Compressor', ['Off', 'On'])}
      {@render slider('comp_amount', 'Amount', 1, fmtPct)}
      {@render slider('master_filter', 'Filter', 1, fmtFilter, -1)}
    </div>
  </div>
{:else}
  <div id={'sends-' + part} class={[panel, 'max-w-md']}>
    {@render heading('sends', 'Sends')}
    {@render slider(`${part}_delay`, 'To delay', 1, fmtSend)}
    {@render slider(`${part}_reverb`, 'To reverb', 1, fmtSend)}
  </div>
{/if}
