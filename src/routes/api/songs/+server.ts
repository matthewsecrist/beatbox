import { requireUser } from '$lib/server/auth.js'
import { createSong, InvalidError, listSongs } from '$lib/server/music.js'
import { json } from '@sveltejs/kit'

import type { RequestHandler } from './$types'

// Save a new song: { name, synth, drums, loops, arrangement }.
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireUser(locals)
  try {
    const song = await createSong(user.id, await request.json())
    return json({ song: { id: song.id, name: song.name }, songs: await listSongs(user.id) })
  } catch (e) {
    if (e instanceof InvalidError) return json({ error: e.message }, { status: 422 })
    throw e
  }
}
