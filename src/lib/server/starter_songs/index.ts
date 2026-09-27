import { createSong } from '../music.js'
import midnightArcade from './midnight_arcade.json' with { type: 'json' }

// Songs every new user starts with (exported from the app as JSON: name, synth,
// drums, loops, arrangement).
export const STARTER_SONGS: unknown[] = [midnightArcade]

// Gives a new user their own copy of each starter song.
export async function giveStarterSongs(userId: string): Promise<void> {
  for (const song of STARTER_SONGS) await createSong(userId, song)
}
