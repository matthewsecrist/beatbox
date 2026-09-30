import { z, type ZodError } from 'zod'

import { INSTRUMENT_IDS } from '../drums/kits.js'
import { LFO_NOTES } from '../synth/engine.js'

const wave = z.enum(['sawtooth', 'sine', 'square', 'triangle'])
const lfoTarget = z.enum(['amp', 'filter', 'pitch'])
const lfoNote = z.enum(LFO_NOTES)

// Synth params the app knows about; anything else sent by a client is dropped.
const params = z.object({
  attack: z.number().exactOptional(),
  decay: z.number().exactOptional(),
  drive: z.number().min(0).max(1).exactOptional(),
  drive_mix: z.number().min(0).max(1).exactOptional(),
  drive_type: z.enum(['fold', 'hard', 'soft', 'tube']).exactOptional(),
  filter_attack: z.number().exactOptional(),
  filter_cutoff: z.number().exactOptional(),
  filter_decay: z.number().exactOptional(),
  filter_env_amount: z.number().exactOptional(),
  filter_release: z.number().exactOptional(),
  filter_resonance: z.number().exactOptional(),
  filter_sustain: z.number().exactOptional(),
  filter_type: z.enum(['bandpass', 'highpass', 'lowpass', 'notch']).exactOptional(),
  filter_velocity: z.number().min(0).max(1).exactOptional(),
  glide: z.number().min(0).max(1).exactOptional(),
  glide_mode: z.enum(['always', 'legato']).exactOptional(),
  lfo1_depth: z.number().exactOptional(),
  lfo1_note: lfoNote.exactOptional(),
  lfo1_rate: z.number().exactOptional(),
  lfo1_sync: z.boolean().exactOptional(),
  lfo1_target: lfoTarget.exactOptional(),
  lfo2_depth: z.number().exactOptional(),
  lfo2_note: lfoNote.exactOptional(),
  lfo2_rate: z.number().exactOptional(),
  lfo2_sync: z.boolean().exactOptional(),
  lfo2_target: lfoTarget.exactOptional(),
  noise_level: z.number().min(0).max(1).exactOptional(),
  osc1_detune: z.number().exactOptional(),
  osc1_level: z.number().exactOptional(),
  osc1_octave: z.number().exactOptional(),
  osc1_wave: wave.exactOptional(),
  osc2_detune: z.number().exactOptional(),
  osc2_level: z.number().exactOptional(),
  osc2_octave: z.number().exactOptional(),
  osc2_wave: wave.exactOptional(),
  pitch_env_amount: z.number().min(-48).max(48).exactOptional(),
  pitch_env_decay: z.number().min(0.001).max(2).exactOptional(),
  release: z.number().exactOptional(),
  sub_level: z.number().min(0).max(1).exactOptional(),
  sustain: z.number().exactOptional(),
  volume: z.number().exactOptional()
})

const name = (max: number) => z.string().trim().min(1, "can't be blank").max(max)

// A step is plain on/off, or carries its own velocity, accent, probability and ratchet.
const steps = z
  .array(
    z.union([
      z.boolean(),
      z.object({
        accent: z.boolean().exactOptional(),
        on: z.boolean().exactOptional(),
        probability: z.number().min(0).max(1).exactOptional(),
        ratchet: z.int().min(1).max(4).exactOptional(),
        velocity: z.number().min(0).max(1).exactOptional()
      })
    ])
  )
  .max(16)

const voice = z.object({
  decay: z.number().min(0.25).max(2).exactOptional(),
  sound: z.enum(INSTRUMENT_IDS).exactOptional(),
  tune: z.number().min(-12).max(12).exactOptional()
})

// Each drum track's tune, decay and library sound, on top of the kit.
const voices = z.object({
  chat: voice.exactOptional(),
  clap: voice.exactOptional(),
  conga: voice.exactOptional(),
  cowbell: voice.exactOptional(),
  crash: voice.exactOptional(),
  kick: voice.exactOptional(),
  ohat: voice.exactOptional(),
  ride: voice.exactOptional(),
  rim: voice.exactOptional(),
  shaker: voice.exactOptional(),
  snap: voice.exactOptional(),
  snare: voice.exactOptional(),
  tom: voice.exactOptional(),
  woodblock: voice.exactOptional()
})

const kit = z.enum(['606', '808', '909', 'classic', 'lofi', 'trap'])

