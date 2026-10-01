import { requireUser } from '$lib/server/auth.js'
import { InvalidError, listPresets, savePreset } from '$lib/server/music.js'
import { captureServerEvent } from '$lib/server/posthog.js'
import { json } from '@sveltejs/kit'

import type { RequestHandler } from './$types'

// Save the synth settings as a preset: { name, params }.
export const POST: RequestHandler = async ({ locals, platform, request }) => {
  const user = requireUser(locals)
  try {
    const preset = await savePreset(user.id, await request.json())
    captureServerEvent(platform, user.id, 'preset_saved')
    return json({ id: preset.id, name: preset.name, ok: true, presets: await listPresets(user.id) })
  } catch (e) {
    if (e instanceof InvalidError) return json({ error: e.message }, { status: 422 })
    throw e
  }
}
