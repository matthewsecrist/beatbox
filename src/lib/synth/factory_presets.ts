import type { SynthParams } from '../types.js'

// Built-in sounds. Loaded over DEFAULT_PARAMS; master volume is left as-is.
export const FACTORY_PRESETS: { name: string; params: Omit<SynthParams, 'volume'> }[] = [
  {
    name: 'Dubstep Wobble',
    params: {
      attack: 0.005,
      decay: 0.1,
      filter_cutoff: 280,
      filter_resonance: 12,
      lfo_depth: 3.5, // ≈ 1/8 notes at 140 BPM
      lfo_rate: 4.7,
      osc1_detune: 0,
      osc1_level: 0.7,
      osc1_octave: -1,
      osc1_wave: 'sawtooth',
      osc2_detune: 8,
      osc2_level: 0.6,
      osc2_octave: -2,
      osc2_wave: 'square',
      release: 0.15,
      sustain: 1
    }
  },
  {
    name: 'Reese Bass',
    params: {
      attack: 0.01,
      decay: 0.3,
      filter_cutoff: 700,
      filter_resonance: 4,
      lfo_depth: 0.8,
      lfo_rate: 0.2,
      osc1_detune: -15,
      osc1_level: 0.6,
      osc1_octave: -1,
      osc1_wave: 'sawtooth',
      osc2_detune: 15,
      osc2_level: 0.6,
      osc2_octave: -1,
      osc2_wave: 'sawtooth',
      release: 0.3,
      sustain: 0.9
    }
  },
  {
    name: 'Deep Sub',
    params: {
      attack: 0.005,
      decay: 0.3,
      filter_cutoff: 600,
      filter_resonance: 1,
      lfo_depth: 0,
      lfo_rate: 4,
      osc1_detune: 0,
      osc1_level: 0.9,
      osc1_octave: -1,
      osc1_wave: 'sine',
      osc2_detune: 0,
      osc2_level: 0.4,
      osc2_octave: -2,
      osc2_wave: 'triangle',
      release: 0.15,
      sustain: 0.9
    }
  },
  {
    name: 'Supersaw Lead',
    params: {
      attack: 0.01,
      decay: 0.2,
      filter_cutoff: 5000,
      filter_resonance: 2,
      lfo_depth: 0,
      lfo_rate: 4,
      osc1_detune: -12,
      osc1_level: 0.6,
      osc1_octave: 0,
      osc1_wave: 'sawtooth',
      osc2_detune: 12,
      osc2_level: 0.6,
      osc2_octave: 0,
      osc2_wave: 'sawtooth',
      release: 0.4,
      sustain: 0.8
    }
  },
  {
    name: 'Warm Pad',
    params: {
      attack: 0.8,
      decay: 1,
      filter_cutoff: 1200,
      filter_resonance: 3,
      lfo_depth: 0.5,
      lfo_rate: 0.3,
      osc1_detune: -5,
      osc1_level: 0.6,
      osc1_octave: 0,
      osc1_wave: 'triangle',
      osc2_detune: 7,
      osc2_level: 0.4,
      osc2_octave: 0,
      osc2_wave: 'sawtooth',
      release: 2,
      sustain: 0.7
    }
  },
  {
    name: 'Pluck',
    params: {
      attack: 0.001,
      decay: 0.25,
      filter_cutoff: 1800,
      filter_resonance: 8,
      lfo_depth: 0,
      lfo_rate: 4,
      osc1_detune: 0,
      osc1_level: 0.6,
      osc1_octave: 0,
      osc1_wave: 'square',
      osc2_detune: 0,
      osc2_level: 0.3,
      osc2_octave: 1,
      osc2_wave: 'sawtooth',
      release: 0.3,
      sustain: 0
    }
  },
  {
    name: 'Chiptune',
    params: {
      attack: 0.001,
      decay: 0.05,
      filter_cutoff: 12000,
      filter_resonance: 0,
      lfo_depth: 0,
      lfo_rate: 4,
      osc1_detune: 0,
      osc1_level: 0.7,
      osc1_octave: 0,
      osc1_wave: 'square',
      osc2_detune: 0,
      osc2_level: 0.2,
      osc2_octave: 1,
      osc2_wave: 'square',
      release: 0.05,
      sustain: 0.8
    }
  },
  {
    name: 'Organ',
    params: {
      attack: 0.01,
      decay: 0.05,
      filter_cutoff: 8000,
      filter_resonance: 0,
      lfo_depth: 0.05, // slight rotary-style shimmer
      lfo_rate: 6,
      osc1_detune: 0,
      osc1_level: 0.7,
      osc1_octave: 0,
      osc1_wave: 'sine',
      osc2_detune: 0,
      osc2_level: 0.5,
      osc2_octave: 1,
      osc2_wave: 'sine',
      release: 0.08,
      sustain: 1
    }
  }
]
