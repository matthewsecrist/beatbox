import { getPreset } from '$lib/server/music.js'
import { json } from '@sveltejs/kit'

import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params }) => {
  const preset = await getPreset(params.id)
  if (!preset) return json({ error: 'Preset not found' }, { status: 404 })
  return json({ name: preset.name, params: preset.params })
}
