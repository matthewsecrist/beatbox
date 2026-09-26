import { expect, test } from 'vitest'

import type { Loop } from '../types.js'

import {
  clampNote,
  eventsFromNotes,
  fitToLength,
  loopFromNotes,
  type Note,
  notesFromLoop,
  quantize,
  snap,
  snapDown
} from './notes.js'

const note = (midi: number, start: number, length: number, id = 0): Note => ({
  id,
  length,
  midi,
  start
})
const shape = (notes: Note[]) => notes.map(({ length, midi, start }) => ({ length, midi, start }))

// One bar at 120 BPM (2 s): C4 on beat 1, E4 on beat 3 held to the end.
const loop: Loop = {
  bpm: 120,
  events: [
    { midi: 60, on: true, t: 0 },
    { midi: 64, on: true, t: 1 },
    { midi: 60, on: false, t: 0.25 },
    { midi: 64, on: false, t: 2 }
  ],
  length: 2,
  params: {},
  slot: 0
}

test('events become notes in beats, and back to the same events', () => {
  const view = notesFromLoop(loop, 120)

  expect(view.beats).toBe(4)
  expect(shape(view.notes)).toStrictEqual([
    { length: 0.5, midi: 60, start: 0 },
    { length: 2, midi: 64, start: 2 }
  ])
  expect(eventsFromNotes(view.notes, 120)).toStrictEqual([
    { midi: 60, on: true, t: 0 },
    { midi: 60, on: false, t: 0.25 },
    { midi: 64, on: true, t: 1 },
    { midi: 64, on: false, t: 2 }
  ])
})

test('a note still held at the end, or restarted, is closed', () => {
  const view = notesFromLoop(
    {
      events: [
        { midi: 60, on: true, t: 0 },
        { midi: 60, on: true, t: 0.5 },
        { midi: 67, on: true, t: 1 }
      ],
      length: 2
    },
    120
  )

  expect(shape(view.notes)).toStrictEqual([
    { length: 1, midi: 60, start: 0 },
    { length: 3, midi: 60, start: 1 },
    { length: 2, midi: 67, start: 2 }
  ])
})

test('a loop that is not whole bars is rounded up to whole bars', () => {
  expect(notesFromLoop({ events: [], length: 2.5 }, 120).beats).toBe(8)
  expect(notesFromLoop({ events: [], length: 0.1 }, 120).beats).toBe(4)
})

test('notes on the grid survive the millisecond rounding of a save', () => {
  // At 110 BPM a 16th note is 0.13636 s, stored as 0.136 s; one bar is 2.182 s.
  const notes = [note(60, 0.25, 0.25), note(64, 3.75, 0.25)]
  const saved = loopFromNotes(loop, { beats: 4, notes }, 110)
  const view = notesFromLoop(saved, 110)

  expect(saved.length).toBe(2.182)
  expect(view.beats).toBe(4)
  expect(shape(view.notes)).toStrictEqual(shape(notes))
})

test('back-to-back notes on one pitch put the note-off first', () => {
  const events = eventsFromNotes([note(60, 1, 1), note(60, 0, 1)], 60)

  expect(events).toStrictEqual([
    { midi: 60, on: true, t: 0 },
    { midi: 60, on: false, t: 1 },
    { midi: 60, on: true, t: 1 },
    { midi: 60, on: false, t: 2 }
  ])
})

test('an edited loop keeps its sound and gets its length and tempo from the notes', () => {
  const edited = loopFromNotes(loop, { beats: 8, notes: [note(72, 4, 1)] }, 100)

  expect(edited).toStrictEqual({
    bpm: 100,
    events: [
      { midi: 72, on: true, t: 2.4 },
      { midi: 72, on: false, t: 3 }
    ],
    length: 4.8,
    params: {},
    slot: 0
  })
})

test('snapping rounds to the nearest grid line, or down', () => {
  expect(snap(0.37, 0.25)).toBe(0.25)
  expect(snap(0.38, 0.25)).toBe(0.5)
  expect(snapDown(0.49, 0.25)).toBe(0.25)
  expect(snapDown(0.5, 0.25)).toBe(0.5)
})

test('quantize moves starts to the grid, keeping lengths inside the loop', () => {
  const notes = quantize([note(60, 0.1, 0.4), note(62, 3.6, 1), note(64, 3.9, 0.5)], 0.5, 4)

  // 3.6 snaps to 3.5 and is trimmed to end with the loop; 3.9 snaps to the loop end
  // and is dropped.
  expect(shape(notes)).toStrictEqual([
    { length: 0.4, midi: 60, start: 0 },
    { length: 0.5, midi: 62, start: 3.5 }
  ])
})

test('shortening a loop drops notes past the end and trims the rest', () => {
  const notes = fitToLength([note(60, 0, 8), note(62, 3.5, 1), note(64, 4, 1)], 4)

  expect(shape(notes)).toStrictEqual([
    { length: 4, midi: 60, start: 0 },
    { length: 0.5, midi: 62, start: 3.5 }
  ])
})

test('a dragged note stays inside the loop and the pitch range', () => {
  expect(clampNote(note(200, -1, 2), 4, [36, 96])).toMatchObject({
    length: 2,
    midi: 96,
    start: 0
  })
  expect(clampNote(note(10, 3.5, 2), 4, [36, 96])).toMatchObject({
    length: 2,
    midi: 36,
    start: 2
  })
})
