import { migrate } from 'drizzle-orm/libsql/migrator'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, expect, test } from 'vitest'

import type { Drums, Loop } from '../types.js'

import { db } from './db/index.js'
import { presets, songs } from './db/schema.js'
import * as music from './music.js'
import { InvalidError } from './music.js'

// DATABASE_URL is ":memory:" under Vitest (see vite.config.ts).
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url))
  })
})

beforeEach(async () => {
  await db.delete(presets)
  await db.delete(songs)
})

const loop: Loop = { events: [{ midi: 64, on: true, t: 0 }], length: 2.0, params: {}, slot: 3 }
const drums = (bpm: number): Drums => ({
  bpm,
  patterns: [{ kick: [true] }, { snare: [true] }],
  volume: 0.8
})

async function savedSong(id: string) {
  const song = await music.getSong(id)
  if (!song) throw new Error(`no song ${id}`)
  return song
}

test('saving under an existing name overwrites the preset, dropping unknown params', async () => {
  await music.savePreset({ name: 'Bass', params: { volume: 0.5 } })
  const saved = await music.savePreset({ name: 'Bass', params: { evil: 'x', volume: 0.9 } })

  expect(await music.listPresets()).toStrictEqual([{ id: saved.id, name: 'Bass' }])
  expect((await music.getPreset(saved.id))?.params).toStrictEqual({ volume: 0.9 })
})

test('blank preset names and mistyped params are rejected', async () => {
  await expect(music.savePreset({ name: '   ', params: {} })).rejects.toThrow(InvalidError)
  await expect(music.savePreset({ name: 'Bad', params: { osc1_wave: 'noise' } })).rejects.toThrow(
    InvalidError
  )
})

test('presets and songs are listed by name', async () => {
  for (const name of ['Pad', 'Arp', 'Lead']) {
    await music.savePreset({ name, params: {} })
    await music.createSong({ name })
  }
  expect((await music.listPresets()).map((p) => p.name)).toStrictEqual(['Arp', 'Lead', 'Pad'])
  expect((await music.listSongs()).map((s) => s.name)).toStrictEqual(['Arp', 'Lead', 'Pad'])
})

test('songs keep their parts, drop unknown params, and reject invalid ones', async () => {
  const song = await music.createSong({
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
    { drums: drums(999) }
  ]
  for (const attrs of invalid) {
    await expect(
      music.updateSong(song.id, { name: 'Jam', ...attrs }),
      JSON.stringify(attrs)
    ).rejects.toThrow(InvalidError)
  }
})

test('updating overwrites the song; a missing song gives null', async () => {
  const song = await music.createSong({ name: 'Jam' })
  await music.updateSong(song.id, { drums: drums(120), name: 'Jam v2' })

  expect((await music.listSongs()).map((s) => s.name)).toStrictEqual(['Jam v2'])
  expect((await savedSong(song.id)).drums?.bpm).toBe(120)
  expect(await music.updateSong(crypto.randomUUID(), { name: 'Nope' })).toBe(null)
})

test('song names are unique', async () => {
  await music.createSong({ name: 'Jam' })
  await expect(music.createSong({ name: 'Jam' })).rejects.toThrow(/already been taken/)
})

test('saving without a name picks the next free Untitled name', async () => {
  const first = await music.createSong({ name: '  ' })
  await music.createSong({ name: '' })
  // Re-saving keeps its own name.
  await music.updateSong(first.id, { name: '' })

  expect((await music.listSongs()).map((s) => s.name)).toStrictEqual(['Untitled', 'Untitled 2'])
})
