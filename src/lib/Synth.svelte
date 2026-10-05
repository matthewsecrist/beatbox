<script lang="ts">
  import { Pencil, Repeat, Repeat1 } from '@lucide/svelte'
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
    DelayTime,
    DriveType,
    FilterType,
    GlideMode,
    LfoNote,
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

  import { crushBits } from './audio.js'
  import Channel from './Channel.svelte'
  import { DELAY_TIMES, effects } from './effects.js'
  import { help } from './help.js'
  import Info from './Info.svelte'
  import PianoRoll from './PianoRoll.svelte'
  import PresetBrowser from './PresetBrowser.svelte'
  import { PAD_COUNT } from './song.svelte.js'
  import { chordNotes, createArp } from './synth/arp.js'
  import { createSynth, DEFAULT_PARAMS, LFO_DEPTH_MAX, LFO_NOTES } from './synth/engine.js'
  import { createPlayer, createRecorder } from './synth/looper.js'
  import Tabs from './Tabs.svelte'
  import { BEATS_PER_BAR, transport } from './transport.js'

  // Synth settings and loops live in the song store (and its undo history); this
  // component reads them and changes them through the store. `savePreset`/
  // `loadPreset` talk to the server. Signed out (`canSave` false), only the factory
  // presets can be loaded and nothing can be saved. The editor (pads and sound)
  // shows while the synth track is `selected`; the keyboard bar always shows, last
  // in its (flex) parent, and the engine keeps running either way. `bpm` is the
  // tempo playing (a section's own while it plays), for synced LFOs.
  let {
    bpm,
    canSave = true,
    loadPreset: fetchPreset,
    onAudioReady,
    presets = [],
    savePreset: storePreset,
    selected,
    store
  }: {
    bpm: number
    canSave?: boolean
    loadPreset: (id: string) => Promise<LoadPresetReply>
    onAudioReady: (ready: boolean) => void
    presets?: PresetSummary[]
    savePreset: (name: string, params: SynthParams) => Promise<SavePresetReply>
    selected: boolean
    store: SongStore
  } = $props()

  type Tab = 'amp' | 'drive' | 'filter' | 'fx' | 'mix' | 'mod' | 'osc' | 'pads'
  const TABS: [Tab, string][] = [
    ['pads', 'Pads'],
    ['osc', 'Osc'],
    ['filter', 'Filter'],
    ['amp', 'Amp'],
    ['mod', 'Mod'],
    ['drive', 'Drive & Glide'],
    ['fx', 'FX'],
    ['mix', 'Mix']
  ]
  let tab: Tab = $state('pads')

  type NumericParam = {
    [K in keyof SynthParams]: SynthParams[K] extends number ? K : never
  }[keyof SynthParams]

  // The keyboard's sound: what live notes, the arp and new recordings use.
  const params: SynthParams = $derived({ ...DEFAULT_PARAMS, ...store.synth })
  const performance = $derived(store.performance)
  let presetName = $state('')
  let selectedId = $state('')
  let presetOpen = $state(false)
  let status = $state('')
  let baseOctave = $state(4)
  // Keys down (keyboard midi -> the notes it plays, one per chord note), and how
  // many keys hold each note: a note shared by two chords sounds until both let go.
  const pressed = new SvelteMap<number, number[]>()
  const held = new SvelteMap<number, number>()
  const heldKeys = new SvelteMap<string, number>()
  let synth: null | Synth = $state.raw(null)
  let audioStatus = $state('Loading sound…')
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
      once: !!loop?.once,
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

  function setPlayback(slot: number, playing: boolean, pos = 0, updatePosition = true) {
    const state = playback[slot]
    if (!state) return
    state.playing = playing
    if (updatePosition || !playing) state.pos = pos
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
  // Mildest to wildest.
  const DRIVE_TYPES: DriveType[] = ['soft', 'tube', 'hard', 'fold']
  const FILTER_TYPES: [FilterType, string][] = [
    ['lowpass', 'Low'],
    ['highpass', 'High'],
    ['bandpass', 'Band'],
    ['notch', 'Notch']
  ]
  const CHORUS_TYPES: [boolean, string][] = [
    [false, 'Chorus'],
    [true, 'Flanger']
  ]
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
  // playing ones keep their phase); the rest stop exactly on it. A section's
  // synth filter lane shifts every note's cutoff over it (none: back to no shift).
  function onScene({ detail }: CustomEvent<Scene>) {
    if (!synth) return showStatus(audioStatus)
    players.forEach((p, slot) => {
      if (!p) return
      if (detail.pads.includes(slot)) {
        p.start(detail.beat, ((detail.padStarts?.[slot] ?? 1) - 1) * BEATS_PER_BAR)
        setPlayback(slot, true)
      } else {
        p.stopAt(detail.beat)
      }
    })
    synth?.automateFilter(
      detail.automation.synth_filter ?? null,
      transport.timeAt(detail.beat),
      transport.timeAt(detail.end)
    )
  }

  // Song-bar Play (with no arrangement: every filled pad) / Stop (them all, and
  // any cutoff shift the song was making).
  function onTransport(e: CustomEvent<TransportDetail>) {
    if (e.detail.play && !synth) return showStatus(audioStatus)
    players.forEach((p, slot) => {
      if (!p) return
      if (e.detail.play && !p.playing) startPad(slot)
      if (!e.detail.play && p.playing) stopPad(slot)
    })
    if (!e.detail.play) synth?.stopAutomation()
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
  // While a pad is open in the piano roll, the sound controls and presets change its
  // own sound (live, even while it plays); otherwise the keyboard's.
  const soundPad = $derived(rollLoop ? rollSlot : null)
  const edited: SynthParams = $derived({
    ...DEFAULT_PARAMS,
    ...store.soundOf(soundPad),
    volume: params.volume
  })
  let rollKey = $state(0)

  // Opening or closing a pad switches whose sound the controls edit, so the preset
  // shown as loaded no longer applies.
  function closeRoll() {
    rollSlot = null
    selectedId = ''
  }

  // Opens a pad in the piano roll; an empty pad gets an empty one-bar loop to draw in.
  function editPad(slot: number) {
    if (store.readOnly || !synth || recording === slot) return
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
    selectedId = ''
    rollKey++
  }

  // An edit from the piano roll: playing pads pick it up straight away.
  function onRollChange(loop: Loop) {
    store.setLoop(loop)
  }

  // Sounds a pitch with the edited loop's own synth settings, at a note's velocity.
  function previewNote(midi: number, velocity?: number) {
    if (!synth || !rollLoop) return
    synth.noteOn(midi, undefined, 'roll', rollLoop.params, velocity)
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
    if (store.readOnly) return // a shared song is listen-only
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
    presetOpen ||
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
    if (!synth || e.repeat || ignored(e)) return
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
    let disposed = false
    let lastProgressUpdate = 0
    const createdArp = createArp(created, transport, (midi, on, at) => {
      if (recording >= 0) recorder.note(midi, on, at)
    })
    void created
      .ready()
      .then(() => {
        if (disposed) return
        created.setParams($state.snapshot(params))
        created.setTempo(bpm)
        synth = created
        arp = createdArp
        audioStatus = ''
        // The store may change while audio loads.
        if (performance.arp !== 'off') createdArp.set(performance.arp, performance.arp_rate)
        syncPlayers()
        onAudioReady(true)
        loopTimer = setInterval(() => {
          // Audio stays at 40 Hz; only visible pad/piano-roll progress needs 20 Hz.
          const now = globalThis.performance.now()
          const updateProgress = selected && tab === 'pads' && now - lastProgressUpdate >= 50
          if (updateProgress) lastProgressUpdate = now
          createdArp.tick()
          // The UI follows the players: a pad stopped by a section boundary plays on until it.
          players.forEach((p, slot) => {
            if (!p?.playing) return
            const pos = p.tick()
            setPlayback(slot, p.playing, p.playing ? pos : 0, updateProgress)
          })
          if (recording >= 0) countingIn = transport.beatAt(transport.now()) < recorder.startBeat
        }, 25)
      })
      .catch((error: unknown) => {
        if (disposed) return
        synth = null
        arp = null
        created.close()
        onAudioReady(false)
        audioStatus =
          error instanceof Error ? `Sound unavailable: ${error.message}` : 'Could not load sound'
      })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('beatbox:transport', onTransport)
    window.addEventListener('beatbox:report', onReport)
    window.addEventListener('beatbox:scene', onScene)
    return () => {
      disposed = true
      onAudioReady(false)
      synth = null
      arp = null
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

  // Synced LFOs follow the tempo playing.
  $effect(() => synth?.setTempo(bpm))
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

  function loadPreset(id: string, name: string, sound: Partial<SynthParams>) {
    if (store.readOnly) return
    store.setParams({ ...DEFAULT_PARAMS, volume: params.volume, ...sound }, soundPad)
    selectedId = id
    presetName = name
  }

  function savePreset() {
    void storePreset(presetName, $state.snapshot(edited)).then((reply) => {
      if ('error' in reply) return showStatus(reply.error)
      selectedId = reply.id
      showStatus('Saved “' + reply.name + '”')
    })
  }

  const cutoffPos = $derived(Math.log(edited.filter_cutoff / 20) / Math.log(900))
  const fmtHz = (hz: number) =>
    hz >= 1000 ? (hz / 1000).toFixed(2) + ' kHz' : Math.round(hz) + ' Hz'
  const fmtSec = (s: number) => (s < 1 ? Math.round(s * 1000) + ' ms' : s.toFixed(2) + ' s')
  const fmtGlide = (s: number) => (s === 0 ? 'off' : fmtSec(s))
  const fmtPct = (v: number) => Math.round(v * 100) + '%'
  const fmtInt = (v: number) => (v > 0 ? '+' : '') + String(v)
  const fmtCents = (v: number) => fmtInt(v) + '¢'
  const fmtNum = (v: number) => Number(v).toFixed(1)
  const fmtRate = (v: number) => Number(v).toFixed(1) + ' Hz'
  const fmtChorusRate = (v: number) => Number(v).toFixed(2) + ' Hz'
  const fmtOct = (v: number) => (v === 0 ? 'off' : Number(v).toFixed(2) + ' oct')
  const fmtEnvAmount = (v: number) => (v === 0 ? 'off' : fmtInt(Number(v.toFixed(2))) + ' oct')
  const fmtVibrato = (v: number) => (v === 0 ? 'off' : '±' + Math.round(v) + '¢')
  const fmtSemis = (v: number) => (v === 0 ? 'off' : fmtInt(v) + ' st')
  const fmtPctOrOff = (v: number) => (v === 0 ? 'off' : fmtPct(v))
  const fmtCrush = (v: number) => (v === 0 ? 'off' : crushBits(v) + '-bit')
  // Depth slider per LFO target: octaves of cutoff, cents of pitch, share of level.
  const LFO_DEPTH_STEP: Record<LfoTarget, number> = { amp: 0.01, filter: 0.05, pitch: 1 }
  const LFO_DEPTH_FORMAT: Record<LfoTarget, (v: number) => string> = {
    amp: fmtPctOrOff,
    filter: fmtOct,
    pitch: fmtVibrato
  }
  // "1/8d" -> "1/8 dotted", "1/8t" -> "1/8T", as the delay's times read.
  const fmtNote = (note: LfoNote) =>
    note.endsWith('d')
      ? note.slice(0, -1) + ' dotted'
      : note.endsWith('t')
        ? note.slice(0, -1) + 'T'
        : note

  const btn =
    'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40'
  // No dimming when disabled: a read-only song locks Chord and Rate but keeps them
  // readable. Rate dims itself while the arp is off.
  const select =
    'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-amber-400/60 focus:border-amber-400 focus:outline-none disabled:pointer-events-none'
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
      <span class="font-mono text-amber-300 tabular-nums normal-case">{format(edited[key])}</span>
    </span>
    <input
      id={'synth-' + key}
      type="range"
      {min}
      {max}
      {step}
      value={edited[key]}
      disabled={store.readOnly}
      oninput={(e) => store.setParam(key, Number(e.currentTarget.value), soundPad)}
      class="w-full cursor-pointer accent-amber-400 disabled:cursor-default"
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
        aria-pressed={edited[key] === wave}
        disabled={store.readOnly}
        onclick={() => store.setParam(key, wave, soundPad)}
        class={[
          'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:pointer-events-none',
          edited[key] === wave
            ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
        ]}
      >
        {wave === 'sawtooth' ? 'saw' : wave === 'triangle' ? 'tri' : wave}
      </button>
    {/each}
  </div>
{/snippet}

<!-- A module card; `grid` lays its sliders out in columns (for panels of sliders only). -->
{#snippet panel(title: string, body: Snippet, name: string, grid = '')}
  <section
    class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-inner shadow-black/40"
  >
    <h3
      class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-400"
    >
      {title}{@render info('panel_' + name, title)}
    </h3>
    {#if grid}
      <div class={['grid gap-x-6 gap-y-4', grid]}>{@render body()}</div>
    {:else}
      {@render body()}
    {/if}
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

{#snippet pitchEnv()}
  {@render slider('pitch_env_amount', 'Amount', -48, 48, 1, fmtSemis)}
  {@render slider('pitch_env_decay', 'Decay', 0.001, 2, 0.001, fmtSec)}
{/snippet}

{#snippet subNoise()}
  {@render slider('sub_level', 'Sub', 0, 1, 0.01, fmtPctOrOff)}
  {@render slider('noise_level', 'Noise', 0, 1, 0.01, fmtPctOrOff)}
{/snippet}

{#snippet pluck()}
  {@render slider('pluck_brightness', 'Brightness', 0, 1, 0.01, fmtPct)}
  {@render slider('pluck_decay', 'Ring time', 0.1, 10, 0.1, fmtSec)}
{/snippet}

{#snippet drive()}
  {@render caption('drive_type', 'Character')}
  <div
    id="synth-drive_type"
    class="-mt-2 grid grid-cols-4 gap-1 rounded-lg bg-zinc-950/60 p-1"
    role="group"
    aria-label="Drive character"
  >
    {#each DRIVE_TYPES as type (type)}
      <button
        type="button"
        aria-pressed={edited.drive_type === type}
        disabled={store.readOnly}
        onclick={() => store.setParam('drive_type', type, soundPad)}
        class={[
          'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:pointer-events-none',
          edited.drive_type === type
            ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
        ]}
      >
        {type}
      </button>
    {/each}
  </div>
  {@render slider('drive', 'Amount', 0, 1, 0.01, fmtPctOrOff)}
  {@render slider('drive_mix', 'Mix', 0, 1, 0.01, fmtPct)}
{/snippet}

{#snippet filter()}
  <div class="space-y-1">
    {@render caption('filter_type', 'Type')}
    <div
      id="synth-filter_type"
      class="grid grid-cols-4 gap-1 rounded-lg bg-zinc-950/60 p-1"
      role="group"
      aria-label="Filter type"
    >
      {#each FILTER_TYPES as [type, label] (type)}
        <button
          type="button"
          aria-pressed={edited.filter_type === type}
          disabled={store.readOnly}
          onclick={() => store.setParam('filter_type', type, soundPad)}
          class={[
            'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:pointer-events-none',
            edited.filter_type === type
              ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
          ]}
        >
          {label}
        </button>
      {/each}
    </div>
  </div>
  <label class="block space-y-1" for="synth-filter_cutoff">
    <span
      class="flex items-baseline justify-between text-xs uppercase tracking-wider text-zinc-400"
    >
      <span class="flex items-center gap-1">Cutoff{@render info('filter_cutoff', 'Cutoff')}</span>
      <span class="font-mono text-amber-300 tabular-nums normal-case"
        >{fmtHz(edited.filter_cutoff)}</span
      >
    </span>
    <input
      id="synth-filter_cutoff"
      type="range"
      min="0"
      max="1"
      step="0.001"
      value={cutoffPos}
      disabled={store.readOnly}
      oninput={(e) =>
        store.setParam(
          'filter_cutoff',
          Math.round(20 * 900 ** Number(e.currentTarget.value)),
          soundPad
        )}
      class="w-full cursor-pointer accent-amber-400 disabled:cursor-default"
    />
  </label>
  {@render slider('filter_resonance', 'Resonance', 0, 20, 0.1, fmtNum)}
  {@render slider('filter_env_amount', 'Env amount', -4, 4, 0.05, fmtEnvAmount)}
  {@render slider('filter_velocity', 'Env velocity', 0, 1, 0.01, fmtPctOrOff)}
  {@render slider('filter_attack', 'Env attack', 0.001, 2, 0.001, fmtSec)}
  {@render slider('filter_decay', 'Env decay', 0.001, 2, 0.001, fmtSec)}
  {@render slider('filter_sustain', 'Env sustain', 0, 1, 0.01, fmtPct)}
  {@render slider('filter_release', 'Env release', 0.01, 4, 0.01, fmtSec)}
{/snippet}

{#snippet lfo(n: 1 | 2)}
  {@const target = edited[`lfo${n}_target`]}
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
        disabled={store.readOnly}
        onclick={() => store.setLfoTarget(n, option, soundPad)}
        class={[
          'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:pointer-events-none',
          target === option
            ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
        ]}
      >
        {option}
      </button>
    {/each}
  </div>
  {@render caption(`lfo${n}_sync`, 'Speed')}
  <div
    id={`synth-lfo${n}_sync`}
    class="-mt-2 grid grid-cols-2 gap-1 rounded-lg bg-zinc-950/60 p-1"
    role="group"
    aria-label="LFO {n} speed"
  >
    {#each [false, true] as sync (sync)}
      <button
        type="button"
        aria-pressed={edited[`lfo${n}_sync`] === sync}
        disabled={store.readOnly}
        onclick={() => store.setParam(`lfo${n}_sync`, sync, soundPad)}
        class={[
          'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:pointer-events-none',
          edited[`lfo${n}_sync`] === sync
            ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
        ]}
      >
        {sync ? 'Sync' : 'Hz'}
      </button>
    {/each}
  </div>
  {#if edited[`lfo${n}_sync`]}
    <label class="block space-y-1" for={`synth-lfo${n}_note`}>
      <span class="flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-400"
        >Note{@render info(`lfo${n}_note`, 'Note')}</span
      >
      <select
        id={`synth-lfo${n}_note`}
        value={edited[`lfo${n}_note`]}
        disabled={store.readOnly}
        onchange={(e) => store.setParam(`lfo${n}_note`, e.currentTarget.value as LfoNote, soundPad)}
        class={select + ' w-full'}
      >
        {#each LFO_NOTES as note (note)}
          <option value={note}>{fmtNote(note)}</option>
        {/each}
      </select>
    </label>
  {:else}
    {@render slider(`lfo${n}_rate`, 'Rate', 0.1, 20, 0.1, fmtRate)}
  {/if}
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
        aria-pressed={edited.glide_mode === mode}
        title={mode === 'legato'
          ? 'Only into a note played while the last one is still held'
          : 'Into every note'}
        onclick={() => store.setParam('glide_mode', mode, soundPad)}
        disabled={store.readOnly}
        class={[
          'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:pointer-events-none',
          edited.glide_mode === mode
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

{#snippet chorus()}
  {@render caption('fx_chorus_flanger', 'Type')}
  <div
    id="synth-fx_chorus_flanger"
    class="-mt-2 grid grid-cols-2 gap-1 rounded-lg bg-zinc-950/60 p-1"
    role="group"
    aria-label="Chorus type"
  >
    {#each CHORUS_TYPES as [flanger, label] (label)}
      <button
        type="button"
        aria-pressed={edited.fx_chorus_flanger === flanger}
        onclick={() => store.setParam('fx_chorus_flanger', flanger, soundPad)}
        disabled={store.readOnly}
        class={[
          'rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:pointer-events-none',
          edited.fx_chorus_flanger === flanger
            ? 'bg-amber-400 text-zinc-900 shadow shadow-amber-400/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
        ]}
      >
        {label}
      </button>
    {/each}
  </div>
  {@render slider('fx_chorus_rate', 'Rate', 0.05, 5, 0.05, fmtChorusRate)}
  {@render slider('fx_chorus_depth', 'Depth', 0, 1, 0.01, fmtPct)}
  {@render slider('fx_chorus_mix', 'Mix', 0, 1, 0.01, fmtPctOrOff)}
{/snippet}

{#snippet crush()}
  {@render slider('fx_crush', 'Amount', 0, 1, 0.1, fmtCrush)}
{/snippet}

{#snippet echo()}
  <label class="block space-y-1" for="synth-fx_delay_time">
    <span class="flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-400"
      >Time{@render info('fx_delay_time', 'Time')}</span
    >
    <select
      id="synth-fx_delay_time"
      value={edited.fx_delay_time}
      disabled={store.readOnly}
      onchange={(e) =>
        store.setParam('fx_delay_time', e.currentTarget.value as DelayTime, soundPad)}
      class={select + ' w-full'}
    >
      {#each DELAY_TIMES as [value, text] (value)}
        <option {value}>{text}</option>
      {/each}
    </select>
  </label>
  {@render slider('fx_delay_feedback', 'Feedback', 0, 0.9, 0.01, fmtPct)}
  {@render slider('fx_delay_mix', 'Mix', 0, 1, 0.01, fmtPctOrOff)}
{/snippet}

{#snippet room()}
  {@render slider('fx_reverb_size', 'Size', 0.3, 6, 0.1, fmtSec)}
  {@render slider('fx_reverb_mix', 'Mix', 0, 1, 0.01, fmtPctOrOff)}
{/snippet}

{#if presetOpen}
  <PresetBrowser
    loadPreset={fetchPreset}
    onclose={() => (presetOpen = false)}
    onload={loadPreset}
    {presets}
    previewLoop={rollLoop}
    {selectedId}
    target={soundPad === null ? 'the keyboard' : `pad ${soundPad + 1}`}
  />
{/if}

<div class="contents">
  <section
    id="synth"
    aria-label="Synth"
    hidden={!selected}
    class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
  >
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Synth</h2>
      {#if soundPad !== null}
        <span
          id="editing-pad-sound"
          class="flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-400/10 py-0.5 pr-1 pl-3 text-xs text-amber-200"
        >
          Editing pad {soundPad + 1}'s sound
          <button
            type="button"
            onclick={closeRoll}
            title="Close the piano roll: the controls go back to the keyboard's sound"
            class="rounded-full px-2 py-0.5 font-semibold text-amber-100 transition hover:bg-amber-400/20"
            >Done</button
          >
        </span>
      {/if}
    </div>
    {#if !store.readOnly}
      <div id="preset-bar" class="flex flex-wrap items-center gap-2">
        <button
          id="preset-select"
          type="button"
          aria-haspopup="dialog"
          aria-controls="preset-browser"
          onclick={() => {
            onBlur()
            presetOpen = true
          }}
          class={btn}
        >
          Browse presets…
        </button>
        <input
          id="preset-name"
          type="text"
          maxlength="60"
          placeholder={canSave ? 'Preset name' : 'Sign in to save presets'}
          disabled={!canSave}
          bind:value={presetName}
          class="min-w-0 flex-1 basis-40 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 transition focus:border-amber-400 focus:outline-none disabled:opacity-60"
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
          onclick={() => store.setParams({ ...DEFAULT_PARAMS }, soundPad)}
        >
          Reset
        </button>
        <span id="preset-status" class="text-xs text-zinc-400" aria-live="polite">{status}</span>
      </div>
    {/if}

    <Tabs id="synth-tabs" label="Synth editor" tabs={TABS} bind:value={tab}>
      {#if tab === 'pads'}
        <section
          id="loop-pads"
          class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
        >
          <p class="flex items-center gap-1 text-xs text-zinc-500">
            {store.readOnly
              ? 'Tap a pad to play or stop its loop'
              : 'Tap an empty pad to record, tap again to loop it · the pencil edits its notes · the corner arrow makes it play once'}
            <Info label="Play once" text={help('pad_once') ?? ''} />
          </p>
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {#each pads as pad, slot (slot)}
              <div class="group relative">
                <button
                  id={'loop-pad-' + slot}
                  type="button"
                  aria-label={`Loop pad ${slot + 1}`}
                  aria-pressed={pad.playing || recording === slot}
                  disabled={!synth || (store.readOnly && !pad.filled)}
                  onclick={() => tapPad(slot)}
                  class={[
                    'relative flex aspect-square max-h-24 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border text-sm font-semibold transition active:scale-95 disabled:pointer-events-none',
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
                        : store.readOnly
                          ? 'Empty'
                          : 'Rec'}
                  </span>
                  {#if pad.playing}
                    <span
                      class="absolute inset-x-0 bottom-0 h-1 bg-amber-400"
                      style="width: {pad.pos * 100}%"
                    ></span>
                  {/if}
                </button>
                {#if !store.readOnly && (pad.filled || recording === slot)}
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
                {#if !store.readOnly && recording !== slot}
                  <button
                    id={'loop-edit-' + slot}
                    type="button"
                    aria-label={pad.filled
                      ? `Edit loop pad ${slot + 1} in the piano roll`
                      : `Draw a loop on pad ${slot + 1} in the piano roll`}
                    aria-pressed={rollSlot === slot}
                    disabled={!synth}
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
                {#if pad.filled && (!store.readOnly || pad.once)}
                  <button
                    id={'loop-once-' + slot}
                    type="button"
                    aria-label={`Loop pad ${slot + 1}: play once`}
                    aria-pressed={pad.once}
                    disabled={store.readOnly}
                    title={pad.once ? 'Plays once (click to loop)' : 'Loops (click to play once)'}
                    onclick={() => store.setLoopOnce(slot, !pad.once)}
                    class={[
                      'absolute -bottom-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-zinc-900 transition group-hover:opacity-100 hover:border-amber-400 hover:text-amber-300 focus:opacity-100 disabled:pointer-events-none pointer-coarse:opacity-100',
                      pad.once
                        ? 'border-amber-400 text-amber-300 opacity-100'
                        : 'border-zinc-600 text-zinc-400 opacity-0'
                    ]}
                  >
                    {#if pad.once}<Repeat1 class="size-2.5" />{:else}<Repeat
                        class="size-2.5"
                      />{/if}
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
      {:else if tab === 'osc'}
        <div class="space-y-4">
          <label class="block space-y-1" for="synth-sound_mode">
            {@render caption('sound_mode', 'Sound')}
            <select
              id="synth-sound_mode"
              value={edited.sound_mode}
              disabled={store.readOnly}
              onchange={(e) =>
                store.setParam(
                  'sound_mode',
                  e.currentTarget.value as SynthParams['sound_mode'],
                  soundPad
                )}
              class={select}
            >
              <option value="synth">Synth</option>
              <option value="pluck">Plucked string</option>
            </select>
          </label>
          <div class="grid gap-4 sm:grid-cols-2">
            {#if edited.sound_mode === 'pluck'}
              {@render panel('Plucked string', pluck, 'pluck')}
            {:else}
              {@render panel('Osc 1', osc1, 'osc')}
              {@render panel('Osc 2', osc2, 'osc')}
              {@render panel('Sub & Noise', subNoise, 'sub_noise')}
            {/if}
            {@render panel('Pitch Envelope', pitchEnv, 'pitch_env')}
          </div>
        </div>
      {:else if tab === 'filter'}
        {@render panel('Filter', filter, 'filter', 'sm:grid-cols-2 lg:grid-cols-4')}
      {:else if tab === 'amp'}
        {@render panel('Envelope', envelope, 'envelope', 'sm:grid-cols-2 lg:grid-cols-4')}
      {:else if tab === 'mod'}
        <div class="grid gap-4 sm:grid-cols-2">
          {@render panel('LFO 1', lfo1, 'lfo')}
          {@render panel('LFO 2', lfo2, 'lfo')}
        </div>
      {:else if tab === 'drive'}
        <div class="grid gap-4 sm:grid-cols-2">
          {@render panel('Drive', drive, 'drive')}
          {@render panel('Glide', glide, 'glide')}
        </div>
      {:else if tab === 'fx'}
        <div id="synth-fx" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {@render panel('Chorus', chorus, 'sound_chorus')}
          {@render panel('Bitcrusher', crush, 'sound_crush')}
          {@render panel('Delay', echo, 'sound_delay')}
          {@render panel('Reverb', room, 'sound_reverb')}
        </div>
      {:else}
        <Channel instrument="synth" {store} />
      {/if}
    </Tabs>
  </section>

  <!-- The keyboard is always there (last in the parent), whichever track is being edited. -->
  <section
    id="keyboard-bar"
    aria-label="Keyboard"
    class="order-last space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
  >
    {#if audioStatus}
      <p id="synth-audio-status" role="status" class="text-sm text-amber-300">{audioStatus}</p>
    {/if}
    <div id="synth-play" class="flex flex-wrap items-end gap-4">
      <div class="space-y-1">
        <span class="block text-xs uppercase tracking-wider text-zinc-400">Octave</span>
        <div class="flex items-center gap-1">
          <button
            id="octave-down"
            type="button"
            class={btn}
            aria-label="Octave down"
            onclick={() => shiftOctave(-1)}>−</button
          >
          <span class="w-8 text-center font-mono text-sm tabular-nums text-zinc-300"
            >{baseOctave}</span
          >
          <button
            id="octave-up"
            type="button"
            class={btn}
            aria-label="Octave up"
            onclick={() => shiftOctave(1)}>+</button
          >
        </div>
      </div>
      <label class="space-y-1" for="chord-select">
        {@render caption('chord', 'Chord')}
        <select
          id="chord-select"
          value={performance.chord}
          disabled={store.readOnly}
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
              disabled={store.readOnly}
              onclick={() => store.setPerformance({ arp: value })}
              class={[
                'rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:pointer-events-none',
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
          disabled={store.readOnly || performance.arp === 'off'}
          onchange={(e) => store.setPerformance({ arp_rate: e.currentTarget.value as ArpRate })}
          class={[select, performance.arp === 'off' && 'disabled:opacity-40']}
        >
          {#each RATE_OPTIONS as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>
      <p class="text-xs text-zinc-500">
        Play with A–; keys · Z/X change octave · 1–8 trigger loop pads · hold keys to arpeggiate
      </p>
    </div>

    <div id="keyboard" class="relative flex h-40 select-none sm:h-48" style="touch-action: none">
      {#each keys as key (key.midi)}
        <button
          type="button"
          aria-label={key.label}
          disabled={!synth}
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
  </section>
</div>
