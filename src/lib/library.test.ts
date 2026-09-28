import { expect, test } from 'vitest'

import type { LibraryBeat, LibraryItem } from './library.js'

import { beatPattern, filterLibrary, LIBRARY, libraryLoop, parseScore } from './library.js'
import { songSchema } from './server/validation.js'
import { SongStore, STEP } from './song.svelte.js'
import { BEATS_PER_BAR } from './transport.js'

test('every library loop and beat can be saved in a song, under its own name', () => {
  const store = new SongStore()
  for (const [i, item] of LIBRARY.entries()) {
    if (item.type === 'Loop') store.setLoop(libraryLoop(item, i % 8, 140))
    else store.setPattern(3, beatPattern(item))
    const parsed = songSchema.safeParse({ ...store.toSongDoc(), name: 'Library' })
    expect(parsed.error?.issues ?? []).toStrictEqual([])
  }
  // Names key the browser's list.
  expect(new Set(LIBRARY.map((i) => i.name)).size).toBe(LIBRARY.length)
})

test('every genre has at least 5 loops and 3 beats', () => {
  const genres = new Set(LIBRARY.map((i) => i.genre))
  const short = [...genres].filter(
    (g) =>
      LIBRARY.filter((i) => i.genre === g && i.type === 'Loop').length < 5 ||
      LIBRARY.filter((i) => i.genre === g && i.type === 'Beat').length < 3
  )
  expect(short).toStrictEqual([])
})

test('a score reads chords, rests and holds across bar lines', () => {
  const rest = Array<string>(14).fill('.').join(' ')
  const score = `C4+E4 - . Bb3 ${Array<string>(12).fill('-').join(' ')} | - - ${rest}`
  expect(parseScore(score)).toStrictEqual({
    bars: 2,
    notes: [
      [60, 0, 0.5],
      [64, 0, 0.5],
      [58, 0.75, 3.75]
    ]
  })
  expect(() => parseScore('C4 - -')).toThrow('Bar 1 has 3 steps')
  expect(() => parseScore(`H4 ${rest} .`)).toThrow('Bad note “H4”')
})

test('a slide overlaps the next note by half a step, but not a repeat of its own pitch', () => {
  const rest = Array<string>(12).fill('.').join(' ')
  expect(parseScore(`C3~ - D3~ D3 ${rest}`).notes).toStrictEqual([
    [48, 0, 0.625], // two steps plus half a step into D3
    [50, 0.5, 0.25], // a slide into its own pitch just repeats
    [50, 0.75, 0.25]
  ])
  // A slide into a rest doesn't overlap anything.
  expect(parseScore(`C3~ . D3 . ${rest}`).notes[0]).toStrictEqual([48, 0, 0.25])
})

test('a library loop lasts its bars at the song tempo, with every note inside', () => {
  const item = LIBRARY.find((l) => l.type === 'Loop' && l.bars === 4)
  expect(item?.type).toBe('Loop')
  if (item?.type !== 'Loop') return
  const loop = libraryLoop(item, 0, 120) // 0.5 s per beat
  expect(loop.length).toBe(4 * BEATS_PER_BAR * 0.5)
  expect(loop.events.every((e) => e.t <= loop.length)).toBe(true)
})

test('beat marks become accented, soft, chance and ratchet steps; bad marks fail', () => {
  const beat = (kick: string): LibraryBeat => ({
    bars: 1,
    genre: 'Test',
    instrument: 'Drums',
    name: 'Test',
    tracks: { kick },
    type: 'Beat'
  })
  const [hit, accent, soft, chance, roll, rest] = beatPattern(beat('xXo?3...........')).kick
  expect(hit).toStrictEqual({ ...STEP, on: true })
  expect(accent).toStrictEqual({ ...STEP, accent: true, on: true })
  expect(soft).toStrictEqual({ ...STEP, on: true, velocity: 0.5 })
  expect(chance).toStrictEqual({ ...STEP, on: true, probability: 0.5 })
  expect(roll).toStrictEqual({ ...STEP, on: true, ratchet: 3 })
  expect(rest).toStrictEqual(STEP)
  expect(beatPattern(beat('x'.repeat(16))).tom.some((s) => s.on)).toBe(false)

  expect(() => beatPattern(beat('x..y............'))).toThrow('unknown beat mark “y”')
  expect(() => beatPattern(beat('x...'))).toThrow("isn't 16 steps")
})

test('filters: any label within a facet, every facet and search word together', () => {
  const beat = (name: string, genre: string): LibraryItem => ({
    bars: 1,
    genre,
    instrument: 'Drums',
    name,
    tracks: {},
    type: 'Beat'
  })
  const items: LibraryItem[] = [
    beat('Drop', 'Dubstep'),
    beat('Hats', 'Trap'),
    beat('Floor', 'House'),
    {
      bars: 2,
      genre: 'Dubstep',
      instrument: 'Bass',
      name: 'Growl',
      notes: [],
      params: {},
      sound: 'Dubstep Wobble',
      type: 'Loop'
    }
  ]
  const names = (query: string, picked: Parameters<typeof filterLibrary>[2]) =>
    filterLibrary(items, query, picked).map((i) => i.name)

  expect(names('', { genre: ['Dubstep', 'Trap'] })).toStrictEqual(['Drop', 'Hats', 'Growl'])
  expect(names('', { genre: ['Dubstep', 'Trap'], type: ['Beat'] })).toStrictEqual(['Drop', 'Hats'])
  // Search covers the synth sound, case-insensitively, and needs every word.
  expect(names('growl WOBBLE', {})).toStrictEqual(['Growl'])
  expect(names('wobble', { type: ['Beat'] })).toStrictEqual([])
  expect(names('', { genre: [] })).toHaveLength(items.length)
})
