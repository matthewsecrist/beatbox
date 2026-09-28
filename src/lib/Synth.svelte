<script lang="ts">
  import { ChevronDown, Pencil } from '@lucide/svelte'
  import { onMount, type Snippet, untrack } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import type { SongStore } from './song.svelte.js'
  import type { Arp } from './synth/arp.js'
  import type { Synth } from './synth/engine.js'
  import type { Player } from './synth/looper.js'
  import type {
    ArpMode,
    ArpRate,
    ChordShape,
    GlideMode,
    LfoTarget,
    LoadPresetReply,
    Loop,
    PresetSummary,
    SavePresetReply,
    Scene,
    SynthParams,
    TransportDetail,
    Wave
  } from './types.js'

  import { effects } from './effects.js'
  import { help } from './help.js'
  import Info from './Info.svelte'
  import PianoRoll from './PianoRoll.svelte'
  import { PAD_COUNT } from './song.svelte.js'
  import { chordNotes, createArp } from './synth/arp.js'
  import { createSynth, DEFAULT_PARAMS, LFO_DEPTH_MAX } from './synth/engine.js'
  import { FACTORY_PRESETS } from './synth/factory_presets.js'
  import { createPlayer, createRecorder } from './synth/looper.js'
  import { BEATS_PER_BAR, transport } from './transport.js'

  // Synth settings and loops live in the song store (and its undo history); this
  // component reads them and changes them through the store. `savePreset`/
  // `loadPreset` talk to the server. Signed out (`canSave` false), only the factory
  // presets can be loaded and nothing can be saved.
  let {
    canSave = true,
    loadPreset: fetchPreset,
    presets = [],
    savePreset: storePreset,
    store
  }: {
    canSave?: boolean
    loadPreset: (id: string) => Promise<LoadPresetReply>
    presets?: PresetSummary[]
    savePreset: (name: string, params: SynthParams) => Promise<SavePresetReply>
    store: SongStore
  } = $props()

  type NumericParam = {
    [K in keyof SynthParams]: SynthParams[K] extends number ? K : never
  }[keyof SynthParams]

  const params: SynthParams = $derived({ ...DEFAULT_PARAMS, ...store.synth })
  const performance = $derived(store.performance)
  let presetName = $state('')
  let selectedId = $state('')
  let status = $state('')
  let baseOctave = $state(4)
  // Keys down (keyboard midi -> the notes it plays, one per chord note), and how
  // many keys hold each note: a note shared by two chords sounds until both let go.
  const pressed = new SvelteMap<number, number[]>()
  const held = new SvelteMap<number, number>()
  const heldKeys = new SvelteMap<string, number>()
  let synth: null | Synth = null
  // With the arpeggiator on (`arpOn`), held notes go to it instead of the synth.
  let arp: Arp | null = null
  let arpOn = false
  let statusTimer: ReturnType<typeof setTimeout> | undefined

  // Loop pads: each slot holds a recorded loop (with the synth params it was
  // recorded with) and plays independently. The loops are in the store; `players`
  // follow them (see syncPlayers) and need the synth, so they start in onMount.
  // `playback` is the UI state of each pad.
  const playback = $state(Array.from({ length: PAD_COUNT }, () => ({ playing: false, pos: 0 })))
  const pads = $derived(
    store.loops.map((loop, slot) => ({
      filled: !!loop,
      label: loop ? barsLabel(loop) : '',
      playing: playback[slot]?.playing ?? false,
      pos: playback[slot]?.pos ?? 0
    }))
  )
  let recording = $state(-1) // slot being recorded, or -1
  let countingIn = $state(false) // recording armed, waiting for its first bar
  let recordParams: Partial<SynthParams> = {}
  const recorder = createRecorder(transport)
  let loopTimer: ReturnType<typeof setInterval> | undefined
  const players: (null | Player)[] = []
  // The loop each player was built from, to spot loops the store has replaced.
  const playerLoops: (Loop | null)[] = []

  // "2 bars"; loops saved before tempo sync (no bpm) are measured at the current tempo.
  function barsLabel(loop: Pick<Loop, 'bpm' | 'length'>): string {
    const bars = (loop.length * (loop.bpm ?? transport.bpm)) / 60 / BEATS_PER_BAR
    const n = Math.round(bars * 10) / 10
    return `${n} bar${n === 1 ? '' : 's'}`
  }

  function setPlayback(slot: number, playing: boolean, pos = 0) {
    const state = playback[slot]
    if (!state) return
    state.playing = playing
    state.pos = pos
  }

  // Brings the players in line with the store's loops: new loops get a player,
  // edited ones are swapped in (playing pads keep their place in the bar), and
  // removed ones stop. Runs after every loop change, including undo and redo.
  function syncPlayers() {
    const s = synth
    if (!s) return
    store.loops.forEach((loop, slot) => {
      const player = players[slot]
      if (loop === (playerLoops[slot] ?? null)) return
      playerLoops[slot] = loop
      if (!loop) {
        player?.stop()
        players[slot] = null
        setPlayback(slot, false)
      } else if (player) {
        player.setLoop(loop)
      } else {
        players[slot] = createPlayer(s, `pad${slot}:`, loop, transport)
      }
    })
  }

  const WAVES: Wave[] = ['sine', 'triangle', 'sawtooth', 'square']
  const LFO_TARGETS: LfoTarget[] = ['filter', 'pitch', 'amp']
  const GLIDE_MODES: [GlideMode, string][] = [
    ['legato', 'Legato'],
    ['always', 'Always']
  ]
  const CHORD_OPTIONS: [ChordShape, string][] = [
    ['off', 'Off'],
    ['maj', 'Major'],
    ['min', 'Minor'],
    ['7', '7th'],
    ['maj7', 'Major 7th'],
    ['min7', 'Minor 7th'],
    ['sus2', 'Sus2'],
    ['sus4', 'Sus4'],
    ['dim', 'Diminished'],
    ['aug', 'Augmented'],
    ['5', 'Power (5th)']
  ]
  const ARP_OPTIONS: [ArpMode, string][] = [
    ['off', 'Off'],
    ['up', 'Up'],
    ['down', 'Down'],
    ['updown', 'Up-Down'],
    ['random', 'Random']
  ]
  const RATE_OPTIONS: [ArpRate, string][] = [
    ['1/4', '1/4'],
    ['1/8', '1/8'],
    ['1/8t', '1/8T'],
    ['1/16', '1/16'],
    ['1/16t', '1/16T'],
    ['1/32', '1/32']
  ]
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const KEY_MAP = 'awsedftgyhujkolp;'

  const baseMidi = $derived(12 * (baseOctave + 1))
  const keys = $derived.by(() => {
    let white = 0
    return Array.from({ length: 25 }, (_, i) => {
      const midi = baseMidi + i
      const name = NOTE_NAMES[midi % 12] ?? ''
      const black = name.includes('#')
      const key = { black, label: name + (Math.floor(midi / 12) - 1), midi, white }
      if (!black) white++
      return key
    })
  })
  const whiteCount = 15

  function finishRecording() {
    const slot = recording
    arp?.tick() // hands the recorder any arpeggiated note that has just started
    recording = -1
    transport.metronome(null)
    const take = recorder.finish()
    // Mirror the server-side loop limits so one bad take can't block saving the song.
    if (take && (take.length > 300 || take.events.length > 4000)) {
      showStatus('Loop too long (max 5 min / 4000 notes)')
    } else if (take && synth) {
      store.setLoop({ slot, ...take, params: recordParams })
      syncPlayers()
      startPad(slot) // acquires the transport before "rec" lets go, so the grid keeps running
    }
    transport.release('rec')
  }

  // Arrangement scene: pads in the section play from its boundary beat (already
  // playing ones keep their phase); the rest stop exactly on it.
  function onScene({ detail }: CustomEvent<Scene>) {
    players.forEach((p, slot) => {
      if (!p) return
      if (detail.pads.includes(slot)) {
        p.start(detail.beat)
        setPlayback(slot, true)
      } else {
        p.stopAt(detail.beat)
      }
    })
  }

  // Song-bar Play (with no arrangement: every filled pad) / Stop (them all).
  function onTransport(e: CustomEvent<TransportDetail>) {
    players.forEach((p, slot) => {
      if (!p) return
      if (e.detail.play && !p.playing) startPad(slot)
      if (!e.detail.play && p.playing) stopPad(slot)
    })
  }

  // A key goes down: it holds its note, or the chord built on it.
  function press(midi: number) {
    if (!synth || pressed.has(midi)) return
    const notes = chordNotes(midi, performance.chord)
    pressed.set(midi, notes)
    const started = notes.filter((note) => {
      const count = held.get(note) ?? 0
      held.set(note, count + 1)
      return count === 0
    })
    sound(started, true)
  }

  // Piano roll: edits one pad's loop. `rollKey` changes when a different pad is
  // opened, which remounts the editor on it.
  let rollSlot: null | number = $state(null)
  const rollLoop = $derived(rollSlot === null ? null : (store.loops[rollSlot] ?? null))
  let rollKey = $state(0)

  function closeRoll() {
    rollSlot = null
  }

  // Opens a pad in the piano roll; an empty pad gets an empty one-bar loop to draw in.
  function editPad(slot: number) {
    if (!synth || recording === slot) return
    if (!store.loops[slot]) {
      const sound: Partial<SynthParams> = $state.snapshot(params)
      delete sound.volume
      const bpm = transport.bpm
      store.setLoop({
        bpm,
        events: [],
        length: Math.round((BEATS_PER_BAR * 60 * 1000) / bpm) / 1000,
        params: sound,
        slot
      })
    }
    rollSlot = slot
    rollKey++
  }

  // An edit from the piano roll: playing pads pick it up straight away.
  function onRollChange(loop: Loop) {
    store.setLoop(loop)
  }

  // Sounds a pitch with the edited loop's own synth settings.
  function previewNote(midi: number) {
    if (!synth || !rollLoop) return
    synth.noteOn(midi, undefined, 'roll', rollLoop.params)
    synth.noteOff('roll', synth.now() + 0.25)
  }

  function release(midi: number) {
    const notes = pressed.get(midi)
    if (!notes) return
    pressed.delete(midi)
    const stopped = notes.filter((note) => {
      const count = (held.get(note) ?? 1) - 1
      if (count > 0) held.set(note, count)
      else held.delete(note)
      return count === 0
    })
    sound(stopped, false)
  }

  // Held notes start or stop: straight on the synth (and into a recording), or
  // in and out of the arpeggiator, which records the notes it plays itself.
  function sound(notes: number[], on: boolean) {
    if (arpOn) {
      if (on) arp?.hold(notes)
      else arp?.release(notes)
      return
    }
    for (const note of notes) {
      if (on) synth?.noteOn(note)
      else synth?.noteOff(note)
      if (recording >= 0) recorder.note(note, on)
    }
  }

  function startPad(slot: number) {
    const player = players[slot]
    if (!player) return
    player.start()
    setPlayback(slot, true)
  }

  // Recording starts on a bar line: after a one-bar count-in when nothing is
  // playing, else at the next bar. The metronome clicks until it's finished.
  function startRecording(slot: number) {
    if (recording >= 0) finishRecording()
    const counting = !transport.running
    transport.acquire('rec')
    recorder.start(arpOn ? [] : [...held.keys()], counting ? BEATS_PER_BAR : transport.nextBar())
    transport.metronome(0)
    // Master volume stays a global control, so a loop doesn't pin its own level.
    const sound: Partial<SynthParams> = $state.snapshot(params)
    delete sound.volume
    recordParams = sound
    recording = slot
    countingIn = true
  }

  function tapPad(slot: number) {
    if (!synth) return
    if (recording === slot) return finishRecording()
    if (!pads[slot]?.filled) return startRecording(slot)
    if (players[slot]?.playing) stopPad(slot)
    else startPad(slot)
  }

  function toggleRollPad() {
    if (rollSlot === null) return
    if (players[rollSlot]?.playing) stopPad(rollSlot)
    else startPad(rollSlot)
  }

  const anyPadPlaying = $derived(pads.some((p) => p.playing))
  const report = (on: boolean): void => {
    window.dispatchEvent(
      new CustomEvent('beatbox:state', { detail: { playing: on, source: 'loops' } })
    )
  }
  const onReport = () => report(anyPadPlaying)
  $effect(() => report(anyPadPlaying))

  function clearPad(slot: number) {
    if (rollSlot === slot) closeRoll()
    if (recording === slot) {
      recording = -1
      transport.metronome(null)
      transport.release('rec')
    }
    store.deleteLoop(slot)
  }

  function shiftOctave(delta: number) {
    baseOctave = Math.min(6, Math.max(1, baseOctave + delta))
  }

  function showStatus(msg: string) {
    status = msg
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => (status = ''), 3000)
  }

  function stopPad(slot: number) {
    players[slot]?.stop()
    setPlayback(slot, false)
  }

  const ignored = (e: KeyboardEvent) =>
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName))

  function onBlur() {
    synth?.allNotesOff()
    arp?.releaseAll()
    pressed.clear()
    held.clear()
    heldKeys.clear()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.repeat || ignored(e)) return
    const k = e.key.toLowerCase()
    if (k === 'z') return shiftOctave(-1)
    if (k === 'x') return shiftOctave(1)
    if (k >= '1' && k <= '8') return tapPad(Number(k) - 1)
    const offset = KEY_MAP.indexOf(k)
    if (offset < 0 || heldKeys.has(k)) return
    const midi = baseMidi + offset
    heldKeys.set(k, midi)
    press(midi)
  }

  function onKeyUp(e: KeyboardEvent) {
    const k = e.key.toLowerCase()
    const midi = heldKeys.get(k)
    if (midi === undefined) return
    heldKeys.delete(k)
    release(midi)
  }

  onMount(() => {
    // Live notes and loop pads share this synth, and its effects channel.
    const created = createSynth($state.snapshot(params), undefined, () => effects.channel('synth'))
    synth = created
    const createdArp = createArp(created, transport, (midi, on, at) => {
      if (recording >= 0) recorder.note(midi, on, at)
    })
    arp = createdArp
    // The song may open with the arp on; the effect below keeps it in step after this.
    if (performance.arp !== 'off') createdArp.set(performance.arp, performance.arp_rate)
    syncPlayers()
    loopTimer = setInterval(() => {
      createdArp.tick()
      // The UI follows the players: a pad stopped by a section boundary plays on until it.
      players.forEach((p, slot) => {
        if (!p?.playing) return
        const pos = p.tick()
        setPlayback(slot, p.playing, p.playing ? pos : 0)
      })
      if (recording >= 0) countingIn = transport.beatAt(transport.now()) < recorder.startBeat
    }, 25)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('beatbox:transport', onTransport)
    window.addEventListener('beatbox:report', onReport)
    window.addEventListener('beatbox:scene', onScene)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('beatbox:transport', onTransport)
      window.removeEventListener('beatbox:report', onReport)
      window.removeEventListener('beatbox:scene', onScene)
      report(false)
      clearTimeout(statusTimer)
      clearInterval(loopTimer)
      players.forEach((p) => p?.stop())
      if (recording >= 0) {
        transport.metronome(null)
        transport.release('rec')
      }
      createdArp.releaseAll()
      created.close()
    }
  })

  // The sound follows the store: edits, presets, undo and redo.
  $effect(() => synth?.setParams($state.snapshot(params)))

  // So does the arpeggiator. Switching it on or off lets go of every held key
  // first, so no note hangs on the path it's leaving.
  $effect(() => {
    const { arp: mode, arp_rate } = performance
    untrack(() => {
      if (mode !== 'off') arp?.set(mode, arp_rate)
      if (arpOn === (mode !== 'off')) return
      for (const midi of [...pressed.keys()]) release(midi)
      arpOn = mode !== 'off'
    })
  })

  // Loops changed in the store (undo, redo): rebuild the affected players, and
  // close the piano roll if its loop is gone.
  $effect(() => {
    void store.loops
    untrack(syncPlayers)
    if (rollSlot !== null && !store.loops[rollSlot]) untrack(closeRoll)
  })

  function loadPreset(e: Event & { currentTarget: HTMLSelectElement }) {
    const id = e.currentTarget.value
    if (!id) return
    if (id.startsWith('factory:')) {
      const preset = FACTORY_PRESETS[Number(id.slice(8))]
      if (!preset) return
      store.setParams({ ...DEFAULT_PARAMS, volume: params.volume, ...preset.params })
      presetName = preset.name
      return
    }
    void fetchPreset(id).then((reply) => {
      if ('error' in reply) return showStatus(reply.error)
      store.setParams({ ...DEFAULT_PARAMS, ...reply.params })
      presetName = reply.name
    })
  }

  function savePreset() {
    void storePreset(presetName, $state.snapshot(params)).then((reply) => {
      if ('error' in reply) return showStatus(reply.error)
      selectedId = reply.id
      showStatus('Saved “' + reply.name + '”')
    })
  }

  const cutoffPos = $derived(Math.log(params.filter_cutoff / 20) / Math.log(900))
  const fmtHz = (hz: number) =>
    hz >= 1000 ? (hz / 1000).toFixed(2) + ' kHz' : Math.round(hz) + ' Hz'
  const fmtSec = (s: number) => (s < 1 ? Math.round(s * 1000) + ' ms' : s.toFixed(2) + ' s')
  const fmtGlide = (s: number) => (s === 0 ? 'off' : fmtSec(s))
  const fmtPct = (v: number) => Math.round(v * 100) + '%'
  const fmtInt = (v: number) => (v > 0 ? '+' : '') + String(v)
  const fmtCents = (v: number) => fmtInt(v) + '¢'
  const fmtNum = (v: number) => Number(v).toFixed(1)
  const fmtRate = (v: number) => Number(v).toFixed(1) + ' Hz'
  const fmtOct = (v: number) => (v === 0 ? 'off' : Number(v).toFixed(2) + ' oct')
  const fmtEnvAmount = (v: number) => (v === 0 ? 'off' : fmtInt(Number(v.toFixed(2))) + ' oct')
  const fmtVibrato = (v: number) => (v === 0 ? 'off' : '±' + Math.round(v) + '¢')
  const fmtTremolo = (v: number) => (v === 0 ? 'off' : fmtPct(v))
  // Depth slider per LFO target: octaves of cutoff, cents of pitch, share of level.
  const LFO_DEPTH_STEP: Record<LfoTarget, number> = { amp: 0.01, filter: 0.05, pitch: 1 }
  const LFO_DEPTH_FORMAT: Record<LfoTarget, (v: number) => string> = {
    amp: fmtTremolo,
    filter: fmtOct,
    pitch: fmtVibrato
  }

  const btn =
    'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40'
  const select =
    'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-amber-400/60 focus:border-amber-400 focus:outline-none disabled:pointer-events-none disabled:opacity-40'
