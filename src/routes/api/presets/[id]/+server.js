import { json } from "@sveltejs/kit"
import { getPreset } from "$lib/server/music.js"

export async function GET({ params }) {
  const preset = await getPreset(params.id)
  if (!preset) return json({ error: "Preset not found" }, { status: 404 })
  return json({ params: preset.params, name: preset.name })
}
