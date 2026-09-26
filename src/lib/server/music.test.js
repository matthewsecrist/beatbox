// Run: npm test
import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"

process.env.DATABASE_URL = ":memory:"
const { db } = await import("./db/index.js")
const { presets, songs } = await import("./db/schema.js")
const { migrate } = await import("drizzle-orm/libsql/migrator")
const music = await import("./music.js")
const { InvalidError } = music

await migrate(db, { migrationsFolder: new URL("../../../drizzle", import.meta.url).pathname })

beforeEach(async () => {
  await db.delete(presets)
  await db.delete(songs)
})

const loop = { slot: 3, length: 2.0, params: {}, events: [{ t: 0, midi: 64, on: true }] }
const drums = (bpm) => ({ bpm, volume: 0.8, patterns: [{ kick: [true] }, { snare: [true] }] })

test("saving under an existing name overwrites the preset, dropping unknown params", async () => {
  await music.savePreset({ name: "Bass", params: { volume: 0.5 } })
  const saved = await music.savePreset({ name: "Bass", params: { volume: 0.9, evil: "x" } })

  assert.deepEqual(await music.listPresets(), [{ id: saved.id, name: "Bass" }])
  assert.deepEqual((await music.getPreset(saved.id)).params, { volume: 0.9 })
})

test("blank preset names are rejected", async () => {
  await assert.rejects(music.savePreset({ name: "   ", params: {} }), InvalidError)
})

test("presets and songs are listed by name", async () => {
  for (const name of ["Pad", "Arp", "Lead"]) {
    await music.savePreset({ name, params: {} })
    await music.createSong({ name })
  }
  assert.deepEqual((await music.listPresets()).map((p) => p.name), ["Arp", "Lead", "Pad"])
  assert.deepEqual((await music.listSongs()).map((s) => s.name), ["Arp", "Lead", "Pad"])
})

test("songs keep their parts, drop unknown params, and reject invalid ones", async () => {
  const song = await music.createSong({
    name: "Jam",
    synth: { filter_cutoff: 300, evil: "x" },
    drums: drums(140),
    loops: [{ ...loop, params: { osc1_wave: "sine", evil: "x" } }],
    arrangement: [{ name: "Drop", bars: 8, drums: true, pattern: 1, pads: [2] }],
  })

  const saved = await music.getSong(song.id)
  assert.deepEqual(saved.synth, { filter_cutoff: 300 })
  assert.equal(saved.drums.bpm, 140)
  assert.deepEqual(saved.loops[0].params, { osc1_wave: "sine" })
  assert.deepEqual(saved.arrangement, [{ name: "Drop", bars: 8, drums: true, pattern: 1, pads: [2] }])

  const invalid = [
    { loops: [{ ...loop, events: [{ t: 0, midi: 128, on: true }] }] },
    { loops: [{ ...loop, slot: 8 }] },
    { arrangement: [{ bars: 4, pads: [8] }] },
    { arrangement: [{ bars: 4, drums: true, pattern: 4 }] },
    { drums: { ...drums(120), patterns: Array(5).fill({}) } },
    { drums: drums(999) },
  ]
  for (const attrs of invalid) {
    await assert.rejects(music.updateSong(song.id, { name: "Jam", ...attrs }), InvalidError, JSON.stringify(attrs))
  }
})

test("updating overwrites the song; a missing song gives null", async () => {
  const song = await music.createSong({ name: "Jam" })
  await music.updateSong(song.id, { name: "Jam v2", drums: drums(120) })

  const [only] = await music.listSongs()
  assert.equal(only.name, "Jam v2")
  assert.equal((await music.getSong(song.id)).drums.bpm, 120)
  assert.equal(await music.updateSong(crypto.randomUUID(), { name: "Nope" }), null)
})

test("song names are unique", async () => {
  await music.createSong({ name: "Jam" })
  await assert.rejects(music.createSong({ name: "Jam" }), /already been taken/)
})

test("saving without a name picks the next free Untitled name", async () => {
  const first = await music.createSong({ name: "  " })
  await music.createSong({ name: "" })
  // Re-saving keeps its own name.
  await music.updateSong(first.id, { name: "" })

  assert.deepEqual((await music.listSongs()).map((s) => s.name), ["Untitled", "Untitled 2"])
})