</script>

{#snippet slider(
  key: NumericParam,
  label: string,
  min: number,
  max: number,
  step: number,
  format: (v: number) => string
)}
  <label class="block space-y-1" for={'synth-' + key}>
    <span
      class="flex items-baseline justify-between text-xs uppercase tracking-wider text-zinc-400"
    >
      <span class="flex items-center gap-1">{label}{@render info(key, label)}</span>
      <span class="font-mono text-amber-300 tabular-nums normal-case">{format(params[key])}</span>
    </span>
    <input
      id={'synth-' + key}
      type="range"
      {min}
      {max}
      {step}
      value={params[key]}
      oninput={(e) => store.setParam(key, Number(e.currentTarget.value))}
      class="w-full cursor-pointer accent-amber-400"
    />
  </label>
{/snippet}

{#snippet info(key: string, label: string)}
  {@const text = help(key)}
  {#if text}<Info {label} {text} />{/if}
{/snippet}

<!-- A caption with its ⓘ, for controls that aren't sliders (button groups). -->
{#snippet caption(key: string, label: string)}
  <span class="flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-400"
    >{label}{@render info(key, label)}</span
  >
{/snippet}

{#snippet waveSelect(key: 'osc1_wave' | 'osc2_wave')}
  {@render caption(key, 'Wave')}
  <div
    class="-mt-2 grid grid-cols-4 gap-1 rounded-lg bg-zinc-950/60 p-1"
    role="group"
    aria-label="Waveform"
  >
    {#each WAVES as wave (wave)}
      <button
        type="button"
        aria-pressed={params[key] === wave}
        onclick={() => store.setParam(key, wave)}
        class={[
          'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition',
          params[key] === wave
            ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
        ]}
      >
        {wave === 'sawtooth' ? 'saw' : wave === 'triangle' ? 'tri' : wave}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet panel(title: string, body: Snippet, name: string)}
  <section
    class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-inner shadow-black/40"
  >
    <h2
      class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-400"
    >
      {title}{@render info('panel_' + name, title)}
    </h2>
    {@render body()}
  </section>
{/snippet}

{#snippet osc(n: 1 | 2)}
  {@render waveSelect(`osc${n}_wave`)}
  {@render slider(`osc${n}_octave`, 'Octave', -2, 2, 1, fmtInt)}
  {@render slider(`osc${n}_detune`, 'Detune', -50, 50, 1, fmtCents)}
  {@render slider(`osc${n}_level`, 'Level', 0, 1, 0.01, fmtPct)}
{/snippet}

{#snippet osc1()}{@render osc(1)}{/snippet}
{#snippet osc2()}{@render osc(2)}{/snippet}

{#snippet filter()}
  <label class="block space-y-1" for="synth-filter_cutoff">
    <span
      class="flex items-baseline justify-between text-xs uppercase tracking-wider text-zinc-400"
    >
      <span class="flex items-center gap-1">Cutoff{@render info('filter_cutoff', 'Cutoff')}</span>
      <span class="font-mono text-amber-300 tabular-nums normal-case"
        >{fmtHz(params.filter_cutoff)}</span
      >
    </span>
    <input
      id="synth-filter_cutoff"
      type="range"
      min="0"
      max="1"
      step="0.001"
      value={cutoffPos}
      oninput={(e) =>
        store.setParam('filter_cutoff', Math.round(20 * 900 ** Number(e.currentTarget.value)))}
      class="w-full cursor-pointer accent-amber-400"
    />
  </label>
  {@render slider('filter_resonance', 'Resonance', 0, 20, 0.1, fmtNum)}
  {@render slider('filter_env_amount', 'Env amount', -4, 4, 0.05, fmtEnvAmount)}
  {@render slider('filter_attack', 'Env attack', 0.001, 2, 0.001, fmtSec)}
  {@render slider('filter_decay', 'Env decay', 0.001, 2, 0.001, fmtSec)}
  {@render slider('filter_sustain', 'Env sustain', 0, 1, 0.01, fmtPct)}
  {@render slider('filter_release', 'Env release', 0.01, 4, 0.01, fmtSec)}
{/snippet}

{#snippet lfo(n: 1 | 2)}
  {@const target = params[`lfo${n}_target`]}
  {@render caption(`lfo${n}_target`, 'Moves')}
  <div
    id={`synth-lfo${n}_target`}
    class="-mt-2 grid grid-cols-3 gap-1 rounded-lg bg-zinc-950/60 p-1"
    role="group"
    aria-label="LFO {n} target"
  >
    {#each LFO_TARGETS as option (option)}
      <button
        type="button"
        aria-pressed={target === option}
        onclick={() => store.setLfoTarget(n, option)}
        class={[
          'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition',
          target === option
            ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
        ]}
      >
        {option}
      </button>
    {/each}
  </div>
  {@render slider(`lfo${n}_rate`, 'Rate', 0.1, 20, 0.1, fmtRate)}
  {@render slider(
    `lfo${n}_depth`,
    'Depth',
    0,
    LFO_DEPTH_MAX[target],
    LFO_DEPTH_STEP[target],
    LFO_DEPTH_FORMAT[target]
  )}
{/snippet}

{#snippet lfo1()}{@render lfo(1)}{/snippet}
{#snippet lfo2()}{@render lfo(2)}{/snippet}

{#snippet envelope()}
  {@render slider('attack', 'Attack', 0.001, 2, 0.001, fmtSec)}
  {@render slider('decay', 'Decay', 0.001, 2, 0.001, fmtSec)}
  {@render slider('sustain', 'Sustain', 0, 1, 0.01, fmtPct)}
  {@render slider('release', 'Release', 0.01, 4, 0.01, fmtSec)}
{/snippet}

{#snippet glide()}
  {@render caption('glide_mode', 'When')}
  <div
    id="synth-glide_mode"
    class="-mt-2 grid grid-cols-2 gap-1 rounded-lg bg-zinc-950/60 p-1"
    role="group"
    aria-label="When to glide"
  >
    {#each GLIDE_MODES as [mode, label] (mode)}
      <button
        type="button"
        aria-pressed={params.glide_mode === mode}
        title={mode === 'legato'
          ? 'Only into a note played while the last one is still held'
          : 'Into every note'}
        onclick={() => store.setParam('glide_mode', mode)}
        class={[
          'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition',
          params.glide_mode === mode
            ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
        ]}
      >
        {label}
      </button>
    {/each}
  </div>
  {@render slider('glide', 'Time', 0, 1, 0.005, fmtGlide)}
{/snippet}

<div
  class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
>
  <div id="preset-bar" class="flex flex-wrap items-center gap-2">
    <select
      id="preset-select"
      bind:value={selectedId}
      onchange={loadPreset}
      class="min-w-40 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-amber-400/60 focus:border-amber-400 focus:outline-none"
    >
      <option value="">Load preset…</option>
      <optgroup label="Factory">
        {#each FACTORY_PRESETS as preset, i (preset.name)}
          <option value={'factory:' + i}>{preset.name}</option>
        {/each}
      </optgroup>
      {#if presets.length}
        <optgroup label="Saved">
          {#each presets as preset (preset.id)}
            <option value={preset.id}>{preset.name}</option>
          {/each}
        </optgroup>
      {/if}
    </select>
    <input
      id="preset-name"
      type="text"
      maxlength="60"
      placeholder={canSave ? 'Preset name' : 'Sign in to save presets'}
      disabled={!canSave}
      bind:value={presetName}
      class="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 transition focus:border-amber-400 focus:outline-none disabled:opacity-60"
    />
    <button
      id="save-preset"
      type="button"
      disabled={!canSave || presetName.trim() === ''}
      onclick={savePreset}
      class="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
    >
      Save
    </button>
    <button
      id="reset-params"
      type="button"
      class={btn}
      onclick={() => store.setParams({ ...DEFAULT_PARAMS })}
    >
      Reset
    </button>
    <span id="preset-status" class="text-xs text-zinc-400" aria-live="polite">{status}</span>
  </div>

  <details id="synth-settings" class="group">
    <summary
      class="flex cursor-pointer list-none items-center gap-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-400"
    >
      Sound settings <ChevronDown class="size-4 transition group-open:rotate-180" />
    </summary>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
      {@render panel('Osc 1', osc1, 'osc')}
      {@render panel('Osc 2', osc2, 'osc')}
      {@render panel('Filter', filter, 'filter')}
      {@render panel('Envelope', envelope, 'envelope')}
      {@render panel('LFO 1', lfo1, 'lfo')}
      {@render panel('LFO 2', lfo2, 'lfo')}
      {@render panel('Glide', glide, 'glide')}
    </div>
  </details>

  <div
    class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
  >
    <div class="flex items-center gap-2">
      <button
        id="octave-down"
        type="button"
        class={btn}
        aria-label="Octave down"
        onclick={() => shiftOctave(-1)}>−</button
      >
      <span class="w-20 text-center font-mono text-sm tabular-nums text-zinc-300"
        >Octave {baseOctave}</span
      >
      <button
        id="octave-up"
        type="button"
        class={btn}
        aria-label="Octave up"
        onclick={() => shiftOctave(1)}>+</button
      >
    </div>
    <p class="text-xs text-zinc-500">
      Play with A–; keys · Z/X change octave · 1–8 trigger loop pads
    </p>
    <div class="w-full sm:w-56">
      {@render slider('volume', 'Master', 0, 1, 0.01, fmtPct)}
    </div>
  </div>

  <div
    id="synth-play"
    class="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
  >
    <label class="space-y-1" for="chord-select">
      {@render caption('chord', 'Chord')}
      <select
        id="chord-select"
        value={performance.chord}
        onchange={(e) => store.setPerformance({ chord: e.currentTarget.value as ChordShape })}
        class={select}
      >
        {#each CHORD_OPTIONS as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
    <div class="space-y-1">
      {@render caption('arp', 'Arp')}
      <div
        id="arp-mode"
        class="grid grid-cols-5 gap-1 rounded-lg bg-zinc-950/60 p-1"
        role="group"
        aria-label="Arpeggiator"
      >
        {#each ARP_OPTIONS as [value, label] (value)}
          <button
            type="button"
            aria-pressed={performance.arp === value}
            onclick={() => store.setPerformance({ arp: value })}
            class={[
              'rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition',
              performance.arp === value
                ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            ]}
          >
            {label}
          </button>
        {/each}
      </div>
    </div>
    <label class="space-y-1" for="arp-rate">
      {@render caption('arp_rate', 'Rate')}
      <select
        id="arp-rate"
        value={performance.arp_rate}
        disabled={performance.arp === 'off'}
        onchange={(e) => store.setPerformance({ arp_rate: e.currentTarget.value as ArpRate })}
        class={select}
      >
        {#each RATE_OPTIONS as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
    <p class="text-xs text-zinc-500">Hold keys to arpeggiate them in time with the song</p>
  </div>

  <section id="loop-pads" class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
    <div class="flex items-baseline justify-between">
      <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Loops</h2>
      <p class="text-xs text-zinc-500">
        Tap an empty pad to record, tap again to loop it · the pencil edits its notes
      </p>
    </div>
    <div class="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {#each pads as pad, slot (slot)}
        <div class="group relative">
          <button
            id={'loop-pad-' + slot}
            type="button"
            aria-label={`Loop pad ${slot + 1}`}
            aria-pressed={pad.playing || recording === slot}
            onclick={() => tapPad(slot)}
            class={[
              'relative flex aspect-square w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border text-sm font-semibold transition active:scale-95',
              recording === slot
                ? 'animate-pulse border-red-500 bg-red-500/15 text-red-300'
                : pad.playing
                  ? 'border-amber-400 bg-amber-400/15 text-amber-200 shadow shadow-amber-400/20'
                  : pad.filled
                    ? 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:border-amber-400/60 hover:bg-zinc-700'
                    : 'border-dashed border-zinc-700 text-zinc-500 hover:border-red-500/60 hover:text-red-300'
            ]}
          >
            <span class="font-mono text-lg">{slot + 1}</span>
            <span class="text-[10px] uppercase tracking-wider opacity-80">
              {recording === slot
                ? countingIn
                  ? 'Count-in'
                  : 'Done'
                : pad.filled
                  ? pad.label
                  : 'Rec'}
            </span>
            {#if pad.playing}
              <span
                class="absolute inset-x-0 bottom-0 h-1 bg-amber-400"
                style="width: {pad.pos * 100}%"
              ></span>
            {/if}
          </button>
          {#if pad.filled || recording === slot}
            <button
              id={'loop-clear-' + slot}
              type="button"
              aria-label={`Clear loop pad ${slot + 1}`}
              onclick={() => clearPad(slot)}
              class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-xs text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:border-red-500 hover:text-red-400 focus:opacity-100 pointer-coarse:opacity-100"
            >
              ×
            </button>
          {/if}
          {#if recording !== slot}
            <button
              id={'loop-edit-' + slot}
              type="button"
              aria-label={pad.filled
                ? `Edit loop pad ${slot + 1} in the piano roll`
                : `Draw a loop on pad ${slot + 1} in the piano roll`}
              aria-pressed={rollSlot === slot}
              title={pad.filled ? 'Edit notes' : 'Draw notes'}
              onclick={() => editPad(slot)}
              class={[
                'absolute -bottom-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full border bg-zinc-900 transition group-hover:opacity-100 hover:border-amber-400 hover:text-amber-300 focus:opacity-100 pointer-coarse:opacity-100',
                rollSlot === slot
                  ? 'border-amber-400 text-amber-300 opacity-100'
                  : 'border-zinc-600 text-zinc-400 opacity-0'
              ]}
            >
              <Pencil class="size-2.5" />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  {#if rollSlot !== null && rollLoop}
    {#key rollKey}
      <PianoRoll
        slot={rollSlot}
        loop={rollLoop}
        bpm={transport.bpm}
        playing={pads[rollSlot]?.playing ?? false}
        position={pads[rollSlot]?.pos ?? 0}
        onchange={onRollChange}
        onclose={closeRoll}
        onpreview={previewNote}
        ontoggle={toggleRollPad}
      />
    {/key}
  {/if}

  <div id="keyboard" class="relative flex h-40 select-none sm:h-48" style="touch-action: none">
    {#each keys as key (key.midi)}
      <button
        type="button"
        aria-label={key.label}
        onpointerdown={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          press(key.midi)
        }}
        onpointerenter={(e) => e.buttons & 1 && press(key.midi)}
        onpointerup={() => release(key.midi)}
        onpointerleave={() => release(key.midi)}
        onpointercancel={() => release(key.midi)}
        style={key.black
          ? `left: ${(key.white / whiteCount) * 100}%; width: ${(100 / whiteCount) * 0.6}%; transform: translateX(-50%)`
          : ''}
        class={[
          'transition-colors duration-75',
          key.black
            ? 'absolute top-0 z-10 h-[60%] rounded-b-md border border-black shadow-lg shadow-black/60'
            : 'relative h-full flex-1 rounded-b-lg border border-zinc-400 first:rounded-bl-lg',
          key.black && (held.has(key.midi) ? 'bg-amber-500' : 'bg-zinc-900 hover:bg-zinc-700'),
          !key.black && (held.has(key.midi) ? 'bg-amber-300' : 'bg-zinc-100 hover:bg-white')
        ]}
      >
        {#if !key.black && key.midi % 12 === 0}
          <span
            class="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-zinc-500"
            >{key.label}</span
          >
        {/if}
      </button>
    {/each}
  </div>
</div>
