import { eq } from 'drizzle-orm'
import { randomInt } from 'node:crypto'

import { db } from './db/index.js'
import { users } from './db/schema.js'

const ADJECTIVES = [
  'analog',
  'bouncy',
  'cosmic',
  'crunchy',
  'deep',
  'dusty',
  'electric',
  'funky',
  'fuzzy',
  'groovy',
  'hazy',
  'lofi',
  'lucky',
  'mellow',
  'neon',
  'punchy',
  'retro',
  'shiny',
  'smooth',
  'sonic',
  'swift',
  'velvet',
  'warm',
  'wobbly'
]

const NOUNS = [
  'arp',
  'bassline',
  'beat',
  'chord',
  'drum',
  'echo',
  'fader',
  'groove',
  'hihat',
  'kick',
  'loop',
  'melody',
  'octave',
  'pad',
  'reverb',
  'rhythm',
  'sample',
  'snare',
  'synth',
  'tempo',
  'vinyl',
  'wave'
]

const pick = (words: string[], random: (max: number) => number): string =>
  words[random(words.length)] ?? ''

// A random username nobody has yet. There are millions to pick from, so a few
// tries is plenty.
export async function generateUsername(random?: (max: number) => number): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const username = randomUsername(random)
    const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, username))
    if (taken.length === 0) return username
  }
  throw new Error('no free username after 10 tries')
}

// "neon-bassline-4821". `random(max)` returns an integer in [0, max).
export function randomUsername(random: (max: number) => number = randomInt): string {
  return `${pick(ADJECTIVES, random)}-${pick(NOUNS, random)}-${String(1000 + random(9000))}`
}
