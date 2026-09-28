import { listExamples } from '$lib/server/examples/index.js'
import { listPresets, listSongs } from '$lib/server/music.js'

import type { PageServerLoad } from './$types'

// A new, unsaved song. `key` is fresh on every load, so New remounts the instruments.
// Signed-out visitors get it too, with nothing saved to list.
export const load = (async ({ locals, url }) => {
  const user = locals.user
  return {
    example: null,
    examples: listExamples(),
    key: crypto.randomUUID(),
    notice: url.searchParams.has('missing') ? 'Song not found' : null,
    presets: user ? await listPresets(user.id) : [],
    shared: null,
    signedIn: user !== null,
    song: null,
    songs: user ? await listSongs(user.id) : []
  }
}) satisfies PageServerLoad
