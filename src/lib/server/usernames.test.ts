import { migrate } from 'drizzle-orm/libsql/migrator'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, expect, test } from 'vitest'

import { db } from './db/index.js'
import { users } from './db/schema.js'
import { generateUsername, randomUsername } from './usernames.js'

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url))
  })
})

beforeEach(async () => {
  await db.delete(users)
})

test('usernames are adjective-noun-number', () => {
  expect(randomUsername(() => 0)).toBe('analog-arp-1000')
  expect(randomUsername((max) => max - 1)).toBe('wobbly-wave-9999')
  for (let i = 0; i < 50; i++) expect(randomUsername()).toMatch(/^[a-z]+-[a-z]+-\d{4}$/)
})

test('a taken username is skipped', async () => {
  await db.insert(users).values({ email: 'a@example.com', name: 'a', username: 'analog-arp-1000' })
  // First try picks the taken name, the second a free one.
  let calls = 0
  const random = (max: number) => (calls++ < 3 ? 0 : max - 1)

  expect(await generateUsername(random)).toBe('wobbly-wave-9999')
})
