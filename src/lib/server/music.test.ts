import type { LibSQLDatabase } from 'drizzle-orm/libsql'

import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, expect, test } from 'vitest'

import type { Drums, Loop } from '../types.js'
import type * as schema from './db/schema.js'

import { db } from './db/index.js'
import { presets, songs, users } from './db/schema.js'
import * as music from './music.js'
import { InvalidError } from './music.js'

// DATABASE_URL is ":memory:" under Vitest (see vite.config.ts).
beforeAll(async () => {
  // Tests run on libSQL, never D1.
  await migrate(db as LibSQLDatabase<typeof schema>, {
    migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url))
  })
})

// The user every test acts as; `other` is someone else.
let me: string
let other: string

async function createUser(username: string): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email: `${username}@example.com`, name: username, username })
    .returning()
  if (!user) throw new Error('user insert returned no row')
  return user.id
}

beforeEach(async () => {
  await db.delete(presets)
  await db.delete(songs)
  await db.delete(users)
  me = await createUser('me')
  other = await createUser('other')
})

const loop: Loop = { events: [{ midi: 64, on: true, t: 0 }], length: 2.0, params: {}, slot: 3 }
const drums = (bpm: number): Drums => ({
  bpm,
  patterns: [{ kick: [true] }, { snare: [true] }],
  volume: 0.8
})

async function savedSong(id: string) {
  const song = await music.getSong(me, id)
  if (!song) throw new Error(`no song ${id}`)
  return song
}

test('saving under an existing name overwrites the preset, dropping unknown params', async () => {
  await music.savePreset(me, { name: 'Bass', params: { volume: 0.5 } })
  const saved = await music.savePreset(me, { name: 'Bass', params: { evil: 'x', volume: 0.9 } })

  expect(await music.listPresets(me)).toStrictEqual([{ id: saved.id, name: 'Bass' }])
  expect((await music.getPreset(me, saved.id))?.params).toStrictEqual({ volume: 0.9 })
})

test('blank preset names and mistyped params are rejected', async () => {
  await expect(music.savePreset(me, { name: '   ', params: {} })).rejects.toThrow(InvalidError)
  await expect(
    music.savePreset(me, { name: 'Bad', params: { osc1_wave: 'noise' } })
  ).rejects.toThrow(InvalidError)
  await expect(
    music.savePreset(me, { name: 'Bad', params: { lfo_target: 'volume' } })
  ).rejects.toThrow(InvalidError)
})

test('presets keep their LFO target', async () => {
  const params = { lfo_depth: 20, lfo_target: 'pitch' }
  const saved = await music.savePreset(me, { name: 'Vibrato', params })

  expect((await music.getPreset(me, saved.id))?.params).toStrictEqual(params)
})

test('presets and songs are listed by name', async () => {
  for (const name of ['Pad', 'Arp', 'Lead']) {
    await music.savePreset(me, { name, params: {} })
    await music.createSong(me, { name })
  }
  expect((await music.listPresets(me)).map((p) => p.name)).toStrictEqual(['Arp', 'Lead', 'Pad'])
  expect((await music.listSongs(me)).map((s) => s.name)).toStrictEqual(['Arp', 'Lead', 'Pad'])
})

test('songs keep their parts, drop unknown params, and reject invalid ones', async () => {
  const song = await music.createSong(me, {
    arrangement: [{ bars: 8, drums: true, name: 'Drop', pads: [2], pattern: 1 }],
    drums: drums(140),
    loops: [{ ...loop, params: { evil: 'x', osc1_wave: 'sine' } }],
    name: 'Jam',
    synth: { evil: 'x', filter_cutoff: 300 }
  })

  const saved = await savedSong(song.id)
  expect(saved.synth).toStrictEqual({ filter_cutoff: 300 })
  expect(saved.drums?.bpm).toBe(140)
  expect(saved.loops[0]?.params).toStrictEqual({ osc1_wave: 'sine' })
  expect(saved.arrangement).toStrictEqual([
    { bars: 8, drums: true, name: 'Drop', pads: [2], pattern: 1 }
  ])

  const invalid = [
    { loops: [{ ...loop, events: [{ midi: 128, on: true, t: 0 }] }] },
    { loops: [{ ...loop, slot: 8 }] },
    { arrangement: [{ bars: 4, pads: [8] }] },
    { arrangement: [{ bars: 4, drums: true, pattern: 4 }] },
    { drums: { ...drums(120), patterns: Array<object>(5).fill({}) } },
    { drums: { ...drums(120), patterns: [{ kick: [{ on: true, ratchet: 5 }] }] } },
    { drums: { ...drums(120), swing: 90 } },
    { drums: drums(999) }
  ]
  for (const attrs of invalid) {
    await expect(
      music.updateSong(me, song.id, { name: 'Jam', ...attrs }),
      JSON.stringify(attrs)
    ).rejects.toThrow(InvalidError)
  }
})

test('updating overwrites the song; a missing song gives null', async () => {
  const song = await music.createSong(me, { name: 'Jam' })
  await music.updateSong(me, song.id, { drums: drums(120), name: 'Jam v2' })

  expect((await music.listSongs(me)).map((s) => s.name)).toStrictEqual(['Jam v2'])
  expect((await savedSong(song.id)).drums?.bpm).toBe(120)
  expect(await music.updateSong(me, crypto.randomUUID(), { name: 'Nope' })).toBe(null)
})

test('song names are unique', async () => {
  await music.createSong(me, { name: 'Jam' })
  await expect(music.createSong(me, { name: 'Jam' })).rejects.toThrow(/already been taken/)
})

test('saving without a name picks the next free Untitled name', async () => {
  const first = await music.createSong(me, { name: '  ' })
  await music.createSong(me, { name: '' })
  // Re-saving keeps its own name.
  await music.updateSong(me, first.id, { name: '' })

  expect((await music.listSongs(me)).map((s) => s.name)).toStrictEqual(['Untitled', 'Untitled 2'])
})

test("songs and presets belong to their user; other users' are missing", async () => {
  const song = await music.createSong(other, { name: 'Theirs' })
  const preset = await music.savePreset(other, { name: 'Theirs', params: {} })

  expect(await music.listSongs(me)).toStrictEqual([])
  expect(await music.listPresets(me)).toStrictEqual([])
  expect(await music.getSong(me, song.id)).toBe(null)
  expect(await music.getPreset(me, preset.id)).toBe(null)
  expect(await music.updateSong(me, song.id, { name: 'Mine now' })).toBe(null)
  expect((await music.getSong(other, song.id))?.name).toBe('Theirs')
})

test('names only need to be unique per user', async () => {
  await music.createSong(other, { name: 'Jam' })
  await music.createSong(other, { name: 'Untitled' })
  await music.savePreset(other, { name: 'Bass', params: { volume: 0.1 } })

  await music.createSong(me, { name: 'Jam' })
  await music.createSong(me, { name: '' })
  await music.savePreset(me, { name: 'Bass', params: { volume: 0.9 } })

  expect((await music.listSongs(me)).map((s) => s.name)).toStrictEqual(['Jam', 'Untitled'])
  const [theirs] = await music.listPresets(other)
  expect((await music.getPreset(other, theirs?.id ?? ''))?.params).toStrictEqual({ volume: 0.1 })
})

test('deleting a user deletes their songs and presets', async () => {
  await music.createSong(other, { name: 'Jam' })
  await music.savePreset(other, { name: 'Bass', params: {} })
  await db.delete(users).where(eq(users.id, other))

  expect(await db.select().from(songs)).toStrictEqual([])
  expect(await db.select().from(presets)).toStrictEqual([])
})
