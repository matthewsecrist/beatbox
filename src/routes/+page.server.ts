import { requireUser } from '$lib/server/auth.js'
import { listPresets, listSongs } from '$lib/server/music.js'

import type { PageServerLoad } from './$types'

// A new, unsaved song. `key` is fresh on every load, so New remounts the instruments.
export const load = (async ({ locals, url }) => {
  const user = requireUser(locals)
  return {
    key: crypto.randomUUID(),
    notice: url.searchParams.has('missing') ? 'Song not found' : null,
    presets: await listPresets(user.id),
    song: null,
    songs: await listSongs(user.id)
  }
}) satisfies PageServerLoad
