import type { z } from 'zod'

import { asc, eq, ne } from 'drizzle-orm'

import type { PresetSummary } from '../types.js'

import { db } from './db/index.js'
import { type Preset, presets, type Song, songs } from './db/schema.js'
import { describe, presetSchema, songSchema } from './validation.js'

// Raised for input the app refuses to store; `message` is safe to show the user.
export class InvalidError extends Error {}

function parse<T extends z.ZodType>(schema: T, attrs: unknown): z.output<T> {
  const result = schema.safeParse(attrs)
  if (!result.success) throw new InvalidError(describe(result.error))
  return result.data
}

// Turns a unique-name violation into a readable error.
async function uniqueName<T>(query: Promise<T>): Promise<T> {
  try {
    return await query
  } catch (e) {
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : ''
    if (`${String(e)} ${cause}`.includes('UNIQUE constraint failed')) {
      throw new InvalidError('name: has already been taken')
    }
    throw e
  }
}

// The name field of a client payload, if it sent one.
const nameOf = (attrs: unknown): unknown =>
  typeof attrs === 'object' && attrs !== null && 'name' in attrs ? attrs.name : undefined

export async function createSong(attrs: unknown): Promise<Song> {
  const name = await nameOrUntitled(nameOf(attrs))
  const values = parse(songSchema, { ...(attrs as object), name })
  const [song] = await uniqueName(db.insert(songs).values(values).returning())
  if (!song) throw new Error('song insert returned no row')
  return song
}

export async function getPreset(id: string): Promise<null | Preset> {
  return (await db.select().from(presets).where(eq(presets.id, id)))[0] ?? null
}

export async function getSong(id: string): Promise<null | Song> {
  return (await db.select().from(songs).where(eq(songs.id, id)))[0] ?? null
}

export function listPresets(): Promise<PresetSummary[]> {
  return db.select({ id: presets.id, name: presets.name }).from(presets).orderBy(asc(presets.name))
}

export function listSongs(): Promise<PresetSummary[]> {
  return db.select({ id: songs.id, name: songs.name }).from(songs).orderBy(asc(songs.name))
}

// Saving under an existing name overwrites that preset.
export async function savePreset(attrs: unknown): Promise<Preset> {
  const { name, params } = parse(presetSchema, attrs)
  const [preset] = await db
    .insert(presets)
    .values({ name, params })
    .onConflictDoUpdate({ set: { params, updatedAt: new Date() }, target: presets.name })
    .returning()
  if (!preset) throw new Error('preset upsert returned no row')
  return preset
}

// Returns null if there's no song with that id.
export async function updateSong(id: string, attrs: unknown): Promise<null | Song> {
  const name = await nameOrUntitled(nameOf(attrs), id)
  const values = parse(songSchema, { ...(attrs as object), name })
  const [song] = await uniqueName(db.update(songs).set(values).where(eq(songs.id, id)).returning())
  return song ?? null
}

// A blank name becomes the first free "Untitled", "Untitled 2", ... (ignoring the
// song being saved, so re-saving it keeps its name).
async function nameOrUntitled(name: unknown, id?: string): Promise<unknown> {
  if (typeof name === 'string' && name.trim() !== '') return name
  const others = await db
    .select({ name: songs.name })
    .from(songs)
    .where(id ? ne(songs.id, id) : undefined)
  const taken = new Set(others.map((s) => s.name))
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? 'Untitled' : `Untitled ${n}`
    if (!taken.has(candidate)) return candidate
  }
}
