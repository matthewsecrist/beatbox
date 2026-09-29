import { requireUser } from '$lib/server/auth.js'
import { getKit } from '$lib/server/music.js'
import { json } from '@sveltejs/kit'

import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, params }) => {
  const kit = await getKit(requireUser(locals).id, params.id)
  if (!kit) return json({ error: 'Kit not found' }, { status: 404 })
  return json({ kit: kit.kit, name: kit.name, voices: kit.voices })
}
