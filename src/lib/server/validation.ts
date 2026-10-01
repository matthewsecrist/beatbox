import { z, type ZodError } from 'zod'

import type { AutomationTarget } from '../types.js'

import { lane } from '../automation.js'
import { INSTRUMENT_IDS } from '../drums/kits.js'
import { LFO_NOTES } from '../synth/engine.js'

const wave = z.enum(['sawtooth', 'sine', 'square', 'triangle'])
const lfoTarget = z.enum(['amp', 'filter', 'pitch'])
const lfoNote = z.enum(LFO_NOTES)
const delayTime = z.enum(['1/2', '1/4', '1/4d', '1/8', '1/8d', '1/8t', '1/16'])

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
  fx_crush: z.number().min(0).max(1).exactOptional(),
  fx_delay_feedback: z.number().min(0).max(0.9).exactOptional(),
  fx_delay_mix: z.number().min(0).max(1).exactOptional(),
  fx_delay_time: delayTime.exactOptional(),
  fx_reverb_mix: z.number().min(0).max(1).exactOptional(),
  fx_reverb_size: z.number().min(0.3).max(6).exactOptional(),
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

// A step is plain on/off, or carries its own velocity, accent, probability and
// ratchet, and any locked tune and decay (the same ranges as a voice's).
const steps = z
  .array(
    z.union([
      z.boolean(),
      z.object({
        accent: z.boolean().exactOptional(),
        decay: z.number().min(0.25).max(2).exactOptional(),
        on: z.boolean().exactOptional(),
        probability: z.number().min(0).max(1).exactOptional(),
        ratchet: z.int().min(1).max(4).exactOptional(),
        tune: z.number().min(-12).max(12).exactOptional(),
        velocity: z.number().min(0).max(1).exactOptional()
      })
    ])
  )
  .max(24)

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

// Steps a track loops over (polymeter), no more than its pattern's grid.
const length = z.int().min(1).max(24).exactOptional()
const lengths = z.object({
  chat: length,
  clap: length,
  conga: length,
  cowbell: length,
  crash: length,
  kick: length,
  ohat: length,
  ride: length,
  rim: length,
  shaker: length,
  snap: length,
  snare: length,
  tom: length,
  woodblock: length
})

const kit = z.enum(['606', '808', '909', 'classic', 'lofi', 'trap'])

// Drum machine state: tempo, feel, kit, level and patterns A-D, each on its own
// grid (16ths, 16th or 8th triplets) with no more steps a bar than it has.
const drums = z
  .object({
    bpm: z.int().min(60).max(200),
    crush: z.number().min(0).max(1).exactOptional(),
    grids: z
      .array(z.union([z.literal(12), z.literal(16), z.literal(24)]))
      .max(4)
      .exactOptional(),
    humanize: z.number().min(0).max(1).exactOptional(),
    kit: kit.exactOptional(),
    // Each pattern's track lengths, A-D.
    lengths: z.array(lengths).max(4).exactOptional(),
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
  .refine(
    ({ grids, patterns }) =>
      patterns.every((p, i) => Object.values(p).every((row) => row.length <= (grids?.[i] ?? 16))),
    { message: 'a pattern has more steps than its grid', path: ['patterns'] }
  )
  .refine(
    ({ grids, lengths }) =>
      (lengths ?? []).every((l, i) => Object.values(l).every((n) => n <= (grids?.[i] ?? 16))),
    { message: 'a track is longer than its grid', path: ['lengths'] }
  )

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

// Shared delay and reverb, how much of each instrument is sent to them, the
// kick's sidechain ducking, and the master stage (compressor, filter, bitcrusher).
const level = z.number().min(0).max(1).exactOptional()
const noteValue = delayTime.exactOptional()
const effects = z.object({
  comp_amount: level,
  comp_on: z.boolean().exactOptional(),
  delay_feedback: z.number().min(0).max(0.9).exactOptional(),
  delay_mix: level,
  delay_pingpong: z.boolean().exactOptional(),
  delay_time: noteValue,
  drums_delay: level,
  drums_reverb: level,
  duck_amount: level,
  duck_release: noteValue,
  master_crush: z.number().min(0.1).max(1).exactOptional(),
  master_crush_mix: level,
  master_filter: z.number().min(-1).max(1).exactOptional(),
  reverb_mix: level,
  reverb_size: z.number().min(0.3).max(6).exactOptional(),
  synth_delay: level,
  synth_reverb: level
})

// A section's ramp for one lane: its start and end values, in the lane's range.
function ramp(id: AutomationTarget) {
  const { max, min } = lane(id)
  const value = z.number().min(min).max(max)
  return z.tuple([value, value]).exactOptional()
}

// One section of the arrangement: which pads and drums play, for how many bars,
// at what tempo (none: the song's), and anything it automates.
const section = z.object({
  automation: z
    .object({
      delay_mix: ramp('delay_mix'),
      drums_delay: ramp('drums_delay'),
      drums_reverb: ramp('drums_reverb'),
      master_crush_mix: ramp('master_crush_mix'),
      master_filter: ramp('master_filter'),
      reverb_mix: ramp('reverb_mix'),
      synth_delay: ramp('synth_delay'),
      synth_filter: ramp('synth_filter'),
      synth_reverb: ramp('synth_reverb')
    })
    .exactOptional(),
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
