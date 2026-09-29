import { requireUser } from '$lib/server/auth.js'
import { InvalidError, listKits, saveKit } from '$lib/server/music.js'
import { json } from '@sveltejs/kit'

import type { RequestHandler } from './$types'

// Save the drum kit: { name, kit, voices }.
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireUser(locals)
  try {
    const kit = await saveKit(user.id, await request.json())
    return json({ id: kit.id, kits: await listKits(user.id), name: kit.name })
  } catch (e) {
    if (e instanceof InvalidError) return json({ error: e.message }, { status: 422 })
    throw e
  }
}
