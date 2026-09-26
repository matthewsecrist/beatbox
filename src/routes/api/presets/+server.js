import { json } from "@sveltejs/kit"
import { InvalidError, listPresets, savePreset } from "$lib/server/music.js"

// Save the synth settings as a preset: { name, params }.
export async function POST({ request }) {
  try {
    const preset = await savePreset(await request.json())
    return json({ ok: true, id: preset.id, name: preset.name, presets: await listPresets() })
  } catch (e) {
    if (e instanceof InvalidError) return json({ error: e.message }, { status: 422 })
    throw e
  }
}
