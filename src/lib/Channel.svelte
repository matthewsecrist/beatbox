<script lang="ts">
  import type { Instrument } from './effects.js'
  import type { SongStore } from './song.svelte.js'

  import { panLabel } from './effects.js'
  import { help } from './help.js'
  import Info from './Info.svelte'

  // An instrument's channel on the way into the song's effects (its Mix tab): where
  // it sits between the speakers, and a 3-band EQ. Saved with the song's effects
  // settings, next to the instrument's sends; it covers the whole instrument (for
  // the synth, the keyboard and every loop pad).
  let { instrument, store }: { instrument: Instrument; store: SongStore } = $props()

  const settings = $derived(store.effects)
  const fmtDb = (v: number) => (v === 0 ? 'flat' : (v > 0 ? '+' : '') + v.toFixed(1) + ' dB')
  const panel = 'space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4'
  const BANDS = [
    ['low', 'EQ low'],
    ['mid', 'EQ mid'],
    ['high', 'EQ high']
  ] as const
</script>

<!-- The ⓘ for a setting or panel. -->
{#snippet info(key: string, label: string)}
  {@const text = help(key)}
  {#if text}<Info {label} {text} />{/if}
{/snippet}

{#snippet heading(name: string, title: string)}
  <h3 class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
    {title}{@render info('panel_' + name, title)}
  </h3>
{/snippet}

<section id={instrument + '-mix'} class={panel}>
  {@render heading('mix', 'Mix')}
  <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
    <label class="block space-y-1" for={`mix-${instrument}_pan`}>
      <span
        class="flex items-baseline justify-between text-xs uppercase tracking-wider text-zinc-400"
      >
        <span class="flex items-center gap-1">Pan{@render info(`${instrument}_pan`, 'Pan')}</span>
        <span class="font-mono text-amber-300 tabular-nums normal-case"
          >{panLabel(settings[`${instrument}_pan`])}</span
        >
      </span>
      <input
        id={`mix-${instrument}_pan`}
        type="range"
        min="-1"
        max="1"
        step="0.05"
        value={settings[`${instrument}_pan`]}
        disabled={store.readOnly}
        oninput={(e) => store.setEffects({ [`${instrument}_pan`]: Number(e.currentTarget.value) })}
        ondblclick={() => store.setEffects({ [`${instrument}_pan`]: 0 })}
        title="Double-click to centre"
        class="w-full cursor-pointer accent-amber-400 disabled:cursor-default"
      />
    </label>
    {#each BANDS as [band, label] (band)}
      {@const key = `${instrument}_eq_${band}` as const}
      <label class="block space-y-1" for={'mix-' + key}>
        <span
          class="flex items-baseline justify-between text-xs uppercase tracking-wider text-zinc-400"
        >
          <span class="flex items-center gap-1">{label}{@render info(key, label)}</span>
          <span class="font-mono text-amber-300 tabular-nums normal-case"
            >{fmtDb(settings[key])}</span
          >
        </span>
        <input
          id={'mix-' + key}
          type="range"
          min="-12"
          max="12"
          step="0.5"
          value={settings[key]}
          disabled={store.readOnly}
          oninput={(e) => store.setEffects({ [key]: Number(e.currentTarget.value) })}
          ondblclick={() => store.setEffects({ [key]: 0 })}
          title="Double-click to flatten"
          class="w-full cursor-pointer accent-amber-400 disabled:cursor-default"
        />
      </label>
    {/each}
  </div>
</section>
