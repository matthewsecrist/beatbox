import { expect, test } from 'vitest'

import type { SongDoc } from './types.js'

import { keepPendingSong, takePendingSong } from './pending_song.js'

// An in-memory stand-in for localStorage; `full` makes writes throw like a full
// (or private-mode) browser store.
class FakeStorage implements Storage {
  full = false
  get length(): number {
    return this.items.size
  }

  private items = new Map<string, string>()

  clear(): void {
    this.items.clear()
  }

  getItem(key: string): null | string {
    return this.items.get(key) ?? null
  }

  key(index: number): null | string {
    return [...this.items.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  setItem(key: string, value: string): void {
    if (this.full) throw new DOMException('full', 'QuotaExceededError')
    this.items.set(key, value)
  }
}

const song: SongDoc = {
  arrangement: [{ bars: 4, drums: true, name: 'Intro', pads: [0], pattern: 0 }],
  drums: { bpm: 128, patterns: [{ kick: [true] }], volume: 0.7 },
  loops: [],
  synth: { filter_cutoff: 800 }
}

const HOUR = 60 * 60 * 1000

test('a kept song is taken back once', () => {
  const storage = new FakeStorage()

  expect(keepPendingSong({ name: 'Jam', song }, storage, 0)).toBe(true)
  expect(takePendingSong(storage, HOUR)).toStrictEqual({ name: 'Jam', song })
  expect(takePendingSong(storage, HOUR)).toBe(null)
})

test('a song kept more than a day ago is dropped', () => {
  const storage = new FakeStorage()
  keepPendingSong({ name: 'Jam', song }, storage, 0)

  expect(takePendingSong(storage, 25 * HOUR)).toBe(null)
  expect(storage.length).toBe(0)
})

test('nothing kept, or something unreadable, gives null', () => {
  const storage = new FakeStorage()
  expect(takePendingSong(storage)).toBe(null)

  for (const junk of ['not json', '[]', '{"name":"x","keptAt":0}', 'null']) {
    storage.setItem('beatbox:pending-song', junk)
    expect(takePendingSong(storage, 0), junk).toBe(null)
  }
})

test('keeping reports failure when the browser refuses', () => {
  const storage = new FakeStorage()
  storage.full = true

  expect(keepPendingSong({ name: 'Jam', song }, storage)).toBe(false)
})
