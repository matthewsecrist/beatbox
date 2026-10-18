<script lang="ts">
  import { Check, Lightbulb, Play, Square } from '@lucide/svelte'
  import { onMount } from 'svelte'

  import {
    backingAt,
    chordAt,
    hookAt,
    type Part,
    SECTIONS,
    type SketchSection,
    sketchTips,
    STEPS_PER_BAR
  } from './arrange.js'
  import { createSequencer, type SeqNote, type Sequencer, SOUNDS } from './sound.js'
  import { button, panel } from './ui.js'

  // A whole song in miniature: switch each part on or off in each section, play
  // it from the top, and get tips on its shape. Each section is two bars here
  // (in a real song, usually eight).
  const PARTS: [Part, string][] = [
    ['melody', 'Melody'],
    ['chords', 'Chords'],
    ['bass', 'Bass'],
    ['drums', 'Drums']
  ]
  const BARS = 2
  const GOOD: Part[][] = [
    ['chords'],
    ['chords', 'bass', 'drums'],
    ['melody', 'chords', 'bass', 'drums'],
    ['melody', 'chords'],
    ['melody', 'chords', 'bass', 'drums'],
    ['chords']
  ]

  let sketch: SketchSection[] = $state(
    SECTIONS.map((name) => ({ name, parts: ['chords', 'bass', 'drums'] }))
  )
  let playing = $state(false)
  let current = $state(-1)
  let tips: null | string[] = $state(null)
  let sequencer: null | Sequencer = null

  function flip(section: SketchSection, part: Part) {
    section.parts = section.parts.includes(part)
      ? section.parts.filter((p) => p !== part)
      : [...section.parts, part]
    tips = null
  }

  function notesAt(step: number): SeqNote[] {
    const bar = Math.floor(step / STEPS_PER_BAR)
    const section = sketch[Math.floor(bar / BARS)]
    const s = step % STEPS_PER_BAR
    if (!section) return []
    const notes: SeqNote[] = []
    for (const part of section.parts) {
      const hits = part === 'melody' ? hookAt(bar, s) : backingAt(part, s, chordAt(bar))
      for (const h of hits) {
        const sound =
          part === 'drums'
            ? SOUNDS[h.drum ?? 'hat']
            : part === 'melody'
              ? SOUNDS.lead
              : SOUNDS[part]
        notes.push({ ...h, channel: part, sound, velocity: part === 'chords' ? 0.5 : 0.8 })
      }
    }
    return notes
  }

  function toggle() {
    if (playing) {
      sequencer?.stop()
      return
    }
    sequencer ??= createSequencer({
      bpm: () => 110,
      length: () => sketch.length * BARS * STEPS_PER_BAR,
      loop: false,
      notesAt,
      onEnd: () => (playing = false),
      onStep: (step) => {
        current = step < 0 ? -1 : Math.floor(step / (BARS * STEPS_PER_BAR))
        if (step < 0) playing = false
      }
    })
    sequencer.start()
    playing = true
  }

  onMount(() => () => sequencer?.stop())
</script>

<div id="song-sketch" class={panel}>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[32rem] table-fixed border-separate border-spacing-1">
      <thead>
        <tr>
          <th class="w-16"></th>
          {#each sketch as section, i (i)}
            <th
              class={[
                'rounded px-1 py-1 text-center text-xs font-semibold',
                current === i ? 'bg-amber-400 text-zinc-900' : 'text-zinc-300'
              ]}
            >
              {section.name}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each PARTS as [part, label] (part)}
          <tr>
            <th class="pr-1 text-left text-xs font-medium text-zinc-400">{label}</th>
            {#each sketch as section, i (i)}
              <td>
                <button
                  type="button"
                  aria-label={`${label} in ${section.name} ${i + 1}`}
                  aria-pressed={section.parts.includes(part)}
                  onclick={() => flip(section, part)}
                  class={[
                    'block h-8 w-full rounded transition active:scale-95',
                    section.parts.includes(part) ? 'bg-amber-400' : 'bg-zinc-800 hover:bg-zinc-700'
                  ]}
                ></button>
              </td>
            {/each}
          </tr>
        {/each}
        <tr>
          <th class="pr-1 text-left text-xs font-medium text-zinc-500">Energy</th>
          {#each sketch as section, i (i)}
            <td class="h-12 align-bottom">
              <div
                class="mx-auto w-3/4 rounded-t bg-gradient-to-t from-amber-600 to-amber-300 transition-all"
                style:height={`${(section.parts.length / PARTS.length) * 100}%`}
              ></div>
            </td>
          {/each}
        </tr>
      </tbody>
    </table>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <button id="sketch-play" type="button" class={button} onclick={toggle} aria-pressed={playing}>
      {#if playing}<Square class="size-4" /> Stop{:else}<Play class="size-4" /> Play my song{/if}
    </button>
    <button
      id="sketch-check"
      type="button"
      class="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
      onclick={() => (tips = sketchTips(sketch))}
    >
      <Check class="size-4" /> Check my song
    </button>
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      onclick={() => {
        sketch = SECTIONS.map((name, i) => ({ name, parts: [...(GOOD[i] ?? [])] }))
        tips = null
      }}
    >
      <Lightbulb class="size-4" /> Show me
    </button>
  </div>
  {#if tips}
    <div role="status" class="space-y-1 text-sm">
      {#if tips.length === 0}
        <p class="font-medium text-emerald-300">
          Great shape! It starts small, builds to a big chorus, drops back down and comes back even
          bigger. That’s how hits keep you hooked.
        </p>
      {:else}
        {#each tips as tip (tip)}
          <p class="text-zinc-300">• {tip}</p>
        {/each}
      {/if}
    </div>
  {/if}
</div>
