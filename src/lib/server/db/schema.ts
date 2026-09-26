import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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

// A saved synth sound. Saving under an existing name overwrites it.
export const presets = sqliteTable('presets', {
  id: id(),
  name: text('name').notNull().unique(),
  params: text('params', { mode: 'json' }).$type<Partial<SynthParams>>().notNull(),
  ...timestamps
})

// A saved session: synth settings, drum machine, loop pads and arrangement.
// The song parts are JSON; their shape is checked in `$lib/server/validation.ts`.
export const songs = sqliteTable('songs', {
  // Sections played in order by "Play song".
  arrangement: text('arrangement', { mode: 'json' }).$type<Section[]>().notNull().default([]),
  drums: text('drums', { mode: 'json' }).$type<Drums>(),
  id: id(),
  loops: text('loops', { mode: 'json' }).$type<Loop[]>().notNull().default([]),
  name: text('name').notNull().unique(),
  // null means "defaults" for synth and drums.
  synth: text('synth', { mode: 'json' }).$type<Partial<SynthParams>>(),
  ...timestamps
})

export type Preset = typeof presets.$inferSelect
export type Song = typeof songs.$inferSelect
