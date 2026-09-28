// Shapes shared by the instruments, the page and the server.

// Arpeggiator pattern over the held notes; 'off' plays them as they're held.
export type ArpMode = 'down' | 'off' | 'random' | 'up' | 'updown'

// Arpeggiator step: a note value locked to the song tempo ('t' = triplet).
export type ArpRate = '1/4' | '1/8' | '1/8t' | '1/16' | '1/16t' | '1/32'

// Chord one key plays, built up from that key; 'off' plays the key alone.
export type ChordShape =
  '5' | '7' | 'aug' | 'dim' | 'maj7' | 'maj' | 'min7' | 'min' | 'off' | 'sus2' | 'sus4'

// Tempo-synced delay time ('d' = dotted, 't' = triplet).
export type DelayTime = '1/2' | '1/4' | '1/4d' | '1/8' | '1/8d' | '1/8t' | '1/16'

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

// Shared send effects: a tempo-synced delay and a reverb, each fed by a send
// level per instrument and returned at `*_mix`. Sends and mixes are 0-1.
export interface Effects {
  delay_feedback: number // 0-0.9
  delay_mix: number
  delay_time: DelayTime
  drums_delay: number
  drums_reverb: number
  reverb_mix: number
  reverb_size: number // decay in seconds, 0.3-6
  synth_delay: number
  synth_reverb: number
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

// How the synth keyboard turns keys into notes: a chord per key, and the
// arpeggiator. Saved with the song, not in presets or loops (a loop keeps the
// notes they produced).
export interface Performance {
  arp: ArpMode
  arp_rate: ArpRate
  chord: ChordShape
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

// What a song stores besides its name. null synth/drums/effects mean defaults.
export interface SongDoc {
  arrangement: Section[]
  drums: Drums | null
  effects: null | Partial<Effects>
  loops: Loop[]
  performance: null | Partial<Performance>
  synth: null | Partial<SynthParams>
}

export interface StateDetail {
  playing: boolean
  source: string
}

export interface SynthParams {
  attack: number
  decay: number
  // Filter envelope: times in seconds, sustain 0-1, amount in octaves (can be
  // negative; 0 = off).
  filter_attack: number
  filter_cutoff: number
  filter_decay: number
  filter_env_amount: number
  filter_release: number
  filter_resonance: number
  filter_sustain: number
  // Two LFOs, each with its own rate and target. Depth units follow the
  // target: octaves (filter), cents (pitch), 0-1 (amp).
  lfo1_depth: number
  lfo1_rate: number
  lfo1_target: LfoTarget
  lfo2_depth: number
  lfo2_rate: number
  lfo2_target: LfoTarget
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

// A built-in example song, open to everyone. Opening one starts an unsaved song;
// saving it makes the user's own copy.
export type Example = ExampleSummary & SongDoc

export interface ExampleSummary {
  name: string
  slug: string
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
  // The example this page opened, if any (`song` is then null).
  example: Example | null
  examples: ExampleSummary[]
  key: string
  notice: null | string
  presets: PresetSummary[]
  // Signed out, the instruments all work but nothing can be saved, and only the
  // examples can be opened.
  signedIn: boolean
  song: null | SavedSong
  songs: PresetSummary[]
}
