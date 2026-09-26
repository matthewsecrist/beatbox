import { z } from "zod"

// Synth params the app knows about; anything else sent by a client is dropped.
export const PARAM_KEYS = [
  "osc1_wave", "osc1_octave", "osc1_detune", "osc1_level",
  "osc2_wave", "osc2_octave", "osc2_detune", "osc2_level",
  "filter_cutoff", "filter_resonance", "lfo_rate", "lfo_depth",
  "attack", "decay", "sustain", "release", "volume",
]

const params = z
  .record(z.string(), z.unknown())
  .transform((p) => Object.fromEntries(Object.entries(p).filter(([k]) => PARAM_KEYS.includes(k))))

const name = (max) => z.string().trim().min(1, "can't be blank").max(max)

const steps = z.array(z.boolean()).max(16)

// Drum machine state: tempo, level and patterns A-D of 16 steps.
const drums = z.object({
  bpm: z.int().min(60).max(200),
  volume: z.number().min(0).max(1),
  // Patterns A-D (index 0-3); arrangement sections pick one by index.
  patterns: z
    .array(
      z.object({
        kick: steps.optional(),
        snare: steps.optional(),
        clap: steps.optional(),
        chat: steps.optional(),
        ohat: steps.optional(),
        tom: steps.optional(),
      }),
    )
    .min(1)
    .max(4),
})

// One recorded loop pad.
const loop = z.object({
  slot: z.int().min(0).max(7),
  // Seconds; one full cycle of the loop.
  length: z.number().min(0.1).max(300),
  // Tempo the loop was recorded at; playback converts to beats so the loop follows
  // the song tempo. null for loops recorded before tempo sync.
  bpm: z.int().min(60).max(200).nullish(),
  events: z
    .array(z.object({ t: z.number().min(0), midi: z.int().min(0).max(127), on: z.boolean() }))
    .max(4000),
  // Synth params captured at record time, so the loop keeps its own sound.
  params,
})

// One section of the arrangement: which pads and drums play, for how many bars.
const section = z.object({
  name: z.string().trim().max(30).nullish(),
  bars: z.int().min(1).max(64),
  drums: z.boolean().default(false),
  // Which drum pattern (0-3 = A-D) plays when `drums` is on.
  pattern: z.int().min(0).max(3).default(0),
  // Loop pad slots (0-7) playing in this section.
  pads: z.array(z.int().min(0).max(7)).max(8).default([]),
})

export const presetSchema = z.object({ name: name(60), params })

export const songSchema = z.object({
  name: name(60),
  synth: params.nullish().default(null),
  drums: drums.nullish().default(null),
  loops: z.array(loop).max(8).default([]),
  arrangement: z.array(section).max(64).default([]),
})

// "loops.0.events.0.midi: Too big: expected number to be <=127"
export function describe(error) {
  const issue = error.issues[0]
  return issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message
}
