import { asc, eq, ne } from "drizzle-orm"
import { db } from "./db/index.js"
import { presets, songs } from "./db/schema.js"
import { describe, presetSchema, songSchema } from "./validation.js"

// Raised for input the app refuses to store; `message` is safe to show the user.
export class InvalidError extends Error {}

function parse(schema, attrs) {
  const result = schema.safeParse(attrs)
  if (!result.success) throw new InvalidError(describe(result.error))
  return result.data
}

// Turns a unique-name violation into a readable error.
async function uniqueName(query) {
  try {
    return await query
  } catch (e) {
    if (/UNIQUE constraint failed/.test(`${e.message} ${e.cause?.message}`)) {
      throw new InvalidError("name: has already been taken")
    }
    throw e
  }
}

export function listPresets() {
  return db.select({ id: presets.id, name: presets.name }).from(presets).orderBy(asc(presets.name))
}

export async function getPreset(id) {
  return (await db.select().from(presets).where(eq(presets.id, id)))[0] ?? null
}

// Saving under an existing name overwrites that preset.
export async function savePreset(attrs) {
  const { name, params } = parse(presetSchema, attrs)
  const [preset] = await db
    .insert(presets)
    .values({ name, params })
    .onConflictDoUpdate({ target: presets.name, set: { params, updatedAt: new Date() } })
    .returning()
  return preset
}

export function listSongs() {
  return db.select({ id: songs.id, name: songs.name }).from(songs).orderBy(asc(songs.name))
}

export async function getSong(id) {
  return (await db.select().from(songs).where(eq(songs.id, id)))[0] ?? null
}

// A blank name becomes the first free "Untitled", "Untitled 2", ... (ignoring the
// song being saved, so re-saving it keeps its name).
async function nameOrUntitled(name, id) {
  if (typeof name === "string" && name.trim() !== "") return name
  const others = await db
    .select({ name: songs.name })
    .from(songs)
    .where(id ? ne(songs.id, id) : undefined)
  const taken = new Set(others.map((s) => s.name))
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? "Untitled" : `Untitled ${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export async function createSong(attrs) {
  const values = parse(songSchema, { ...attrs, name: await nameOrUntitled(attrs.name) })
  const [song] = await uniqueName(db.insert(songs).values(values).returning())
  return song
}

// Returns null if there's no song with that id.
export async function updateSong(id, attrs) {
  const values = parse(songSchema, { ...attrs, name: await nameOrUntitled(attrs.name, id) })
  const [song] = await uniqueName(db.update(songs).set(values).where(eq(songs.id, id)).returning())
  return song ?? null
}
