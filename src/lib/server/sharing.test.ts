import type { LibSQLDatabase } from 'drizzle-orm/libsql'

import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, expect, test } from 'vitest'

import type * as schema from './db/schema.js'

import { db } from './db/index.js'
import { songs, users } from './db/schema.js'
import { createSong } from './music.js'
import * as sharing from './sharing.js'

// DATABASE_URL is ":memory:" under Vitest (see vite.config.ts).
beforeAll(async () => {
  await migrate(db as LibSQLDatabase<typeof schema>, {
    migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url))
  })
})

let me: string
let other: string
let songId: string

async function createUser(username: string): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email: `${username}@example.com`, name: username, username })
    .returning()
  if (!user) throw new Error('user insert returned no row')
  return user.id
}

beforeEach(async () => {
  await db.delete(songs)
  await db.delete(users)
  me = await createUser('me')
  other = await createUser('other')
  songId = (await createSong(me, { name: 'Jam', synth: { filter_cutoff: 300 } })).id
})

async function shared(): Promise<string> {
  const shareId = await sharing.shareSong(me, songId)
  if (!shareId) throw new Error('not shared')
  return shareId
}

test('sharing gives an unguessable link that opens the song with its owner; sharing again keeps it', async () => {
  const shareId = await shared()

  expect(shareId).toMatch(/^[\w-]{22}$/) // 128 random bits
  expect(await sharing.shareSong(me, songId)).toBe(shareId)
  expect(await sharing.getSharedSong(shareId)).toMatchObject({
    id: songId,
    likes: 0,
    name: 'Jam',
    owner: 'me',
    song: { synth: { filter_cutoff: 300 } },
    views: 0
  })
})

test('only the owner can share; unsharing kills the link, and sharing again makes a new one', async () => {
  expect(await sharing.shareSong(other, songId)).toBe(null)
  const first = await shared()

  expect(await sharing.unshareSong(other, songId)).toBe(false)
  expect(await sharing.getSharedSong(first)).not.toBe(null)
  expect(await sharing.unshareSong(me, songId)).toBe(true)
  expect(await sharing.getSharedSong(first)).toBe(null)

  const second = await shared()
  expect(second).not.toBe(first)
  expect(await sharing.getSharedSong(first)).toBe(null)
})

test('a view counts once per viewer per day', async () => {
  const shareId = await shared()
  const day1 = new Date('2026-09-28T10:00:00Z')

  expect(await sharing.recordView(songId, 'user:x', day1)).toBe(true)
  expect(await sharing.recordView(songId, 'user:x', new Date('2026-09-28T23:59:00Z'))).toBe(false)
  expect(await sharing.recordView(songId, 'browser:y', day1)).toBe(true)
  expect(await sharing.recordView(songId, 'user:x', new Date('2026-09-29T00:01:00Z'))).toBe(true)

  expect((await sharing.getSharedSong(shareId))?.views).toBe(3)
})

test('a user likes a song once, and can take it back', async () => {
  const shareId = await shared()

  expect(await sharing.setLiked(other, songId, true)).toBe(1)
  expect(await sharing.setLiked(other, songId, true)).toBe(1)
  expect(await sharing.hasLiked(other, songId)).toBe(true)
  expect(await sharing.hasLiked(me, songId)).toBe(false)
  expect(await sharing.setLiked(me, songId, true)).toBe(2)
  expect(await sharing.setLiked(other, songId, false)).toBe(1)
  expect(await sharing.hasLiked(other, songId)).toBe(false)
  expect((await sharing.getSharedSong(shareId))?.likes).toBe(1)
})

test("the dashboard lists the user's own songs, newest change first, with share state, views and likes", async () => {
  await createSong(other, { name: 'Theirs' })
  const later = await createSong(me, { name: 'Later' })
  const at = (id: string, iso: string) =>
    db
      .update(songs)
      .set({ updatedAt: new Date(iso) })
      .where(eq(songs.id, id))
  await at(songId, '2026-09-01T00:00:00Z')
  await at(later.id, '2026-09-02T00:00:00Z')
  const shareId = await shared() // sharing doesn't count as a change
  await sharing.recordView(songId, 'user:x')
  await sharing.setLiked(other, songId, true)

  expect(await sharing.listSongStats(me)).toStrictEqual([
    {
      id: later.id,
      likes: 0,
      name: 'Later',
      shareId: null,
      updatedAt: new Date('2026-09-02T00:00:00Z'),
      views: 0
    },
    {
      id: songId,
      likes: 1,
      name: 'Jam',
      shareId,
      updatedAt: new Date('2026-09-01T00:00:00Z'),
      views: 1
    }
  ])
})
