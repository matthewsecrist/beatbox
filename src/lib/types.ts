// Shapes shared by the instruments, the page and the server.

// One drum pattern: 16 steps per track.
export type DrumPattern = Record<TrackId, DrumStep[]>

export interface Drums {
  bpm: number
  // Absent in songs saved before kits: 'classic'.
  kit?: KitId
  // Patterns A-D; saved songs may omit tracks, and store plain on/off steps.
  patterns: Partial<Record<TrackId, SavedStep[]>>[]
  // 50 (straight) to 75: how late every second 16th lands, as MPC-style swing.
  swing?: number
  voices?: Partial<Record<TrackId, Partial<VoiceTweak>>>
  volume: number
}

// One step of a drum track. Settings stay when the step is switched off.
export interface DrumStep {
  accent: boolean
  on: boolean
  // 0-1: chance the step plays each time round.
  probability: number
  // 1-4 hits spread over the step.
  ratchet: number
  // 0-1
  velocity: number
}

// Synthesized drum kits; each voice is built from oscillators and noise.
export type KitId = '606' | '808' | '909' | 'classic' | 'lofi' | 'trap'

// What the synth's LFO modulates: filter cutoff (wobble), pitch (vibrato) or
// level (tremolo).
export type LfoTarget = 'amp' | 'filter' | 'pitch'

// One recorded loop pad.
export interface Loop {
  // Tempo it was recorded at; null/absent for loops recorded before tempo sync.
  bpm?: null | number
  events: LoopEvent[]
  // Seconds; one full cycle of the loop.
  length: number
  // Synth sound it was recorded with (without master volume).
  params: Partial<SynthParams>
  slot: number
}

export interface LoopEvent {
  midi: number
  on: boolean
  // Seconds from the start of the loop.
  t: number
}

export interface PresetSummary {
  id: string
  name: string
}

// A saved step: plain on/off when it has default settings.
export type SavedStep = boolean | Partial<DrumStep>

// Announced by the arranger ahead of each section boundary.
export interface Scene {
  beat: number
  drums: boolean
  index: number
  pads: number[]
  pattern: number
}

// One section of the arrangement.
export interface Section {
  bars: number
  drums: boolean
  name?: null | string
  pads: number[]
  // Drum pattern index (0-3 = A-D) when `drums` is on.
  pattern: number
}

// What a song stores besides its name. null synth/drums mean defaults.
export interface SongDoc {
  arrangement: Section[]
  drums: Drums | null
  loops: Loop[]
  synth: null | Partial<SynthParams>
}

export interface StateDetail {
  playing: boolean
  source: string
}

export interface SynthParams {
  attack: number
  decay: number
  filter_cutoff: number
  filter_resonance: number
  // Units follow lfo_target: octaves (filter), cents (pitch), 0-1 (amp).
  lfo_depth: number
  lfo_rate: number
  // Absent in songs and presets saved before targets: 'filter'.
  lfo_target: LfoTarget
  osc1_detune: number
  osc1_level: number
  osc1_octave: number
  osc1_wave: Wave
  osc2_detune: number
  osc2_level: number
  osc2_octave: number
  osc2_wave: Wave
  release: number
  sustain: number
  volume: number
}

export type TrackId = 'chat' | 'clap' | 'kick' | 'ohat' | 'snare' | 'tom'

// Window events the instruments use to coordinate.
export interface TransportDetail {
  play: boolean
}

// Per-voice adjustment on top of the kit.
export interface VoiceTweak {
  // Multiplier on the kit's decay times (0.25-2).
  decay: number
  // Semitones (-12 to 12).
  tune: number
}
export type Wave = 'sawtooth' | 'sine' | 'square' | 'triangle'

declare global {
  interface WindowEventMap {
    'beatbox:report': CustomEvent<undefined>
    'beatbox:scene': CustomEvent<Scene>
    'beatbox:state': CustomEvent<StateDetail>
    'beatbox:transport': CustomEvent<TransportDetail>
  }
}

export type LoadPresetReply = { error: string } | { name: string; params: Partial<SynthParams> }
// A saved song as the page receives it.
export type SavedSong = PresetSummary & SongDoc

// Replies from the preset endpoints.
export type SavePresetReply =
  { error: string } | { id: string; name: string; ok: true; presets: PresetSummary[] }

export type SaveSongReply = { error: string } | { song: PresetSummary; songs: PresetSummary[] }

// What both song pages load.
export interface WorkspaceData {
  key: string
  notice: null | string
  presets: PresetSummary[]
  // Signed out, the instruments all work but nothing can be saved or opened.
  signedIn: boolean
  song: null | SavedSong
  songs: PresetSummary[]
}