// Drum machine state: tempo, feel, kit, level and patterns A-D of 16 steps.
const drums = z.object({
  bpm: z.int().min(60).max(200),
  humanize: z.number().min(0).max(1).exactOptional(),
  kit: kit.exactOptional(),
  // Patterns A-D (index 0-3); arrangement sections pick one by index.
  patterns: z
    .array(
      z.object({
        chat: steps.exactOptional(),
        clap: steps.exactOptional(),
        conga: steps.exactOptional(),
        cowbell: steps.exactOptional(),
        crash: steps.exactOptional(),
        kick: steps.exactOptional(),
        ohat: steps.exactOptional(),
        ride: steps.exactOptional(),
        rim: steps.exactOptional(),
        shaker: steps.exactOptional(),
        snap: steps.exactOptional(),
        snare: steps.exactOptional(),
        tom: steps.exactOptional(),
        woodblock: steps.exactOptional()
      })
    )
    .min(1)
    .max(4),
  swing: z.number().min(50).max(75).exactOptional(),
  voices: voices.exactOptional(),
  volume: z.number().min(0).max(1)
})

// One recorded loop pad.
const loop = z.object({
  // Tempo the loop was recorded at; playback converts to beats so the loop follows
  // the song tempo. null for loops recorded before tempo sync.
  bpm: z.int().min(60).max(200).nullable().exactOptional(),
  events: z
    .array(
      z.object({
        midi: z.int().min(0).max(127),
        on: z.boolean(),
        t: z.number().min(0),
        velocity: z.number().min(0).max(1).exactOptional()
      })
    )
    .max(4000),
  // Seconds; one full cycle of the loop.
  length: z.number().min(0.1).max(300),
  // Synth params captured at record time, so the loop keeps its own sound.
  params,
  slot: z.int().min(0).max(7)
})

// Chord and arpeggiator settings for the synth keyboard.
const performance = z.object({
  arp: z.enum(['down', 'off', 'random', 'up', 'updown']).exactOptional(),
  arp_rate: z.enum(['1/4', '1/8', '1/8t', '1/16', '1/16t', '1/32']).exactOptional(),
  chord: z
    .enum(['5', '7', 'aug', 'dim', 'maj', 'maj7', 'min', 'min7', 'off', 'sus2', 'sus4'])
    .exactOptional()
})

// Shared delay and reverb, how much of each instrument is sent to them, and the
// master compressor.
const level = z.number().min(0).max(1).exactOptional()
const effects = z.object({
  comp_amount: level,
  comp_on: z.boolean().exactOptional(),
  delay_feedback: z.number().min(0).max(0.9).exactOptional(),
  delay_mix: level,
  delay_pingpong: z.boolean().exactOptional(),
  delay_time: z.enum(['1/2', '1/4', '1/4d', '1/8', '1/8d', '1/8t', '1/16']).exactOptional(),
  drums_delay: level,
  drums_reverb: level,
  reverb_mix: level,
  reverb_size: z.number().min(0.3).max(6).exactOptional(),
  synth_delay: level,
  synth_reverb: level
})

// One section of the arrangement: which pads and drums play, for how many bars,
// and at what tempo (none: the song's).
const section = z.object({
  bars: z.int().min(1).max(64),
  bpm: z.int().min(60).max(200).nullable().exactOptional(),
  drums: z.boolean().default(false),
  name: z.string().trim().max(30).nullable().exactOptional(),
  // Loop pad slots (0-7) playing in this section.
  pads: z.array(z.int().min(0).max(7)).max(8).default([]),
  // Which drum pattern (0-3 = A-D) plays when `drums` is on.
  pattern: z.int().min(0).max(3).default(0)
})

// A saved drum kit: the factory kit it starts from, and its tracks' tweaks.
export const kitSchema = z.object({ kit, name: name(60), voices })

export const presetSchema = z.object({ name: name(60), params })

export const songSchema = z.object({
  arrangement: z.array(section).max(64).default([]),
  drums: drums.nullable().default(null),
  effects: effects.nullable().default(null),
  loops: z.array(loop).max(8).default([]),
  name: name(60),
  performance: performance.nullable().default(null),
  synth: params.nullable().default(null)
})

// "loops.0.events.0.midi: Too big: expected number to be <=127"
export function describe(error: ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'is invalid'
  return issue.path.length ? `${issue.path.map(String).join('.')}: ${issue.message}` : issue.message
}

export const signInSchema = z.object({ email: z.email('enter a valid email address').max(254) })
