import type { LibSQLDatabase } from 'drizzle-orm/libsql'

import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, expect, test, vi } from 'vitest'

import type * as schema from './db/schema.js'

import { auth } from './auth.js'
import { db } from './db/index.js'
import { users } from './db/schema.js'
import { sendMagicLink } from './email.js'
import { getSong, listSongs } from './music.js'

// Outside a request there's no SvelteKit event for the cookie plugin to write to.
vi.mock('$app/server', () => ({ getRequestEvent: () => undefined }))
vi.mock('./email.js', () => ({ sendMagicLink: vi.fn() }))

beforeAll(async () => {
  // Tests run on libSQL, never D1.
  await migrate(db as LibSQLDatabase<typeof schema>, {
    migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url))
  })
})

beforeEach(async () => {
  vi.mocked(sendMagicLink).mockClear()
  await db.delete(users)
})

// Requests a magic link for `email` and follows it, as clicking the emailed link would.
async function signIn(email: string) {
  await auth.api.signInMagicLink({ body: { email }, headers: new Headers() })
  const [link] = vi.mocked(sendMagicLink).mock.calls.at(-1) ?? []
  const token = new URL(link?.url ?? 'http://x').searchParams.get('token')
  if (!token) throw new Error('no magic link was sent')
  const { user } = await auth.api.magicLinkVerify({ headers: new Headers(), query: { token } })
  // The stored row, which has the fields Better Auth's reply leaves out (username).
  const [row] = await db.select().from(users).where(eq(users.id, user.id))
  if (!row) throw new Error(`no user ${user.id}`)
  return row
}

test('the first sign-in creates a user with a username and a copy of Midnight Arcade', async () => {
  const user = await signIn('ada@example.com')

  expect(user.email).toBe('ada@example.com')
  expect(user.username).toMatch(/^[a-z]+-[a-z]+-\d{4}$/)
  expect(user.name).toBe(user.username)

  const songs = await listSongs(user.id)
  expect(songs.map((s) => s.name)).toStrictEqual(['Midnight Arcade'])
  const song = await getSong(user.id, songs[0]?.id ?? '')
  expect(song?.loops.length).toBeGreaterThan(0)
  expect(song?.arrangement.length).toBeGreaterThan(0)
})

test('each user gets their own copy, and signing in again gives no more', async () => {
  const ada = await signIn('ada@example.com')
  const bob = await signIn('bob@example.com')
  const again = await signIn('ada@example.com')

  expect(again.id).toBe(ada.id)
  expect(again.username).toBe(ada.username)
  expect(bob.username).not.toBe(ada.username)
  expect(await listSongs(ada.id)).toHaveLength(1)
  const [adas] = await listSongs(ada.id)
  const [bobs] = await listSongs(bob.id)
  expect(adas?.id).not.toBe(bobs?.id)
})

test('a magic link works only once', async () => {
  await auth.api.signInMagicLink({ body: { email: 'ada@example.com' }, headers: new Headers() })
  const token = new URL(
    vi.mocked(sendMagicLink).mock.calls[0]?.[0].url ?? 'http://x'
  ).searchParams.get('token')
  await auth.api.magicLinkVerify({ headers: new Headers(), query: { token: token ?? '' } })

  await expect(
    auth.api.magicLinkVerify({ headers: new Headers(), query: { token: token ?? '' } })
  ).rejects.toThrow()
})
