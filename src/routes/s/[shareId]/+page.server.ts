import type { Cookies } from '@sveltejs/kit'

import { resolve } from '$app/paths'
import { listExamples } from '$lib/server/examples/index.js'
import { listKits, listPresets, listSongs } from '$lib/server/music.js'
import { captureServerEvent } from '$lib/server/posthog.js'
import { getSharedSong, hasLiked, recordView, setLiked } from '$lib/server/sharing.js'
import { fail, redirect } from '@sveltejs/kit'

import type { Actions, PageServerLoad } from './$types'

// A signed-out visitor's random id (in a cookie), so their views count once a day.
function browserId(cookies: Cookies): string {
  const saved = cookies.get('viewer')
  if (saved && /^[\w-]{36}$/.test(saved)) return saved
  const id = crypto.randomUUID()
  cookies.set('viewer', id, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax'
  })
  return id
}

// Someone's shared song, open to everyone and listen-only. Opening it counts a view
// (not for its owner, and once a day per visitor); signed-in visitors can like it.
export const load = (async ({ cookies, locals, params, url }) => {
  const shared = await getSharedSong(params.shareId)
  if (!shared) redirect(303, resolve('/') + '?missing')
  const user = locals.user
  const mine = user?.id === shared.ownerId
  let views = shared.views
  if (
    !mine &&
    (await recordView(shared.id, user ? `user:${user.id}` : `browser:${browserId(cookies)}`))
  ) {
    views++
  }
  return {
    example: null,
    examples: listExamples(),
    key: shared.shareId,
    kits: user ? await listKits(user.id) : [],
    notice: null,
    presets: user ? await listPresets(user.id) : [],
    share: {
      // The owner gets a link to edit their song.
      editId: mine ? shared.id : null,
      liked: user && !mine ? await hasLiked(user.id, shared.id) : false,
      likes: shared.likes,
      owner: shared.owner,
      // This page's absolute path, for signing in and coming back here.
      path: url.pathname,
      views
    },
    shared: { name: shared.name, song: shared.song },
    signedIn: user !== null,
    song: null,
    songs: user ? await listSongs(user.id) : []
  }
}) satisfies PageServerLoad

export const actions = {
  // Likes (liked=true) or unlikes the song. Needs an account; owners can't like
  // their own song.
  like: async ({ locals, params, platform, request, url }) => {
    const user = locals.user
    if (!user) {
      const login = new URL(resolve('/login'), url).pathname
      redirect(303, `${login}?next=${encodeURIComponent(url.pathname)}`)
    }
    const shared = await getSharedSong(params.shareId)
    if (!shared) return fail(404, { error: "This song isn't shared any more" })
    if (shared.ownerId === user.id) return fail(403, { error: "You can't like your own song" })
    const liked = (await request.formData()).get('liked') === 'true'
    const likes = await setLiked(user.id, shared.id, liked)
    captureServerEvent(platform, user.id, liked ? 'shared_song_liked' : 'shared_song_unliked')
    return { liked, likes }
  }
} satisfies Actions
