import { redirect } from "@sveltejs/kit"
import { getSong, listPresets, listSongs } from "$lib/server/music.js"

export async function load({ params }) {
  const song = await getSong(params.id)
  if (!song) redirect(303, "/?missing")
  return { presets: await listPresets(), songs: await listSongs(), song, key: song.id, notice: null }
}
