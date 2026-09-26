<script>
  import { onMount, untrack } from "svelte"
  import { SvelteSet } from "svelte/reactivity"
  import { DEFAULT_PARAMS, createSynth } from "./synth/engine.js"
  import { createPlayer, createRecorder } from "./synth/looper.js"

  let { presets = [], loops = [], live } = $props()

  let params = $state({ ...DEFAULT_PARAMS })
  let presetName = $state("")
  let selectedId = $state("")
  let status = $state("")
  let baseOctave = $state(4)
  const active = new SvelteSet()
  const heldKeys = new Map()
  let synth = null
  let statusTimer

  // Loop pads: each slot holds a recorded loop (with the synth params it was
  // recorded with) and plays independently. `players`/`recorder` need the synth,
  // so they're created in onMount; `pads` is just the UI state.
  const PAD_COUNT = 8
  const saved = untrack(() => new Map(loops.map((l) => [l.slot, l]))) // mount-time only; pads own state after
  let pads = $state(
    Array.from({ length: PAD_COUNT }, (_, slot) => ({
      filled: saved.has(slot),
      length: saved.get(slot)?.length ?? 0,
      playing: false,
      pos: 0,
    })),
  )
  let recording = $state(-1) // slot being recorded, or -1
  let recordParams = null
  let recorder = null
  let loopTimer
  const players = []

  const WAVES = ["sine", "triangle", "sawtooth", "square"]
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  const KEY_MAP = "awsedftgyhujkolp;"

  const baseMidi = $derived(12 * (baseOctave + 1))
  const keys = $derived.by(() => {
    let white = 0
    return Array.from({ length: 25 }, (_, i) => {
      const midi = baseMidi + i
      const name = NOTE_NAMES[midi % 12]
      const black = name.includes("#")
      const key = { midi, black, label: name + (Math.floor(midi / 12) - 1), white }
      if (!black) white++
      return key
    })
  })
  const whiteCount = 15

  function press(midi) {
    if (!synth) return
    active.add(midi)
    synth.noteOn(midi)
    if (recording >= 0) recorder.note(midi, true)
  }

  function release(midi) {
    if (!active.has(midi)) return
    active.delete(midi)
    synth.noteOff(midi)
    if (recording >= 0) recorder.note(midi, false)
  }

  function tapPad(slot) {
    if (!synth) return
    if (recording === slot) return finishRecording()
    if (!pads[slot].filled) return startRecording(slot)
    players[slot].playing ? stopPad(slot) : startPad(slot)
  }

  function startRecording(slot) {
    if (recording >= 0) finishRecording()
    recorder.start([...active])
    // Master volume stays a global control, so a loop doesn't pin its own level.
    const { volume, ...sound } = $state.snapshot(params)
    recordParams = sound
    recording = slot
  }

  function finishRecording() {
    const slot = recording
    recording = -1
    const take = recorder.finish()
    if (!take) return
    const loop = { ...take, params: recordParams }
    const player = createPlayer(synth, `pad${slot}:`, loop)
    players[slot] = player
    pads[slot] = { filled: true, length: loop.length, playing: false, pos: 0 }
    startPad(slot)
    live.pushEvent("save_loop", { slot, ...loop }, (reply) => {
      if (!reply.error) return
      // Only roll back if the pad still holds this take (not re-recorded/cleared since).
      if (players[slot] === player) {
        player.stop()
        players[slot] = null
        pads[slot] = { filled: false, length: 0, playing: false, pos: 0 }
      }
      showStatus("Loop not saved: " + reply.error)
    })
  }

  function startPad(slot) {
    players[slot].start()
    pads[slot].playing = true
  }

  function stopPad(slot) {
    players[slot].stop()
    pads[slot].playing = false
    pads[slot].pos = 0
  }

  function clearPad(slot) {
    if (recording === slot) recording = -1
    players[slot]?.stop()
    players[slot] = null
    pads[slot] = { filled: false, length: 0, playing: false, pos: 0 }
    live.pushEvent("clear_loop", { slot }, (reply) => reply.error && showStatus("Loop not cleared: " + reply.error))
  }

  function shiftOctave(delta) {
    baseOctave = Math.min(6, Math.max(1, baseOctave + delta))
  }

  function showStatus(msg) {
    status = msg
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => (status = ""), 3000)
  }

  const ignored = (e) =>
    e.ctrlKey || e.metaKey || e.altKey || ["INPUT", "SELECT", "TEXTAREA"].includes(e.target?.tagName)

  function onKeyDown(e) {
    if (e.repeat || ignored(e)) return
    const k = e.key.toLowerCase()
    if (k === "z") return shiftOctave(-1)
    if (k === "x") return shiftOctave(1)
    if (k >= "1" && k <= "8") return tapPad(Number(k) - 1)
    const offset = KEY_MAP.indexOf(k)
    if (offset < 0 || heldKeys.has(k)) return
    const midi = baseMidi + offset
    heldKeys.set(k, midi)
    press(midi)
  }

  function onKeyUp(e) {
    const k = e.key.toLowerCase()
    const midi = heldKeys.get(k)
    if (midi === undefined) return
    heldKeys.delete(k)
    release(midi)
  }

  function onBlur() {
    synth?.allNotesOff()
    active.clear()
    heldKeys.clear()
  }

  onMount(() => {
    synth = createSynth($state.snapshot(params))
    recorder = createRecorder(synth)
    for (const [slot, loop] of saved) players[slot] = createPlayer(synth, `pad${slot}:`, loop)
    loopTimer = setInterval(() => {
      players.forEach((p, slot) => p?.playing && (pads[slot].pos = p.tick()))
    }, 25)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
      clearTimeout(statusTimer)
      clearInterval(loopTimer)
      players.forEach((p) => p?.stop())
      synth.allNotesOff()
    }
  })

  $effect(() => {
    const snapshot = $state.snapshot(params)
    synth?.setParams(snapshot)
  })

  function loadPreset(e) {
    const id = e.currentTarget.value
    if (!id) return
    live.pushEvent("load_preset", { id }, (reply) => {
      if (reply.params) {
        params = { ...DEFAULT_PARAMS, ...reply.params }
        presetName = reply.name
      } else {
        showStatus(reply.error)
      }
    })
  }

  function savePreset() {
    live.pushEvent("save_preset", { name: presetName, params: $state.snapshot(params) }, (reply) => {
      if (reply.ok) selectedId = reply.id
      showStatus(reply.ok ? "Saved “" + reply.name + "”" : reply.error)
    })
  }

  const cutoffPos = $derived(Math.log(params.filter_cutoff / 20) / Math.log(900))
  const fmtHz = (hz) => (hz >= 1000 ? (hz / 1000).toFixed(2) + " kHz" : Math.round(hz) + " Hz")
  const fmtSec = (s) => (s < 1 ? Math.round(s * 1000) + " ms" : s.toFixed(2) + " s")
  const fmtPct = (v) => Math.round(v * 100) + "%"
  const fmtInt = (v) => (v > 0 ? "+" : "") + v
  const fmtCents = (v) => fmtInt(v) + "¢"
  const fmtNum = (v) => Number(v).toFixed(1)

  const btn =
    "rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
