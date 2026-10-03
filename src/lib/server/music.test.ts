import type { LibSQLDatabase } from 'drizzle-orm/libsql'

import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, expect, test } from 'vitest'

import type { Drums, Loop } from '../types.js'
import type * as schema from './db/schema.js'

import { db } from './db/index.js'
import { kits, presets, songLikes, songs, songViews, users } from './db/schema.js'
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
  await db.delete(kits)
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
    music.savePreset(me, { name: 'Bad', params: { lfo2_target: 'volume' } })
  ).rejects.toThrow(InvalidError)
})

test('presets keep both LFOs', async () => {
  const params = { lfo1_depth: 20, lfo1_target: 'pitch', lfo2_rate: 0.5, lfo2_target: 'filter' }
  const saved = await music.savePreset(me, { name: 'Vibrato', params })

  expect((await music.getPreset(me, saved.id))?.params).toStrictEqual(params)
})

test('a kit saves its factory kit and track tweaks; saving under its name again overwrites it', async () => {
  await music.saveKit(me, { kit: '808', name: 'Boom', voices: { kick: { tune: -3 } } })
  const voices = { conga: { sound: 'bongo' }, snare: { decay: 0.5, sound: '909-snare' } }
  const saved = await music.saveKit(me, { kit: 'trap', name: 'Boom', voices })

  expect(await music.listKits(me)).toStrictEqual([{ id: saved.id, name: 'Boom' }])
  expect(await music.getKit(me, saved.id)).toMatchObject({ kit: 'trap', voices })
  expect(await music.getKit(other, saved.id)).toBe(null)
})

