import type { Example, ExampleSummary } from '../../types.js'

import { songSchema } from '../validation.js'
import acidHouse from './acid_house.json' with { type: 'json' }
import badGuy from './bad_guy.json' with { type: 'json' }
import lofi from './lofi.json' with { type: 'json' }
import midnightArcade from './midnight_arcade.json' with { type: 'json' }
import trance from './trance.json' with { type: 'json' }
import trap from './trap.json' with { type: 'json' }

// Example songs anyone can open, signed in or not, by slug (exported from the app
// as JSON: name, synth, performance, effects, drums, loops, arrangement). They live
// in code, not the database: opening one starts an unsaved song, and saving it
// makes the user's own copy. Listed in this order.
const SOURCES: [slug: string, song: unknown][] = [
  ['midnight-arcade', midnightArcade],
  ['acid-house', acidHouse],
  ['trap', trap],
  ['lofi', lofi],
  ['trance', trance],
  ['bad-guy', badGuy]
]

// Checked like a song a client sends, so a bad edit to the JSON fails at startup.
export const EXAMPLES: Example[] = SOURCES.map(([slug, source]) => ({
  ...songSchema.parse(source),
  slug
}))

export const getExample = (slug: string): Example | null =>
  EXAMPLES.find((e) => e.slug === slug) ?? null

export const listExamples = (): ExampleSummary[] =>
  EXAMPLES.map(({ name, slug }) => ({ name, slug }))
