export const DEFAULT_PARAMS = {
  osc1_wave: "sawtooth", osc1_octave: 0, osc1_detune: 0, osc1_level: 0.6,
  osc2_wave: "square", osc2_octave: -1, osc2_detune: 7, osc2_level: 0.4,
  filter_cutoff: 2400, filter_resonance: 4,
  lfo_rate: 4, lfo_depth: 0, // LFO sweeps the filter cutoff; depth in octaves
  attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.5,
  volume: 0.7,
}

const MAX_VOICES = 16 // live playing + up to 8 loops share this pool
const HEADROOM = 0.3

const freq = (midi, octave) => 440 * 2 ** ((midi - 69) / 12) * 2 ** octave

export function createSynth(initialParams) {
  let params = { ...DEFAULT_PARAMS, ...initialParams }
  let ctx = null
  let master = null
  const voices = new Map() // key -> voice still held (not yet released)
  const alive = new Set() // every voice until its oscillators end, released or not

  function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = params.volume
      master.connect(ctx.destination)
    }
    if (ctx.state === "suspended") ctx.resume()
  }

  function applyOsc(osc, gain, n, midi, smooth, p = params) {
    const t = ctx.currentTime
    osc.type = p[`osc${n}_wave`]
    const f = freq(midi, p[`osc${n}_octave`])
    const d = p[`osc${n}_detune`]
    const l = p[`osc${n}_level`]
    if (smooth) {
      osc.frequency.setTargetAtTime(f, t, 0.01)
      osc.detune.setTargetAtTime(d, t, 0.01)
      gain.gain.setTargetAtTime(l, t, 0.01)
    } else {
      osc.frequency.value = f
      osc.detune.value = d
      gain.gain.value = l
    }
  }

  // Envelope level at time t, computed from the voice's start so releases can be
  // scheduled in the future (the looper) without reading gain.value.
  function envAt(v, t) {
    const x = t - v.t0
    if (x <= 0) return 0
    if (x < v.attack) return (HEADROOM * x) / v.attack
    if (x < v.attack + v.decay) return HEADROOM + (HEADROOM * v.sustain - HEADROOM) * ((x - v.attack) / v.decay)
    return HEADROOM * v.sustain
  }

  // `time` defaults to the voice's own release (its params may differ from the live ones).
  function release(key, time, at) {
    const v = voices.get(key)
    if (!v) return
    voices.delete(key)
    time ??= v.own ? v.release : params.release
    const t = Math.max(at, ctx.currentTime)
    const g = v.amp.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(envAt(v, t), t)
    g.linearRampToValueAtTime(0, t + time)
    for (const s of v.srcs) s.stop(t + time + 0.05)
  }

  // `at` is an AudioContext time (defaults to now); `key` lets loop voices coexist
  // with live ones on the same pitch; `own` pins the voice to its own params (a
  // recorded loop's sound) instead of following the live controls. Master volume
  // stays global.
  function noteOn(midi, at, key = midi, own = null) {
    ensureContext()
    const p = own ? { ...DEFAULT_PARAMS, ...own } : params
    const t = Math.max(at ?? 0, ctx.currentTime)
    if (voices.has(key)) release(key, undefined, t)
    if (voices.size >= MAX_VOICES) release(voices.keys().next().value, 0.01, ctx.currentTime)

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const g1 = ctx.createGain()
    const g2 = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const amp = ctx.createGain()
    // Per-voice LFO so each note's wobble starts from the same phase.
    const lfo = ctx.createOscillator()
    const lfoDepth = ctx.createGain()

    applyOsc(osc1, g1, 1, midi, false, p)
    applyOsc(osc2, g2, 2, midi, false, p)
    filter.type = "lowpass"
    filter.frequency.value = p.filter_cutoff
    filter.Q.value = p.filter_resonance

    osc1.connect(g1).connect(filter)
    osc2.connect(g2).connect(filter)
    filter.connect(amp).connect(master)
    lfo.frequency.value = p.lfo_rate
    lfoDepth.gain.value = p.lfo_depth * 1200
    lfo.connect(lfoDepth).connect(filter.detune) // cents: 1200 per octave

    const { attack, decay, sustain } = p
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(HEADROOM, t + attack)
    amp.gain.linearRampToValueAtTime(HEADROOM * sustain, t + attack + decay)

    const srcs = [osc1, osc2, lfo]
    const v = { key, midi, own: !!own, release: p.release, t0: t, attack, decay, sustain, srcs, osc1, osc2, g1, g2, filter, amp, lfo, lfoDepth }
    osc1.onended = () => {
      alive.delete(v)
      ;[...srcs, g1, g2, filter, amp, lfoDepth].forEach((n) => n.disconnect())
    }
    for (const s of srcs) s.start(t)

    alive.add(v)
    voices.set(key, v)
  }

  function noteOff(key, at) {
    if (ctx) release(key, undefined, at ?? ctx.currentTime)
  }

  function allNotesOff() {
    for (const key of [...voices.keys()]) noteOff(key)
  }

  // Silence voices matching `match(key)` that are scheduled but haven't started yet,
  // even if their release is already scheduled. Started voices are left alone.
  function cancelPending(match) {
    if (!ctx) return
    for (const v of alive) {
      if (v.t0 <= ctx.currentTime || !match(v.key)) continue
      if (voices.get(v.key) === v) voices.delete(v.key)
      v.amp.disconnect()
      for (const s of v.srcs) s.stop(v.t0)
    }
  }

  function now() {
    ensureContext()
    return ctx.currentTime
  }

  function setParams(p) {
    params = { ...params, ...p }
    if (!ctx) return
    const t = ctx.currentTime
    master.gain.setTargetAtTime(params.volume, t, 0.01)
    for (const v of voices.values()) {
      if (v.own) continue
      v.filter.frequency.setTargetAtTime(params.filter_cutoff, t, 0.01)
      v.filter.Q.setTargetAtTime(params.filter_resonance, t, 0.01)
      v.lfo.frequency.setTargetAtTime(params.lfo_rate, t, 0.01)
      v.lfoDepth.gain.setTargetAtTime(params.lfo_depth * 1200, t, 0.01)
      applyOsc(v.osc1, v.g1, 1, v.midi, true)
      applyOsc(v.osc2, v.g2, 2, v.midi, true)
    }
  }

  return { noteOn, noteOff, allNotesOff, cancelPending, now, setParams }
}