</script>

{#snippet slider(key, label, min, max, step, format)}
  <label class="block space-y-1" for={"synth-" + key}>
    <span class="flex items-baseline justify-between text-xs uppercase tracking-wider text-zinc-400">
      <span>{label}</span>
      <span class="font-mono text-amber-300 tabular-nums normal-case">{format(params[key])}</span>
    </span>
    <input
      id={"synth-" + key}
      type="range"
      {min}
      {max}
      {step}
      value={params[key]}
      oninput={(e) => (params[key] = Number(e.currentTarget.value))}
      class="w-full cursor-pointer accent-amber-400"
    />
  </label>
{/snippet}

{#snippet waveSelect(key)}
  <div class="grid grid-cols-4 gap-1 rounded-lg bg-zinc-950/60 p-1" role="group" aria-label="Waveform">
    {#each WAVES as wave}
      <button
        type="button"
        aria-pressed={params[key] === wave}
        onclick={() => (params[key] = wave)}
        class={[
          "rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
          params[key] === wave
            ? "bg-amber-400 text-zinc-900 shadow shadow-amber-400/30"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
        ]}
      >
        {wave === "sawtooth" ? "saw" : wave === "triangle" ? "tri" : wave}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet panel(title, body)}
  <section class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-inner shadow-black/40">
    <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">{title}</h2>
    {@render body()}
  </section>
{/snippet}

{#snippet osc(n)}
  {@render waveSelect(`osc${n}_wave`)}
  {@render slider(`osc${n}_octave`, "Octave", -2, 2, 1, fmtInt)}
  {@render slider(`osc${n}_detune`, "Detune", -50, 50, 1, fmtCents)}
  {@render slider(`osc${n}_level`, "Level", 0, 1, 0.01, fmtPct)}
{/snippet}

{#snippet osc1()}{@render osc(1)}{/snippet}
{#snippet osc2()}{@render osc(2)}{/snippet}

{#snippet filter()}
  <label class="block space-y-1" for="synth-filter_cutoff">
    <span class="flex items-baseline justify-between text-xs uppercase tracking-wider text-zinc-400">
      <span>Cutoff</span>
      <span class="font-mono text-amber-300 tabular-nums normal-case">{fmtHz(params.filter_cutoff)}</span>
    </span>
    <input
      id="synth-filter_cutoff"
      type="range"
      min="0"
      max="1"
      step="0.001"
      value={cutoffPos}
      oninput={(e) => (params.filter_cutoff = Math.round(20 * 900 ** Number(e.currentTarget.value)))}
      class="w-full cursor-pointer accent-amber-400"
    />
  </label>
  {@render slider("filter_resonance", "Resonance", 0, 20, 0.1, fmtNum)}
{/snippet}

{#snippet envelope()}
  {@render slider("attack", "Attack", 0.001, 2, 0.001, fmtSec)}
  {@render slider("decay", "Decay", 0.001, 2, 0.001, fmtSec)}
  {@render slider("sustain", "Sustain", 0, 1, 0.01, fmtPct)}
  {@render slider("release", "Release", 0.01, 4, 0.01, fmtSec)}
{/snippet}

<div class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6">
  <div id="preset-bar" class="flex flex-wrap items-center gap-2">
    <select
      id="preset-select"
      bind:value={selectedId}
      onchange={loadPreset}
      class="min-w-40 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-amber-400/60 focus:border-amber-400 focus:outline-none"
    >
      <option value="">Load preset…</option>
      {#each presets as preset (preset.id)}
        <option value={preset.id}>{preset.name}</option>
      {/each}
    </select>
    <input
      id="preset-name"
      type="text"
      maxlength="60"
      placeholder="Preset name"
      bind:value={presetName}
      class="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 transition focus:border-amber-400 focus:outline-none"
    />
    <button
      id="save-preset"
      type="button"
      disabled={presetName.trim() === ""}
      onclick={savePreset}
      class="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
    >
      Save
    </button>
    <button id="reset-params" type="button" class={btn} onclick={() => (params = { ...DEFAULT_PARAMS })}>
      Reset
    </button>
    <span id="preset-status" class="text-xs text-zinc-400" aria-live="polite">{status}</span>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {@render panel("Osc 1", osc1)}
    {@render panel("Osc 2", osc2)}
    {@render panel("Filter", filter)}
    {@render panel("Envelope", envelope)}
  </div>

  <div class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
    <div class="flex items-center gap-2">
      <button id="octave-down" type="button" class={btn} aria-label="Octave down" onclick={() => shiftOctave(-1)}>−</button>
      <span class="w-20 text-center font-mono text-sm tabular-nums text-zinc-300">Octave {baseOctave}</span>
      <button id="octave-up" type="button" class={btn} aria-label="Octave up" onclick={() => shiftOctave(1)}>+</button>
    </div>
    <p class="text-xs text-zinc-500">Play with A–; keys · Z/X change octave · 1–8 trigger loop pads</p>
    <div class="w-full sm:w-56">
      {@render slider("volume", "Master", 0, 1, 0.01, fmtPct)}
    </div>
  </div>

  <section id="loop-pads" class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
    <div class="flex items-baseline justify-between">
      <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Loops</h2>
      <p class="text-xs text-zinc-500">Tap an empty pad to record, tap again to loop it</p>
    </div>
    <div class="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {#each pads as pad, slot}
        <div class="group relative">
          <button
            id={"loop-pad-" + slot}
            type="button"
            aria-label={`Loop pad ${slot + 1}`}
            aria-pressed={pad.playing || recording === slot}
            onclick={() => tapPad(slot)}
            class={[
              "relative flex aspect-square w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border text-sm font-semibold transition active:scale-95",
              recording === slot
                ? "animate-pulse border-red-500 bg-red-500/15 text-red-300"
                : pad.playing
                  ? "border-amber-400 bg-amber-400/15 text-amber-200 shadow shadow-amber-400/20"
                  : pad.filled
                    ? "border-zinc-600 bg-zinc-800 text-zinc-200 hover:border-amber-400/60 hover:bg-zinc-700"
                    : "border-dashed border-zinc-700 text-zinc-500 hover:border-red-500/60 hover:text-red-300",
            ]}
          >
            <span class="font-mono text-lg">{slot + 1}</span>
            <span class="text-[10px] uppercase tracking-wider opacity-80">
              {recording === slot ? "Done" : pad.filled ? pad.length.toFixed(1) + "s" : "Rec"}
            </span>
            {#if pad.playing}
              <span class="absolute inset-x-0 bottom-0 h-1 bg-amber-400" style="width: {pad.pos * 100}%"></span>
            {/if}
          </button>
          {#if pad.filled || recording === slot}
            <button
              id={"loop-clear-" + slot}
              type="button"
              aria-label={`Clear loop pad ${slot + 1}`}
              onclick={() => clearPad(slot)}
              class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-xs text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:border-red-500 hover:text-red-400 focus:opacity-100 pointer-coarse:opacity-100"
            >
              ×
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </section>

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
        style={key.black ? `left: ${(key.white / whiteCount) * 100}%; width: ${(100 / whiteCount) * 0.6}%; transform: translateX(-50%)` : ""}
        class={[
          "transition-colors duration-75",
          key.black
            ? "absolute top-0 z-10 h-[60%] rounded-b-md border border-black shadow-lg shadow-black/60"
            : "relative h-full flex-1 rounded-b-lg border border-zinc-400 first:rounded-bl-lg",
          key.black && (active.has(key.midi) ? "bg-amber-500" : "bg-zinc-900 hover:bg-zinc-700"),
          !key.black && (active.has(key.midi) ? "bg-amber-300" : "bg-zinc-100 hover:bg-white"),
        ]}
      >
        {#if !key.black && key.midi % 12 === 0}
          <span class="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-zinc-500">{key.label}</span>
        {/if}
      </button>
    {/each}
  </div>
</div>
