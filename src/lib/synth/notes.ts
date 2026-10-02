import type { Loop, LoopEvent, NoteBend } from '../types.js'

import { BEATS_PER_BAR } from '../transport.js'

// Piano-roll view of a loop: notes with a start and length in beats. Loops are
// stored as note on/off events in seconds at the tempo they were made at, so the
// editor converts to notes when it opens a loop and back to events on each edit.

export interface Note {
  bend?: NoteBend
  id: number
  // Beats; a note may end at the loop end but never past it.
  length: number
  midi: number
  start: number
  // How hard it's played, 0-1.
  velocity: number
}

export interface NoteLoop {
  // Whole bars in beats.
  beats: number
  notes: Note[]
}

// Shortest note the editor makes or keeps: a 1/64 note.
export const MIN_LENGTH = 1 / 16

let nextId = 1
export const newNoteId = (): number => nextId++

// Durations use the caller's units (beats in the editor, seconds in the engine).
// Oversize ramps meet at zero instead of crossing; zero offsets cost no duration.
export function bendDurations(bend: NoteBend | undefined, length: number): [number, number] {
  const into = bend?.in?.semitones ? bend.in.duration : 0
  const out = bend?.out?.semitones ? bend.out.duration : 0
  const scale = into + out > length ? Math.max(0, length) / (into + out) : 1
  return [into * scale, out * scale]
}

const EPSILON = 1e-6

// Loops store times rounded to the millisecond, which is up to ~0.002 beats off at
// fast tempos. Reading them back, times snap to 1/192 beat (finer than any grid) so
// notes drawn on the grid come back on it, and lengths allow for the rounding
// before rounding up to whole bars.
const TICK = 1 / 192
const BAR_TOLERANCE = 1e-3

// Keeps a note inside the loop and the playable range while it's dragged.
export function clampNote(
  note: Note,
  beats: number,
  [lowest, highest]: readonly [number, number]
): Note {
  const length = round(Math.max(MIN_LENGTH, Math.min(note.length, beats)))
  const start = round(Math.min(Math.max(0, note.start), beats - length))
  const midi = Math.min(highest, Math.max(lowest, Math.round(note.midi)))
  return { ...note, length, midi, start }
}

// Note on/off events in seconds at `bpm`, in playback order: at the same moment,
// note-offs come first so a repeated pitch restarts cleanly. A note-on carries its
// velocity unless it's full, so loops without any stay as they were.
export function eventsFromNotes(notes: Note[], bpm: number): LoopEvent[] {
  const sec = (beat: number) => Math.round((beat * 60 * 1000) / bpm) / 1000
  const events = notes.flatMap((n): LoopEvent[] => [
    {
      midi: n.midi,
      on: true,
      t: sec(n.start),
      ...(n.velocity < 1 && { velocity: n.velocity }),
      ...(n.bend && { bend: n.bend })
    },
    { midi: n.midi, on: false, t: sec(n.start + n.length) }
  ])
  return events.sort((a, b) => a.t - b.t || Number(a.on) - Number(b.on))
}

// Drops notes that start at or after the loop end and trims the rest to end by it.
export function fitToLength(notes: Note[], beats: number): Note[] {
  return notes
    .filter((n) => n.start < beats - EPSILON)
    .map((n) => ({
      ...n,
      length: round(Math.max(MIN_LENGTH, Math.min(n.length, beats - n.start)))
    }))
}

// The loop with `notes` as its content, `beats` long, at `bpm`.
export function loopFromNotes<T extends Pick<Loop, 'bpm' | 'events' | 'length'>>(
  loop: T,
  { beats, notes }: NoteLoop,
  bpm: number
): T {
  return {
    ...loop,
    bpm,
    events: eventsFromNotes(notes, bpm),
    length: Math.round((beats * 60 * 1000) / bpm) / 1000
  }
}

// Pairs note-on/off events into notes. `bpm` is the loop's tempo (the current tempo
// for loops recorded before tempo sync). A note still held at the end of the loop
// ends there. The length is rounded up to whole bars.
export function notesFromLoop(loop: Pick<Loop, 'events' | 'length'>, bpm: number): NoteLoop {
  const toBeats = bpm / 60
  const beats =
    Math.max(1, Math.ceil((loop.length * toBeats) / BEATS_PER_BAR - BAR_TOLERANCE)) * BEATS_PER_BAR
  const notes: Note[] = []
  const held = new Map<number, { bend?: NoteBend; start: number; velocity: number }>()
  const close = (midi: number, end: number) => {
    const on = held.get(midi)
    if (on === undefined) return
    held.delete(midi)
    notes.push({
      id: newNoteId(),
      length: Math.max(MIN_LENGTH, end - on.start),
      midi,
      start: on.start,
      velocity: on.velocity,
      ...(on.bend && { bend: on.bend })
    })
  }
  const events = [...loop.events].sort((a, b) => a.t - b.t || Number(a.on) - Number(b.on))
  for (const e of events) {
    const beat = round(Math.round((e.t * toBeats) / TICK) * TICK)
    if (e.on) {
      close(e.midi, beat) // a repeated note-on ends the previous one
      held.set(e.midi, { start: beat, velocity: e.velocity ?? 1, ...(e.bend && { bend: e.bend }) })
    } else {
      close(e.midi, beat)
    }
  }
  for (const midi of [...held.keys()]) close(midi, beats)
  return { beats, notes: fitToLength(notes, beats) }
}

// Moves every note start to the nearest grid line, keeping lengths.
export function quantize(notes: Note[], grid: number, beats: number): Note[] {
  return fitToLength(
    notes.map((n) => ({ ...n, start: snap(n.start, grid) })),
    beats
  )
}

// Nearest grid line.
export function snap(beat: number, grid: number): number {
  return round(Math.round(beat / grid) * grid)
}

// Grid line at or before `beat`.
export function snapDown(beat: number, grid: number): number {
  return round(Math.floor(beat / grid + EPSILON) * grid)
}

const round = (beat: number): number => Math.round(beat * 1e6) / 1e6
