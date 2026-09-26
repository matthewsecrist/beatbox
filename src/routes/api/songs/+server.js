import { json } from "@sveltejs/kit"
import { createSong, InvalidError, listSongs } from "$lib/server/music.js"

// Save a new song: { name, synth, drums, loops, arrangement }.
export async function POST({ request }) {
  try {
    const song = await createSong(await request.json())
    return json({ song: { id: song.id, name: song.name }, songs: await listSongs() })
  } catch (e) {
    if (e instanceof InvalidError) return json({ error: e.message }, { status: 422 })
    throw e
  }
}
