import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

import { createClient } from '@libsql/client'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql'

import * as schema from './schema.js'

// Deployed on Cloudflare Workers, the database is the D1 binding `DB` (wrangler.jsonc).
// Everywhere else (dev, tests) it's a local SQLite file by default; any libSQL URL
// (e.g. Turso) works too.
async function connect(): Promise<BaseSQLiteDatabase<'async', unknown, typeof schema>> {
  if (globalThis.navigator.userAgent === 'Cloudflare-Workers') {
    // Dynamic: `cloudflare:workers` only exists in the Workers runtime.
    const { env } = await import('cloudflare:workers')
    return drizzleD1(env.DB, { schema })
  }
  const authToken = process.env.DATABASE_AUTH_TOKEN
  const client = createClient({
    url: process.env.DATABASE_URL ?? 'file:beatbox.db',
    ...(authToken ? { authToken } : {})
  })
  return drizzleLibSQL(client, { schema })
}

export const db = await connect()
