import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import type { Drums, Loop, Section, SynthParams } from '../../types.js'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

const timestamps = {
  insertedAt: integer('inserted_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
}

// Better Auth's tables (see `$lib/server/auth.ts`). Their field names are the ones
// Better Auth expects, so they use `createdAt` rather than `insertedAt`.
const authTimestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
}

export const users = sqliteTable('users', {
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  id: id(),
  image: text('image'),
  // Better Auth's display name; set to the username when the user is created.
  name: text('name').notNull(),
  // Generated when the user is created (see `$lib/server/usernames.ts`).
  username: text('username').notNull().unique(),
  ...authTimestamps
})

const userId = () =>
  text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })

export const sessions = sqliteTable(
  'sessions',
  {
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    id: id(),
    ipAddress: text('ip_address'),
    token: text('token').notNull().unique(),
    userAgent: text('user_agent'),
    userId: userId(),
    ...authTimestamps
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)]
)

export const accounts = sqliteTable(
  'accounts',
  {
    accessToken: text('access_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    accountId: text('account_id').notNull(),
    id: id(),
    idToken: text('id_token'),
    password: text('password'),
    providerId: text('provider_id').notNull(),
    refreshToken: text('refresh_token'),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    userId: userId(),
    ...authTimestamps
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)]
)

// Pending magic links.
export const verifications = sqliteTable(
  'verifications',
  {
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    ...authTimestamps
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)]
)

// A saved synth sound. Saving under a name the user already has overwrites it.
export const presets = sqliteTable(
  'presets',
  {
    id: id(),
    name: text('name').notNull(),
    params: text('params', { mode: 'json' }).$type<Partial<SynthParams>>().notNull(),
    userId: userId(),
    ...timestamps
  },
  (t) => [uniqueIndex('presets_user_id_name_unique').on(t.userId, t.name)]
)

// A saved session: synth settings, drum machine, loop pads and arrangement.
// The song parts are JSON; their shape is checked in `$lib/server/validation.ts`.
export const songs = sqliteTable(
  'songs',
  {
    // Sections played in order by "Play song".
    arrangement: text('arrangement', { mode: 'json' }).$type<Section[]>().notNull().default([]),
    drums: text('drums', { mode: 'json' }).$type<Drums>(),
    id: id(),
    loops: text('loops', { mode: 'json' }).$type<Loop[]>().notNull().default([]),
    name: text('name').notNull(),
    // null means "defaults" for synth and drums.
    synth: text('synth', { mode: 'json' }).$type<Partial<SynthParams>>(),
    userId: userId(),
    ...timestamps
  },
  (t) => [uniqueIndex('songs_user_id_name_unique').on(t.userId, t.name)]
)

export type Preset = typeof presets.$inferSelect
export type Song = typeof songs.$inferSelect
