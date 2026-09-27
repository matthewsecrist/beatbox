import { requireUser } from '$lib/server/auth.js'
import { getPreset } from '$lib/server/music.js'
import { json } from '@sveltejs/kit'

import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, params }) => {
  const preset = await getPreset(requireUser(locals).id, params.id)
  if (!preset) return json({ error: 'Preset not found' }, { status: 404 })
  return json({ name: preset.name, params: preset.params })
}
