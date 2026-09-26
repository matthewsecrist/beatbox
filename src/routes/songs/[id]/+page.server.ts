import { getSong, listPresets, listSongs } from '$lib/server/music.js'
import { redirect } from '@sveltejs/kit'

import type { PageServerLoad } from './$types'

export const load = (async ({ params }) => {
  const song = await getSong(params.id)
  if (!song) redirect(303, '/?missing')
  return {
    key: song.id,
    notice: null,
    presets: await listPresets(),
    song,
    songs: await listSongs()
  }
}) satisfies PageServerLoad
