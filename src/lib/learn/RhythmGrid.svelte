<script lang="ts">
  import { Check, Eraser, Lightbulb, Play, Square } from '@lucide/svelte'
  import { onMount } from 'svelte'

  import type { TrackId } from '../types.js'

  import { createDrums, type Drums, STEPS } from '../drums/engine.js'
  import { STEP } from '../song.svelte.js'
  import { transport } from '../transport.js'
  import { type Beat, matchesBeat } from './theory.js'
  import { button, panel } from './ui.js'

  // A one-bar drum grid with kick, snare and hi-hat: tap steps on and off, play
  // it at any tempo, and check it against the beat the lesson asks for (`target`).
  let { goal, id, target }: { goal: string; id: string; target: Beat } = $props()

  const ROWS: { id: TrackId; label: string }[] = [
    { id: 'chat', label: 'Hi-hat' },
    { id: 'snare', label: 'Snare' },
    { id: 'kick', label: 'Kick' }
  ]
  const empty = () => Object.fromEntries(ROWS.map((r) => [r.id, Array<boolean>(STEPS).fill(false)]))

  let grid: Record<string, boolean[]> = $state(empty())
  let bpm = $state(100)
  let playing = $state(false)
  let current = $state(-1)
  let result: '' | 'no' | 'yes' = $state('')
  let drums: Drums | null = null

  const pattern = () => ({
    steps: Object.fromEntries(
      ROWS.map((r) => [r.id, (grid[r.id] ?? []).map((on) => ({ ...STEP, on }))])
    )
  })

  function play() {
    if (playing) {
      drums?.stop()
      return
    }
    drums ??= createDrums({
      id: `learn-${id}`,
      onStep: (count) => (current = count < 0 ? -1 : count % STEPS),
      onStop: () => {
        playing = false
        current = -1
      }
    })
    transport.setBpm(bpm)
    drums.start(pattern)
    playing = true
  }

  function show() {
    grid = Object.fromEntries(
      ROWS.map((r) => [r.id, Array.from({ length: STEPS }, (_, i) => !!target[r.id]?.includes(i))])
    )
    result = ''
  }

  function toggle(row: string, step: number) {
    const cells = grid[row]
    if (!cells) return
    cells[step] = !cells[step]
    result = ''
    // Hear it straight away when the beat isn't running.
    if (cells[step] && !playing) drums?.trigger(row as TrackId)
  }

  onMount(() => () => drums?.close())
</script>

<div {id} class={panel}>
  <p class="text-sm text-zinc-300">
    <span class="font-semibold text-amber-200">Goal:</span>
    {goal}
  </p>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[34rem] table-fixed border-separate border-spacing-1">
      <thead>
        <tr>
          <th class="w-16"></th>
          {#each { length: STEPS }, i (i)}
            <th
              class={[
                'text-center text-[10px] font-medium',
                i % 4 === 0 ? 'text-amber-300' : 'text-zinc-600'
              ]}
            >
              {i % 4 === 0 ? i / 4 + 1 : i % 4 === 2 ? '&' : '·'}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each ROWS as row (row.id)}
          <tr>
            <th class="pr-1 text-left text-xs font-medium text-zinc-400">{row.label}</th>
            {#each grid[row.id] ?? [] as on, i (i)}
              <td>
                <button
                  type="button"
                  aria-label={`${row.label}, step ${i + 1}`}
                  aria-pressed={on}
                  data-step={i}
                  onclick={() => toggle(row.id, i)}
                  class={[
                    'block h-8 w-full rounded transition active:scale-90',
                    on
                      ? 'bg-amber-400'
                      : i % 4 === 0
                        ? 'bg-zinc-700 hover:bg-zinc-600'
                        : 'bg-zinc-800 hover:bg-zinc-700',
                    current === i && 'ring-2 ring-zinc-100'
                  ]}
                ></button>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <button type="button" class={button} onclick={play} aria-pressed={playing}>
      {#if playing}<Square class="size-4" /> Stop{:else}<Play class="size-4" /> Play{/if}
    </button>
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      Tempo
      <input
        type="range"
        min="60"
        max="180"
        bind:value={bpm}
        oninput={() => playing && transport.setBpm(bpm)}
        class="w-28 accent-amber-400"
      />
      <span class="w-16 text-zinc-500">{bpm} BPM</span>
    </label>
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
      onclick={() => {
        grid = empty()
        result = ''
      }}
    >
      <Eraser class="size-4" /> Clear
    </button>
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
      onclick={() => (result = matchesBeat(grid, target) ? 'yes' : 'no')}
    >
      <Check class="size-4" /> Check my beat
    </button>
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      onclick={show}
    >
      <Lightbulb class="size-4" /> Show me
    </button>
  </div>
  {#if result}
    <p
      role="status"
      class={['text-sm font-medium', result === 'yes' ? 'text-emerald-300' : 'text-zinc-300']}
    >
      {result === 'yes'
        ? 'Nailed it! Press Play and nod along.'
        : 'Not quite yet. Look at the numbers along the top: each one is a beat. Keep going!'}
    </p>
  {/if}
</div>
