import { json } from "@sveltejs/kit"
import { InvalidError, listSongs, updateSong } from "$lib/server/music.js"

// Overwrite a saved song with the working copy.
export async function PUT({ params, request }) {
  try {
    const song = await updateSong(params.id, await request.json())
    if (!song) return json({ error: "Song not found" }, { status: 404 })
    return json({ song: { id: song.id, name: song.name }, songs: await listSongs() })
  } catch (e) {
    if (e instanceof InvalidError) return json({ error: e.message }, { status: 422 })
    throw e
  }
}
