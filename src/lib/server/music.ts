import type { z } from 'zod'

import { and, asc, eq, ne } from 'drizzle-orm'

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

// Every function here acts for one user (`userId`): songs and presets belong to the
// user who saved them, and other users' are treated as missing.

export async function createSong(userId: string, attrs: unknown): Promise<Song> {
  const name = await nameOrUntitled(userId, nameOf(attrs))
  const values = parse(songSchema, { ...(attrs as object), name })
  const [song] = await uniqueName(
    db
      .insert(songs)
      .values({ ...values, userId })
      .returning()
  )
  if (!song) throw new Error('song insert returned no row')
  return song
}

// Deletes the user's song, with its likes and views. False if there's no such song.
export async function deleteSong(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(songs)
    .where(and(eq(songs.userId, userId), eq(songs.id, id)))
    .returning({ id: songs.id })
  return rows.length > 0
}

export async function getPreset(userId: string, id: string): Promise<null | Preset> {
  const rows = await db
    .select()
    .from(presets)
    .where(and(eq(presets.userId, userId), eq(presets.id, id)))
  return rows[0] ?? null
}

export async function getSong(userId: string, id: string): Promise<null | Song> {
  const rows = await db
    .select()
    .from(songs)
    .where(and(eq(songs.userId, userId), eq(songs.id, id)))
  return rows[0] ?? null
}

export function listPresets(userId: string): Promise<PresetSummary[]> {
  return db
    .select({ id: presets.id, name: presets.name })
    .from(presets)
    .where(eq(presets.userId, userId))
    .orderBy(asc(presets.name))
}

export function listSongs(userId: string): Promise<PresetSummary[]> {
  return db
    .select({ id: songs.id, name: songs.name })
    .from(songs)
    .where(eq(songs.userId, userId))
    .orderBy(asc(songs.name))
}

// Saving under a name the user already has overwrites that preset.
export async function savePreset(userId: string, attrs: unknown): Promise<Preset> {
  const { name, params } = parse(presetSchema, attrs)
  const [preset] = await db
    .insert(presets)
    .values({ name, params, userId })
    .onConflictDoUpdate({
      set: { params, updatedAt: new Date() },
      target: [presets.userId, presets.name]
    })
    .returning()
  if (!preset) throw new Error('preset upsert returned no row')
  return preset
}

// Returns null if the user has no song with that id.
export async function updateSong(userId: string, id: string, attrs: unknown): Promise<null | Song> {
  const name = await nameOrUntitled(userId, nameOf(attrs), id)
  const values = parse(songSchema, { ...(attrs as object), name })
  const [song] = await uniqueName(
    db
      .update(songs)
      .set(values)
      .where(and(eq(songs.userId, userId), eq(songs.id, id)))
      .returning()
  )
  return song ?? null
}

// A blank name becomes the user's first free "Untitled", "Untitled 2", ... (ignoring
// the song being saved, so re-saving it keeps its name).
async function nameOrUntitled(userId: string, name: unknown, id?: string): Promise<unknown> {
  if (typeof name === 'string' && name.trim() !== '') return name
  const others = await db
    .select({ name: songs.name })
    .from(songs)
    .where(and(eq(songs.userId, userId), id ? ne(songs.id, id) : undefined))
  const taken = new Set(others.map((s) => s.name))
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? 'Untitled' : `Untitled ${n}`
    if (!taken.has(candidate)) return candidate
  }
}
