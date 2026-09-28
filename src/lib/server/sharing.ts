import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'

import type { SongDoc } from '../types.js'

import { db } from './db/index.js'
import { songLikes, songs, songViews, users } from './db/schema.js'

// Public share links, and the likes and views a shared song collects. Sharing is
// the owner's choice per song: the link carries an unguessable id, and turning
// sharing off drops it, so the old link stops working. Likes and views stay with
// the song when it's unshared, and come back if it's shared again.

// A shared song as its public page shows it.
export interface SharedSong {
  id: string
  likes: number
  name: string
  owner: string
  ownerId: string
  shareId: string
  song: SongDoc
  views: number
}

// One of the user's songs as the dashboard lists it.
export interface SongStats {
  id: string
  likes: number
  name: string
  shareId: null | string
  updatedAt: Date
  views: number
}

const views = sql<number>`(select count(*) from ${songViews} where ${songViews.songId} = ${songs.id})`
const likes = sql<number>`(select count(*) from ${songLikes} where ${songLikes.songId} = ${songs.id})`

// The song shared under `shareId`, or null if there's none (never shared, or unshared).
export async function getSharedSong(shareId: string): Promise<null | SharedSong> {
  const [row] = await db
    .select({
      arrangement: songs.arrangement,
      drums: songs.drums,
      effects: songs.effects,
      id: songs.id,
      likes,
      loops: songs.loops,
      name: songs.name,
      owner: users.username,
      ownerId: songs.userId,
      performance: songs.performance,
      shareId: songs.shareId,
      synth: songs.synth,
      views
    })
    .from(songs)
    .innerJoin(users, eq(users.id, songs.userId))
    .where(and(isNotNull(songs.shareId), eq(songs.shareId, shareId)))
  if (!row?.shareId) return null
  const { arrangement, drums, effects, loops, performance, synth, ...info } = row
  return {
    ...info,
    shareId: row.shareId,
    song: { arrangement, drums, effects, loops, performance, synth }
  }
}

export async function hasLiked(userId: string, songId: string): Promise<boolean> {
  const rows = await db
    .select({ songId: songLikes.songId })
    .from(songLikes)
    .where(and(eq(songLikes.userId, userId), eq(songLikes.songId, songId)))
  return rows.length > 0
}

// Every song of the user's, most recently changed first, with its share state.
export function listSongStats(userId: string): Promise<SongStats[]> {
  return db
    .select({
      id: songs.id,
      likes,
      name: songs.name,
      shareId: songs.shareId,
      updatedAt: songs.updatedAt,
      views
    })
    .from(songs)
    .where(eq(songs.userId, userId))
    .orderBy(desc(songs.updatedAt))
}

// Counts a visit to a shared song, once per viewer per UTC day. Returns whether it
// counted (false for a repeat visit that day).
export async function recordView(
  songId: string,
  viewer: string,
  now = new Date()
): Promise<boolean> {
  const rows = await db
    .insert(songViews)
    .values({ day: now.toISOString().slice(0, 10), songId, viewer })
    .onConflictDoNothing()
    .returning({ songId: songViews.songId })
  return rows.length > 0
}

// Likes or unlikes a song for the user; liking twice or unliking an unliked song
// changes nothing. Returns the song's like count afterwards.
export async function setLiked(userId: string, songId: string, liked: boolean): Promise<number> {
  if (liked) {
    await db.insert(songLikes).values({ songId, userId }).onConflictDoNothing()
  } else {
    await db
      .delete(songLikes)
      .where(and(eq(songLikes.userId, userId), eq(songLikes.songId, songId)))
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(songLikes)
    .where(eq(songLikes.songId, songId))
  return row?.count ?? 0
}

// Shares the user's song (keeping its link if it's already shared) and returns the
// share id, or null if the user has no such song. Doesn't count as editing it.
export async function shareSong(userId: string, id: string): Promise<null | string> {
  const [song] = await db
    .select({ shareId: songs.shareId })
    .from(songs)
    .where(and(eq(songs.userId, userId), eq(songs.id, id)))
  if (!song) return null
  if (song.shareId) return song.shareId
  const shareId = newShareId()
  await db
    .update(songs)
    .set({ shareId, updatedAt: sql`${songs.updatedAt}` })
    .where(and(eq(songs.userId, userId), eq(songs.id, id)))
  return shareId
}

// Stops sharing the user's song: its link stops working. False if there's no such song.
export async function unshareSong(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(songs)
    .set({ shareId: null, updatedAt: sql`${songs.updatedAt}` })
    .where(and(eq(songs.userId, userId), eq(songs.id, id)))
    .returning({ id: songs.id })
  return rows.length > 0
}

// 128 random bits, URL-safe: nobody can guess or enumerate share links.
function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}
