import { requireUser } from '$lib/server/auth.js'
import { deleteSong } from '$lib/server/music.js'
import { listSongStats, shareSong, unshareSong } from '$lib/server/sharing.js'
import { fail } from '@sveltejs/kit'

import type { Actions, PageServerLoad } from './$types'

// The signed-in user's songs, with which are shared and their views and likes.
export const load = (async ({ locals }) => {
  const user = requireUser(locals)
  return { songs: await listSongStats(user.id) }
}) satisfies PageServerLoad

async function songId(request: Request): Promise<string> {
  const id = (await request.formData()).get('id')
  return typeof id === 'string' ? id : ''
}

export const actions = {
  // Deletes a song for good, with its link, views and likes.
  delete: async ({ locals, request }) => {
    const user = requireUser(locals)
    return (await deleteSong(user.id, await songId(request)))
      ? { deleted: true }
      : fail(404, { error: 'Song not found' })
  },
  // Shares a song (its link stays the same if it's already shared).
  share: async ({ locals, request }) => {
    const user = requireUser(locals)
    const shareId = await shareSong(user.id, await songId(request))
    return shareId ? { shared: shareId } : fail(404, { error: 'Song not found' })
  },
  // Stops sharing a song: its link stops working.
  unshare: async ({ locals, request }) => {
    const user = requireUser(locals)
    return (await unshareSong(user.id, await songId(request)))
      ? { unshared: true }
      : fail(404, { error: 'Song not found' })
  }
} satisfies Actions
