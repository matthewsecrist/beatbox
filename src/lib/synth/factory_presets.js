// Built-in sounds. Loaded over DEFAULT_PARAMS; master volume is left as-is.
export const FACTORY_PRESETS = [
  {
    name: "Dubstep Wobble",
    params: {
      osc1_wave: "sawtooth", osc1_octave: -1, osc1_detune: 0, osc1_level: 0.7,
      osc2_wave: "square", osc2_octave: -2, osc2_detune: 8, osc2_level: 0.6,
      filter_cutoff: 280, filter_resonance: 12,
      lfo_rate: 4.7, lfo_depth: 3.5, // ≈ 1/8 notes at 140 BPM
      attack: 0.005, decay: 0.1, sustain: 1, release: 0.15,
    },
  },
  {
    name: "Reese Bass",
    params: {
      osc1_wave: "sawtooth", osc1_octave: -1, osc1_detune: -15, osc1_level: 0.6,
      osc2_wave: "sawtooth", osc2_octave: -1, osc2_detune: 15, osc2_level: 0.6,
      filter_cutoff: 700, filter_resonance: 4,
      lfo_rate: 0.2, lfo_depth: 0.8,
      attack: 0.01, decay: 0.3, sustain: 0.9, release: 0.3,
    },
  },
  {
    name: "Deep Sub",
    params: {
      osc1_wave: "sine", osc1_octave: -1, osc1_detune: 0, osc1_level: 0.9,
      osc2_wave: "triangle", osc2_octave: -2, osc2_detune: 0, osc2_level: 0.4,
      filter_cutoff: 600, filter_resonance: 1,
      lfo_rate: 4, lfo_depth: 0,
      attack: 0.005, decay: 0.3, sustain: 0.9, release: 0.15,
    },
  },
  {
    name: "Supersaw Lead",
    params: {
      osc1_wave: "sawtooth", osc1_octave: 0, osc1_detune: -12, osc1_level: 0.6,
      osc2_wave: "sawtooth", osc2_octave: 0, osc2_detune: 12, osc2_level: 0.6,
      filter_cutoff: 5000, filter_resonance: 2,
      lfo_rate: 4, lfo_depth: 0,
      attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.4,
    },
  },
  {
    name: "Warm Pad",
    params: {
      osc1_wave: "triangle", osc1_octave: 0, osc1_detune: -5, osc1_level: 0.6,
      osc2_wave: "sawtooth", osc2_octave: 0, osc2_detune: 7, osc2_level: 0.4,
      filter_cutoff: 1200, filter_resonance: 3,
      lfo_rate: 0.3, lfo_depth: 0.5,
      attack: 0.8, decay: 1, sustain: 0.7, release: 2,
    },
  },
  {
    name: "Pluck",
    params: {
      osc1_wave: "square", osc1_octave: 0, osc1_detune: 0, osc1_level: 0.6,
      osc2_wave: "sawtooth", osc2_octave: 1, osc2_detune: 0, osc2_level: 0.3,
      filter_cutoff: 1800, filter_resonance: 8,
      lfo_rate: 4, lfo_depth: 0,
      attack: 0.001, decay: 0.25, sustain: 0, release: 0.3,
    },
  },
  {
    name: "Chiptune",
    params: {
      osc1_wave: "square", osc1_octave: 0, osc1_detune: 0, osc1_level: 0.7,
      osc2_wave: "square", osc2_octave: 1, osc2_detune: 0, osc2_level: 0.2,
      filter_cutoff: 12000, filter_resonance: 0,
      lfo_rate: 4, lfo_depth: 0,
      attack: 0.001, decay: 0.05, sustain: 0.8, release: 0.05,
    },
  },
  {
    name: "Organ",
    params: {
      osc1_wave: "sine", osc1_octave: 0, osc1_detune: 0, osc1_level: 0.7,
      osc2_wave: "sine", osc2_octave: 1, osc2_detune: 0, osc2_level: 0.5,
      filter_cutoff: 8000, filter_resonance: 0,
      lfo_rate: 6, lfo_depth: 0.05, // slight rotary-style shimmer
      attack: 0.01, decay: 0.05, sustain: 1, release: 0.08,
    },
  },
]
