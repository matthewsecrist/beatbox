import { z, type ZodError } from 'zod'

const wave = z.enum(['sawtooth', 'sine', 'square', 'triangle'])

// Synth params the app knows about; anything else sent by a client is dropped.
const params = z.object({
  attack: z.number().exactOptional(),
  decay: z.number().exactOptional(),
  filter_cutoff: z.number().exactOptional(),
  filter_resonance: z.number().exactOptional(),
  lfo_depth: z.number().exactOptional(),
  lfo_rate: z.number().exactOptional(),
  osc1_detune: z.number().exactOptional(),
  osc1_level: z.number().exactOptional(),
  osc1_octave: z.number().exactOptional(),
  osc1_wave: wave.exactOptional(),
  osc2_detune: z.number().exactOptional(),
  osc2_level: z.number().exactOptional(),
  osc2_octave: z.number().exactOptional(),
  osc2_wave: wave.exactOptional(),
  release: z.number().exactOptional(),
  sustain: z.number().exactOptional(),
  volume: z.number().exactOptional()
})

const name = (max: number) => z.string().trim().min(1, "can't be blank").max(max)

const steps = z.array(z.boolean()).max(16)

// Drum machine state: tempo, level and patterns A-D of 16 steps.
const drums = z.object({
  bpm: z.int().min(60).max(200),
  // Patterns A-D (index 0-3); arrangement sections pick one by index.
  patterns: z
    .array(
      z.object({
        chat: steps.exactOptional(),
        clap: steps.exactOptional(),
        kick: steps.exactOptional(),
        ohat: steps.exactOptional(),
        snare: steps.exactOptional(),
        tom: steps.exactOptional()
      })
    )
    .min(1)
    .max(4),
  volume: z.number().min(0).max(1)
})

// One recorded loop pad.
const loop = z.object({
  // Tempo the loop was recorded at; playback converts to beats so the loop follows
  // the song tempo. null for loops recorded before tempo sync.
  bpm: z.int().min(60).max(200).nullable().exactOptional(),
  events: z
    .array(z.object({ midi: z.int().min(0).max(127), on: z.boolean(), t: z.number().min(0) }))
    .max(4000),
  // Seconds; one full cycle of the loop.
  length: z.number().min(0.1).max(300),
  // Synth params captured at record time, so the loop keeps its own sound.
  params,
  slot: z.int().min(0).max(7)
})

// One section of the arrangement: which pads and drums play, for how many bars.
const section = z.object({
  bars: z.int().min(1).max(64),
  drums: z.boolean().default(false),
  name: z.string().trim().max(30).nullable().exactOptional(),
  // Loop pad slots (0-7) playing in this section.
  pads: z.array(z.int().min(0).max(7)).max(8).default([]),
  // Which drum pattern (0-3 = A-D) plays when `drums` is on.
  pattern: z.int().min(0).max(3).default(0)
})

export const presetSchema = z.object({ name: name(60), params })

export const songSchema = z.object({
  arrangement: z.array(section).max(64).default([]),
  drums: drums.nullable().default(null),
  loops: z.array(loop).max(8).default([]),
  name: name(60),
  synth: params.nullable().default(null)
})

// "loops.0.events.0.midi: Too big: expected number to be <=127"
export function describe(error: ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'is invalid'
  return issue.path.length ? `${issue.path.map(String).join('.')}: ${issue.message}` : issue.message
}
