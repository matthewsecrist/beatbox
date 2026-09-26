<script>
  import { onMount } from "svelte"
  import { SvelteSet } from "svelte/reactivity"
  import { DEFAULT_PARAMS, createSynth } from "./synth/engine.js"

  let { presets = [], live } = $props()

  let params = $state({ ...DEFAULT_PARAMS })
  let presetName = $state("")
  let selectedId = $state("")
  let status = $state("")
  let baseOctave = $state(4)
  const active = new SvelteSet()
  const heldKeys = new Map()
  let synth = null
  let statusTimer

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
  }

  function release(midi) {
    if (!active.has(midi)) return
    active.delete(midi)
    synth.noteOff(midi)
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
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
      clearTimeout(statusTimer)
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
    <p class="text-xs text-zinc-500">Play with A–; keys · Z/X change octave</p>
    <div class="w-full sm:w-56">
      {@render slider("volume", "Master", 0, 1, 0.01, fmtPct)}
    </div>
  </div>

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
