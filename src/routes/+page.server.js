import { listPresets, listSongs } from "$lib/server/music.js"

// A new, unsaved song. `key` is fresh on every load, so New remounts the instruments.
export async function load({ url }) {
  return {
    presets: await listPresets(),
    songs: await listSongs(),
    song: null,
    key: crypto.randomUUID(),
    notice: url.searchParams.has("missing") ? "Song not found" : null,
  }
}
