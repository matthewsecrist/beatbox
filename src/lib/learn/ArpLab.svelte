<script lang="ts">
  import { Play, Square } from '@lucide/svelte'
  import { onMount } from 'svelte'

  import type { ArpMode, ArpRate, ChordShape } from '../types.js'

  import { ARP_RATES, chordNotes } from '../synth/arp.js'
  import { arpNote, chordAt, PROGRESSION } from './arrange.js'
  import Keyboard from './Keyboard.svelte'
  import { createSequencer, type SeqNote, type Sequencer, SOUNDS } from './sound.js'
  import { NOTE_NAMES } from './theory.js'
  import { button, chip, panel } from './ui.js'

  // The keyboard bar's Chord and Arp, live: pick a key and a chord shape (or let
  // it run through C, G, Am, F), then an arp pattern and rate, and change any of
  // them while it plays.
  const SHAPES: [ChordShape, string][] = [
    ['off', 'Off'],
    ['maj', 'Major'],
    ['min', 'Minor'],
    ['7', '7th'],
    ['sus2', 'Sus2'],
    ['sus4', 'Sus4'],
    ['5', 'Power']
  ]
  const MODES: [ArpMode, string][] = [
    ['off', 'Off'],
    ['up', 'Up'],
    ['down', 'Down'],
    ['updown', 'Up-Down'],
    ['random', 'Random']
  ]
  const RATES: ArpRate[] = ['1/4', '1/8', '1/8t', '1/16']
  const ROOTS = [60, 62, 64, 65, 67, 69, 71]

  let root = $state(60)
  let shape: ChordShape = $state('maj')
  let mode: ArpMode = $state('up')
  let rate: ArpRate = $state('1/16')
  let bpm = $state(110)
  let progression = $state(false)
  let playing = $state(false)
  let lit: number[] = $state([])
  let sequencer: null | Sequencer = null

  // The notes held on `beat`: the chosen key's chord, or the progression's.
  function heldAt(beat: number): number[] {
    if (!progression) return chordNotes(root, shape)
    const chord = chordAt(Math.floor(beat / 4 + 1e-6))
    return chordNotes(chord.root, shape === 'off' ? chord.shape : shape)
  }

  function notesAt(_: number, beat: number): SeqNote[] {
    const held = heldAt(beat)
    const note = (midi: number, length: number): SeqNote => ({
      channel: 'arp',
      length,
      midi,
      sound: SOUNDS.lead
    })
    let notes: SeqNote[]
    if (mode === 'off') {
      // No arp: the chord on every beat.
      notes = beat % 1 === 0 ? held.map((m) => note(m, 0.9)) : []
    } else {
      const midi = arpNote(held, mode, Math.round(beat / ARP_RATES[rate]))
      notes = midi === undefined ? [] : [note(midi, 0.5)]
    }
    if (notes.length) setTimeout(() => (lit = notes.map((n) => n.midi)), 0)
    return notes
  }

  function toggle() {
    if (playing) {
      sequencer?.stop()
      playing = false
      lit = []
      return
    }
    sequencer ??= createSequencer({
      bpm: () => bpm,
      notesAt,
      stepBeats: () => (mode === 'off' ? 1 : ARP_RATES[rate])
    })
    sequencer.start()
    playing = true
  }

  onMount(() => () => sequencer?.stop())
</script>

<div id="arp-lab" class={panel}>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Key">
      <span class="w-14 text-xs font-semibold text-zinc-500">Key</span>
      {#each ROOTS as r (r)}
        <button
          type="button"
          aria-pressed={!progression && root === r}
          class={chip(!progression && root === r)}
          onclick={() => {
            root = r
            progression = false
          }}>{NOTE_NAMES[r % 12]}</button
        >
      {/each}
      <button
        id="arp-progression"
        type="button"
        aria-pressed={progression}
        class={chip(progression)}
        onclick={() => (progression = !progression)}
        >{PROGRESSION.map((c) => c.name).join(' – ')}</button
      >
    </div>
    <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Chord">
      <span class="w-14 text-xs font-semibold text-zinc-500">Chord</span>
      {#each SHAPES as [id, label] (id)}
        <button
          type="button"
          aria-pressed={shape === id}
          class={chip(shape === id)}
          onclick={() => (shape = id)}>{label}</button
        >
      {/each}
    </div>
    <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Arp">
      <span class="w-14 text-xs font-semibold text-zinc-500">Arp</span>
      {#each MODES as [id, label] (id)}
        <button
          type="button"
          aria-pressed={mode === id}
          class={chip(mode === id)}
          onclick={() => (mode = id)}>{label}</button
        >
      {/each}
    </div>
    <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Rate">
      <span class="w-14 text-xs font-semibold text-zinc-500">Rate</span>
      {#each RATES as r (r)}
        <button
          type="button"
          aria-pressed={rate === r}
          disabled={mode === 'off'}
          class={[chip(rate === r), 'disabled:opacity-40']}
          onclick={() => (rate = r)}>{r.toUpperCase()}</button
        >
      {/each}
    </div>
  </div>
  <div class="flex flex-wrap items-center gap-3">
    <button id="arp-play" type="button" class={button} onclick={toggle} aria-pressed={playing}>
      {#if playing}<Square class="size-4" /> Stop{:else}<Play class="size-4" /> Play{/if}
    </button>
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      Tempo
      <input type="range" min="70" max="160" bind:value={bpm} class="w-28 accent-amber-400" />
      <span class="w-16 text-zinc-500">{bpm} BPM</span>
    </label>
  </div>
  <Keyboard id="arp-keyboard" low={48} high={83} marked={lit} names="marked" />
</div>
