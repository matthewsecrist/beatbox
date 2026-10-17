<script lang="ts">
  import type { SynthParams } from '../types.js'

  import { noteDown, noteUp } from './sound.js'
  import { isBlack, noteName } from './theory.js'

  // A playable keyboard for the lessons, from `low` to `high` (MIDI, both white
  // keys). `marked` keys are lit, labelled when `names` is 'marked'; 'all' names
  // every key. Pressing a key plays it (with `sound`, or the piano) until it's let go.
  let {
    high = 83,
    id,
    low = 60,
    marked = [],
    names = 'all',
    onpress,
    sound
  }: {
    high?: number
    id: string
    low?: number
    marked?: number[]
    names?: 'all' | 'marked'
    onpress?: (midi: number) => void
    sound?: Partial<SynthParams>
  } = $props()

  let held: number[] = $state([])

  const keys = $derived(Array.from({ length: high - low + 1 }, (_, i) => low + i))
  const whites = $derived(keys.filter((k) => !isBlack(k)))
  // Each black key sits over the line after the white key below it.
  const blacks = $derived(
    keys
      .filter(isBlack)
      .map((midi) => ({ left: ((whites.indexOf(midi - 1) + 1) / whites.length) * 100, midi }))
  )
  const width = $derived(100 / whites.length)

  function press(midi: number) {
    if (held.includes(midi)) return
    held = [...held, midi]
    noteDown(midi, sound)
    onpress?.(midi)
  }

  function release(midi: number) {
    if (!held.includes(midi)) return
    held = held.filter((m) => m !== midi)
    noteUp(midi)
  }

  // A key plays from the pointer (sliding off lets go) or from Space/Enter.
  const handlers = (midi: number) => ({
    onkeydown: (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault()
        press(midi)
      }
    },
    onkeyup: () => release(midi),
    onpointerdown: (e: PointerEvent) => {
      e.preventDefault()
      press(midi)
    },
    onpointerleave: () => release(midi),
    onpointerup: () => release(midi)
  })

  const label = (midi: number) =>
    names === 'all' || marked.includes(midi) ? noteName(midi, midi % 12 === 0) : ''
</script>

<div
  {id}
  class="relative h-36 w-full touch-none select-none sm:h-44"
  role="group"
  aria-label="Keyboard"
>
  <div class="flex h-full">
    {#each whites as midi (midi)}
      <button
        type="button"
        aria-label={noteName(midi)}
        data-midi={midi}
        {...handlers(midi)}
        class={[
          'flex flex-1 items-end justify-center rounded-b-md border border-zinc-900 pb-2 text-xs font-semibold transition',
          held.includes(midi)
            ? 'bg-amber-300 text-zinc-900'
            : marked.includes(midi)
              ? 'bg-amber-100 text-amber-900'
              : 'bg-zinc-100 text-zinc-500 hover:bg-white'
        ]}
      >
        {label(midi)}
      </button>
    {/each}
  </div>
  {#each blacks as { left, midi } (midi)}
    <button
      type="button"
      aria-label={noteName(midi)}
      data-midi={midi}
      {...handlers(midi)}
      style:left={`${left - width * 0.3}%`}
      style:width={`${width * 0.6}%`}
      class={[
        'absolute top-0 flex h-[60%] items-end justify-center rounded-b-md border border-zinc-900 pb-1 text-[10px] font-semibold transition',
        held.includes(midi)
          ? 'bg-amber-400 text-zinc-900'
          : marked.includes(midi)
            ? 'bg-amber-600 text-amber-50'
            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
      ]}
    >
      <span class="max-sm:hidden">{label(midi)}</span>
    </button>
  {/each}
</div>
