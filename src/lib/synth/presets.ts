import type { Loop, PresetSummary, SynthParams } from '../types.js'

import { LOOP_SPECS } from '../library_items.js'
import { FACTORY_PRESETS } from './factory_presets.js'
import { loopFromNotes } from './notes.js'

export interface PresetItem extends PresetSummary {
  genre: string[]
  instrument: string[]
  source: 'Factory' | 'Saved'
}

export const PRESET_FACETS = [
  { key: 'source', label: 'Source' },
  { key: 'instrument', label: 'Instrument' },
  { key: 'genre', label: 'Genre' }
] as const
export type PresetFacet = (typeof PRESET_FACETS)[number]['key']

// Reuse the library's tags rather than maintain a second genre taxonomy.
const factory: PresetItem[] = FACTORY_PRESETS.map(({ name }, i) => {
  const loops = LOOP_SPECS.filter((loop) => loop.sound === name)
  return {
    genre: [...new Set(loops.map((loop) => loop.genre))],
    id: `factory:${i}`,
    instrument: [...new Set(loops.map((loop) => loop.instrument))],
    name,
    source: 'Factory'
  }
})

export function filterPresets(
  items: PresetItem[],
  query: string,
  picked: Partial<Record<PresetFacet, string[]>>
): PresetItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((item) => {
    const text = [item.name, item.source, ...item.genre, ...item.instrument].join(' ').toLowerCase()
    return (
      words.every((word) => text.includes(word)) &&
      PRESET_FACETS.every(
        ({ key }) =>
          !picked[key]?.length ||
          presetLabels(item, key).some((label) => picked[key]?.includes(label))
      )
    )
  })
}

export function presetItems(saved: PresetSummary[]): PresetItem[] {
  return [
    ...factory,
    ...saved.map((preset): PresetItem => ({
      ...preset,
      genre: [],
      instrument: [],
      source: 'Saved'
    }))
  ]
}

export function presetLabels(item: PresetItem, key: PresetFacet): string[] {
  if (key === 'source') return [item.source]
  return item[key].length ? item[key] : ['Unclassified']
}

// Keep a selected loop's notes, velocities and recorded tempo, but audition only
// the new preset's sound. With no selected loop, play a two-beat example note.
export function presetPreviewLoop(
  params: Partial<SynthParams>,
  bpm: number,
  selected: Loop | null,
  midi: number
): Loop {
  if (selected) return { ...selected, params }
  return loopFromNotes(
    { bpm, events: [], length: 0, params, slot: 0 },
    { beats: 4, notes: [{ id: 0, length: 2, midi, start: 0, velocity: 1 }] },
    bpm
  )
}