test('kits with an unknown factory kit or sound are rejected', async () => {
  await expect(music.saveKit(me, { kit: '707', name: 'Bad', voices: {} })).rejects.toThrow(
    InvalidError
  )
  await expect(
    music.saveKit(me, { kit: '808', name: 'Bad', voices: { kick: { sound: 'gong' } } })
  ).rejects.toThrow(InvalidError)
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
    arrangement: [
      {
        automation: { evil: [0, 1], master_filter: [0, -0.5], synth_filter: [-2, 0] },
        bars: 8,
        drums: true,
        name: 'Drop',
        pads: [2],
        pattern: 1
      }
    ],
    drums: {
      ...drums(140),
      grids: [16, 24],
      lengths: [{ chat: 12 }, { chat: 20 }],
      patterns: [
        { tom: [false, { decay: 0.5, on: true, tune: -5 }] },
        { chat: Array<boolean>(24).fill(true) }
      ]
    },
    effects: { delay_time: '1/8d', drums_reverb: 0.2, evil: 'x' },
    loops: [{ ...loop, params: { evil: 'x', osc1_wave: 'sine' } }],
    name: 'Jam',
    performance: { arp: 'updown', arp_rate: '1/8t', chord: 'min7' },
    synth: { evil: 'x', filter_cutoff: 300 }
  })

  const saved = await savedSong(song.id)
  expect(saved.synth).toStrictEqual({ filter_cutoff: 300 })
  expect(saved.drums?.bpm).toBe(140)
  expect(saved.drums?.patterns[0]?.tom).toStrictEqual([false, { decay: 0.5, on: true, tune: -5 }])
  expect(saved.drums?.grids).toStrictEqual([16, 24])
  expect(saved.drums?.patterns[1]?.chat).toHaveLength(24)
  expect(saved.drums?.lengths).toStrictEqual([{ chat: 12 }, { chat: 20 }])
  expect(saved.loops[0]?.params).toStrictEqual({ osc1_wave: 'sine' })
  expect(saved.performance).toStrictEqual({ arp: 'updown', arp_rate: '1/8t', chord: 'min7' })
  expect(saved.effects).toStrictEqual({ delay_time: '1/8d', drums_reverb: 0.2 })
  expect(saved.arrangement).toStrictEqual([
    {
      automation: { master_filter: [0, -0.5], synth_filter: [-2, 0] },
      bars: 8,
      drums: true,
      name: 'Drop',
      pads: [2],
      pattern: 1
    }
  ])

  const invalid = [
    { loops: [{ ...loop, events: [{ midi: 128, on: true, t: 0 }] }] },
    { loops: [{ ...loop, slot: 8 }] },
    { arrangement: [{ bars: 4, pads: [8] }] },
    { arrangement: [{ bars: 4, drums: true, pattern: 8 }] },
    { arrangement: [{ automation: { synth_filter: [0, 5] }, bars: 4, pads: [] }] },
    { arrangement: [{ automation: { delay_mix: [-0.1, 0.5] }, bars: 4, pads: [] }] },
    { arrangement: [{ automation: { master_filter: [0] }, bars: 4, pads: [] }] },
    { drums: { ...drums(120), patterns: Array<object>(9).fill({}) } },
    { drums: { ...drums(120), bars: [5], patterns: [{}] } },
    { drums: { ...drums(120), bars: [2], patterns: [{ chat: Array<boolean>(33).fill(true) }] } },
    {
      drums: {
        ...drums(120),
        bars: [2],
        fills: [{ chat: Array<boolean>(32).fill(true) }],
        patterns: [{}]
      }
    },
    { drums: { ...drums(120), patterns: [{ kick: [{ on: true, ratchet: 5 }] }] } },
    { drums: { ...drums(120), patterns: [{ chat: Array<boolean>(24).fill(true) }] } },
    { drums: { ...drums(120), grids: [20], patterns: [{}] } },
    { drums: { ...drums(120), lengths: [{ chat: 20 }], patterns: [{}] } }, // past its 16ths
    { drums: { ...drums(120), lengths: [{ chat: 0 }], patterns: [{}] } },
    { drums: { ...drums(120), patterns: [{ tom: [{ on: true, tune: 13 }] }] } },
    { drums: { ...drums(120), patterns: [{ ohat: [{ decay: 0.1, on: true }] }] } },
    { drums: { ...drums(120), swing: 90 } },
    { drums: drums(999) },
    { performance: { chord: 'blues' } },
    { performance: { arp_rate: '1/3' } },
    { effects: { delay_feedback: 1 } },
    { effects: { synth_reverb: 2 } },
    { effects: { reverb_size: 20 } },
    { effects: { delay_time: '1/3' } }
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

test("deleting a song removes it with its likes and views; other users' songs are missing", async () => {
  const mine = await music.createSong(me, { name: 'Jam' })
  const theirs = await music.createSong(other, { name: 'Theirs' })
  await db.insert(songLikes).values({ songId: mine.id, userId: other })
  await db.insert(songViews).values({ day: '2026-01-01', songId: mine.id, viewer: 'user:x' })

  expect(await music.deleteSong(me, theirs.id)).toBe(false)
  expect(await music.deleteSong(me, mine.id)).toBe(true)
  expect(await music.deleteSong(me, mine.id)).toBe(false)

  expect(await music.listSongs(me)).toStrictEqual([])
  expect((await music.getSong(other, theirs.id))?.name).toBe('Theirs')
  expect(await db.select().from(songLikes)).toStrictEqual([])
  expect(await db.select().from(songViews)).toStrictEqual([])
})

test('deleting a user deletes their songs and presets', async () => {
  await music.createSong(other, { name: 'Jam' })
  await music.savePreset(other, { name: 'Bass', params: {} })
  await db.delete(users).where(eq(users.id, other))

  expect(await db.select().from(songs)).toStrictEqual([])
  expect(await db.select().from(presets)).toStrictEqual([])
})

test('songs preserve per-note bends and reject malformed ramps before storing', async () => {
  const bend = { in: { duration: 128, semitones: -48 }, out: { duration: 0.125, semitones: 48 } }
  const events = [
    { bend, midi: 64, on: true, t: 0 },
    { midi: 64, on: false, t: 1 }
  ]
  const song = await music.createSong(me, { loops: [{ ...loop, events }], name: 'Bends' })
  expect((await savedSong(song.id)).loops[0]?.events).toStrictEqual(events)
  const invalid: unknown[] = [
    {},
    null,
    { into: bend.in },
    { in: {} },
    { in: { duration: 1 } },
    { out: { ...bend.out, duration: 0 } },
    { in: { ...bend.in, duration: -1 } },
    { in: { ...bend.in, duration: 129 } },
    { in: { ...bend.in, duration: Infinity } },
    { in: { ...bend.in, duration: NaN } },
    { in: { ...bend.in, semitones: -49 } },
    { out: { ...bend.out, semitones: 49 } },
    { out: { ...bend.out, semitones: Infinity } },
    { out: { ...bend.out, semitones: NaN } },
    { out: { ...bend.out, semitones: '12' } }
  ]
  for (const malformed of invalid) {
    await expect(
      music.updateSong(me, song.id, {
        loops: [{ ...loop, events: [{ bend: malformed, midi: 64, on: true, t: 0 }] }],
        name: 'Bends'
      })
    ).rejects.toThrow(InvalidError)
  }
  await expect(
    music.updateSong(me, song.id, {
      loops: [{ ...loop, events: [{ bend, midi: 64, on: false, t: 1 }] }],
      name: 'Bends'
    })
  ).rejects.toThrow(InvalidError)
  expect((await savedSong(song.id)).loops[0]?.events).toStrictEqual(events)
})

test('songs preserve pad start bars and reject invalid pad keys and bar values before storing', async () => {
  const arrangement = [{ bars: 4, drums: false, pads: [3], padStarts: { 3: 2 }, pattern: 0 }]
  const song = await music.createSong(me, { arrangement, loops: [loop], name: 'Pad starts' })
  expect((await savedSong(song.id)).arrangement).toStrictEqual(arrangement)
  const invalid: unknown[] = [
    { '-1': 2 },
    { 8: 2 },
    { '3.5': 2 },
    { '03': 2 },
    { pad: 2 },
    { 3: 0 },
    { 3: -1 },
    { 3: 1.5 },
    { 3: 251 },
    { 3: Infinity },
    { 3: NaN },
    { 3: '2' },
    null
  ]
  for (const padStarts of invalid) {
    await expect(
      music.updateSong(me, song.id, {
        arrangement: [{ ...arrangement[0], padStarts }],
        name: 'Pad starts'
      })
    ).rejects.toThrow(InvalidError)
  }
  expect((await savedSong(song.id)).arrangement).toStrictEqual(arrangement)
  const legacy = await music.createSong(me, { arrangement: [{ bars: 4 }], name: 'Legacy' })
  expect((await savedSong(legacy.id)).arrangement[0]).not.toHaveProperty('padStarts')
})
