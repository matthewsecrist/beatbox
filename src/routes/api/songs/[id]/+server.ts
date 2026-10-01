import { requireUser } from '$lib/server/auth.js'
import { InvalidError, listSongs, updateSong } from '$lib/server/music.js'
import { captureServerEvent } from '$lib/server/posthog.js'
import { json } from '@sveltejs/kit'

import type { RequestHandler } from './$types'

// Overwrite a saved song with the working copy.
export const PUT: RequestHandler = async ({ locals, params, platform, request }) => {
  const user = requireUser(locals)
  try {
    const song = await updateSong(user.id, params.id, await request.json())
    if (!song) return json({ error: 'Song not found' }, { status: 404 })
    captureServerEvent(platform, user.id, 'song_updated')
    return json({ song: { id: song.id, name: song.name }, songs: await listSongs(user.id) })
  } catch (e) {
    if (e instanceof InvalidError) return json({ error: e.message }, { status: 422 })
    throw e
  }
}
