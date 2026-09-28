import type { SynthParams } from '../types.js'

// Built-in sounds, listed by name. Loaded over DEFAULT_PARAMS; master volume is left as-is.
export const FACTORY_PRESETS: { name: string; params: Omit<SynthParams, 'volume'> }[] = [
  {
    name: 'Acid Bass',
    params: {
      attack: 0.001,
      decay: 0.18,
      filter_cutoff: 450,
      filter_resonance: 16,
      lfo_depth: 0,
      lfo_rate: 4,
      lfo_target: 'filter',
      osc1_detune: 0,
      osc1_level: 0.7,
      osc1_octave: -1,
      osc1_wave: 'sawtooth',
      osc2_detune: 0,
      osc2_level: 0,
      osc2_octave: -1,
      osc2_wave: 'square',
      release: 0.08,
      sustain: 0.3
    }
  },
  {
    name: 'Bell',
    params: {
      attack: 0.001,
      decay: 1.8,
      filter_cutoff: 9000,
      filter_resonance: 0,
      lfo_depth: 0,
      lfo_rate: 4,
      lfo_target: 'filter',
      osc1_detune: 0,
      osc1_level: 0.6,
      osc1_octave: 0,
      osc1_wave: 'sine',
      osc2_detune: 14, // inharmonic partial
      osc2_level: 0.35,
      osc2_octave: 2,
      osc2_wave: 'sine',
      release: 1.8,
      sustain: 0
    }
  },
  {
    name: 'Brass',
    params: {
      attack: 0.06,
      decay: 0.3,
      filter_cutoff: 2200,
      filter_resonance: 3,
      lfo_depth: 0,
      lfo_rate: 4,
      lfo_target: 'filter',
      osc1_detune: -4,
      osc1_level: 0.6,
      osc1_octave: 0,
      osc1_wave: 'sawtooth',
      osc2_detune: 4,
      osc2_level: 0.4,
      osc2_octave: 0,
      osc2_wave: 'square',
      release: 0.2,
      sustain: 0.75
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
      lfo_target: 'filter',
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
    name: 'Deep Sub',
    params: {
      attack: 0.005,
      decay: 0.3,
      filter_cutoff: 600,
      filter_resonance: 1,
      lfo_depth: 0,
      lfo_rate: 4,
      lfo_target: 'filter',
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
    name: 'Dubstep Wobble',
    params: {
      attack: 0.005,
      decay: 0.1,
      filter_cutoff: 280,
      filter_resonance: 12,
      lfo_depth: 3.5, // ≈ 1/8 notes at 140 BPM
      lfo_rate: 4.7,
      lfo_target: 'filter',
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
    name: 'Electric Piano',
    params: {
      attack: 0.002,
      decay: 1.2,
      filter_cutoff: 3000,
      filter_resonance: 1,
      lfo_depth: 0.1, // gentle tremolo-like shimmer
      lfo_rate: 5,
      lfo_target: 'filter',
      osc1_detune: 0,
      osc1_level: 0.7,
      osc1_octave: 0,
      osc1_wave: 'sine',
      osc2_detune: 3,
      osc2_level: 0.25,
      osc2_octave: 1,
      osc2_wave: 'triangle',
      release: 0.5,
      sustain: 0.2
    }
  },
  {
    name: 'Flute',
    params: {
      attack: 0.08,
      decay: 0.2,
      filter_cutoff: 2500,
      filter_resonance: 0,
      lfo_depth: 0.08,
      lfo_rate: 5,
      lfo_target: 'filter',
      osc1_detune: 0,
      osc1_level: 0.7,
      osc1_octave: 0,
      osc1_wave: 'triangle',
      osc2_detune: 0,
      osc2_level: 0.2,
      osc2_octave: 1,
      osc2_wave: 'sine',
      release: 0.15,
      sustain: 0.9
    }
  },
  {
    name: 'Hoover',
    params: {
      attack: 0.02,
      decay: 0.4,
      filter_cutoff: 2800,
      filter_resonance: 2,
      lfo_depth: 0.6,
      lfo_rate: 0.5,
      lfo_target: 'filter',
      osc1_detune: -35,
      osc1_level: 0.6,
      osc1_octave: 0,
      osc1_wave: 'sawtooth',
      osc2_detune: 30,
      osc2_level: 0.6,
      osc2_octave: -1,
      osc2_wave: 'sawtooth',
      release: 0.5,
      sustain: 0.9
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
      lfo_target: 'filter',
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
      lfo_target: 'filter',
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
    name: 'Reese Bass',
    params: {
      attack: 0.01,
      decay: 0.3,
      filter_cutoff: 700,
      filter_resonance: 4,
      lfo_depth: 0.8,
      lfo_rate: 0.2,
      lfo_target: 'filter',
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
    name: 'Square Lead',
    params: {
      attack: 0.005,
      decay: 0.15,
      filter_cutoff: 4000,
      filter_resonance: 4,
      lfo_depth: 0,
      lfo_rate: 4,
      lfo_target: 'filter',
      osc1_detune: -6,
      osc1_level: 0.6,
      osc1_octave: 0,
      osc1_wave: 'square',
      osc2_detune: 6,
      osc2_level: 0.4,
      osc2_octave: 0,
      osc2_wave: 'square',
      release: 0.2,
      sustain: 0.8
    }
  },
  {
    name: 'Strings',
    params: {
      attack: 0.4,
      decay: 0.5,
      filter_cutoff: 3200,
      filter_resonance: 1,
      lfo_depth: 0.15,
      lfo_rate: 5.5,
      lfo_target: 'filter',
      osc1_detune: -9,
      osc1_level: 0.5,
      osc1_octave: 0,
      osc1_wave: 'sawtooth',
      osc2_detune: 9,
      osc2_level: 0.5,
      osc2_octave: 0,
      osc2_wave: 'sawtooth',
      release: 1.2,
      sustain: 0.85
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
      lfo_target: 'filter',
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
      lfo_target: 'filter',
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
  }
]
