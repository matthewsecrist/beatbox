import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import * as schema from './schema.js'

// A local SQLite file by default; any libSQL URL (e.g. Turso) works too.
const authToken = process.env.DATABASE_AUTH_TOKEN
const client = createClient({
  url: process.env.DATABASE_URL ?? 'file:beatbox.db',
  ...(authToken ? { authToken } : {})
})

export const db = drizzle(client, { schema })
