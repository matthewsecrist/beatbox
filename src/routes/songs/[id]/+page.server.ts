import { requireUser } from '$lib/server/auth.js'
import { getSong, listPresets, listSongs } from '$lib/server/music.js'
import { redirect } from '@sveltejs/kit'

import type { PageServerLoad } from './$types'

export const load = (async ({ locals, params }) => {
  const user = requireUser(locals)
  const song = await getSong(user.id, params.id)
  if (!song) redirect(303, '/?missing')
  return {
    key: song.id,
    notice: null,
    presets: await listPresets(user.id),
    signedIn: true,
    song,
    songs: await listSongs(user.id)
  }
}) satisfies PageServerLoad
