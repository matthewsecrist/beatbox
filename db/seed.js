// Seeds built-in songs. Run with `npm run db:seed` (also part of `npm run setup`).
// Idempotent: a song that already exists by name is left alone, so edits made in
// the app are never overwritten.
import { readdir, readFile } from "node:fs/promises"
import { createSong, listSongs } from "../src/lib/server/music.js"

const dir = new URL("./seeds/", import.meta.url)
const existing = new Set((await listSongs()).map((s) => s.name))

// Each file is a song exported from the app: name, synth, drums, loops, arrangement.
for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
  const song = JSON.parse(await readFile(new URL(file, dir), "utf8"))
  if (existing.has(song.name)) {
    console.log(`Seed song “${song.name}” already exists, skipping`)
  } else {
    await createSong(song)
    console.log(`Seeded song “${song.name}”`)
  }
}
