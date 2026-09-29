import { getExample, listExamples } from '$lib/server/examples/index.js'
import { listKits, listPresets, listSongs } from '$lib/server/music.js'
import { redirect } from '@sveltejs/kit'

import type { PageServerLoad } from './$types'

// An example song, open to everyone, as a new unsaved song: Save makes the user's
// own copy. `key` is fresh on every load, so reopening it starts over.
export const load = (async ({ locals, params }) => {
  const example = getExample(params.slug)
  if (!example) redirect(303, '/?missing')
  const user = locals.user
  return {
    example,
    examples: listExamples(),
    key: crypto.randomUUID(),
    kits: user ? await listKits(user.id) : [],
    notice: null,
    presets: user ? await listPresets(user.id) : [],
    shared: null,
    signedIn: user !== null,
    song: null,
    songs: user ? await listSongs(user.id) : []
  }
}) satisfies PageServerLoad
