import { InvalidError, listPresets, savePreset } from '$lib/server/music.js'
import { json } from '@sveltejs/kit'

import type { RequestHandler } from './$types'

// Save the synth settings as a preset: { name, params }.
export const POST: RequestHandler = async ({ request }) => {
  try {
    const preset = await savePreset(await request.json())
    return json({ id: preset.id, name: preset.name, ok: true, presets: await listPresets() })
  } catch (e) {
    if (e instanceof InvalidError) return json({ error: e.message }, { status: 422 })
    throw e
  }
}
