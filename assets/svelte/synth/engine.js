export const DEFAULT_PARAMS = {
  osc1_wave: "sawtooth", osc1_octave: 0, osc1_detune: 0, osc1_level: 0.6,
  osc2_wave: "square", osc2_octave: -1, osc2_detune: 7, osc2_level: 0.4,
  filter_cutoff: 2400, filter_resonance: 4,
  attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.5,
  volume: 0.7,
}

const MAX_VOICES = 8
const HEADROOM = 0.3

const freq = (midi, octave) => 440 * 2 ** ((midi - 69) / 12) * 2 ** octave

export function createSynth(initialParams) {
  let params = { ...DEFAULT_PARAMS, ...initialParams }
  let ctx = null
  let master = null
  const voices = new Map()

  function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = params.volume
      master.connect(ctx.destination)
    }
    if (ctx.state === "suspended") ctx.resume()
  }

  function applyOsc(osc, gain, n, midi, smooth) {
    const t = ctx.currentTime
    osc.type = params[`osc${n}_wave`]
    const f = freq(midi, params[`osc${n}_octave`])
    const d = params[`osc${n}_detune`]
    const l = params[`osc${n}_level`]
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

  function release(midi, time) {
    const v = voices.get(midi)
    if (!v) return
    voices.delete(midi)
    const t = ctx.currentTime
    const g = v.amp.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(0, t + time)
    v.osc1.stop(t + time + 0.05)
    v.osc2.stop(t + time + 0.05)
  }

  function noteOn(midi) {
    ensureContext()
    if (voices.has(midi)) noteOff(midi)
    if (voices.size >= MAX_VOICES) release(voices.keys().next().value, 0.01)

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const g1 = ctx.createGain()
    const g2 = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const amp = ctx.createGain()

    applyOsc(osc1, g1, 1, midi, false)
    applyOsc(osc2, g2, 2, midi, false)
    filter.type = "lowpass"
    filter.frequency.value = params.filter_cutoff
    filter.Q.value = params.filter_resonance

    osc1.connect(g1).connect(filter)
    osc2.connect(g2).connect(filter)
    filter.connect(amp).connect(master)

    const t = ctx.currentTime
    const { attack, decay, sustain } = params
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(HEADROOM, t + attack)
    amp.gain.linearRampToValueAtTime(HEADROOM * sustain, t + attack + decay)

    osc1.onended = () => [osc1, osc2, g1, g2, filter, amp].forEach((n) => n.disconnect())
    osc1.start(t)
    osc2.start(t)

    voices.set(midi, { osc1, osc2, g1, g2, filter, amp })
  }

  function noteOff(midi) {
    if (ctx) release(midi, params.release)
  }

  function allNotesOff() {
    for (const midi of [...voices.keys()]) noteOff(midi)
  }

  function setParams(p) {
    params = { ...params, ...p }
    if (!ctx) return
    const t = ctx.currentTime
    master.gain.setTargetAtTime(params.volume, t, 0.01)
    for (const [midi, v] of voices) {
      v.filter.frequency.setTargetAtTime(params.filter_cutoff, t, 0.01)
      v.filter.Q.setTargetAtTime(params.filter_resonance, t, 0.01)
      applyOsc(v.osc1, v.g1, 1, midi, true)
      applyOsc(v.osc2, v.g2, 2, midi, true)
    }
  }

  return { noteOn, noteOff, allNotesOff, setParams }
}
