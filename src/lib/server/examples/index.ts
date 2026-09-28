import type { Example, ExampleSummary } from '../../types.js'

import { songSchema } from '../validation.js'
import midnightArcade from './midnight_arcade.json' with { type: 'json' }

// Example songs anyone can open, signed in or not, by slug (exported from the app
// as JSON: name, synth, drums, loops, arrangement). They live in code, not the
// database: opening one starts an unsaved song, and saving it makes the user's own copy.
const SOURCES: Record<string, unknown> = { 'midnight-arcade': midnightArcade }

// Checked like a song a client sends, so a bad edit to the JSON fails at startup.
export const EXAMPLES: Example[] = Object.entries(SOURCES).map(([slug, source]) => ({
  ...songSchema.parse(source),
  slug
}))

export const getExample = (slug: string): Example | null =>
  EXAMPLES.find((e) => e.slug === slug) ?? null

export const listExamples = (): ExampleSummary[] =>
  EXAMPLES.map(({ name, slug }) => ({ name, slug }))
