import type { AutomationTarget, Effects } from './types.js'

// The arranger's automation lanes, in the order they're offered: each one's
// label, its range as stored, and how it's shown (stored × `scale`, in `step`s).
export const LANES: {
  id: AutomationTarget
  label: string
  max: number
  min: number
  scale: number
  step: number
  unit: string
}[] = [
  { id: 'synth_filter', label: 'Synth filter', max: 4, min: -4, scale: 1, step: 0.1, unit: 'oct' },
  { id: 'master_filter', label: 'Master filter', max: 1, min: -1, scale: 100, step: 1, unit: '' },
  { id: 'master_crush_mix', label: 'Master crush', max: 1, min: 0, scale: 100, step: 1, unit: '%' },
  { id: 'synth_delay', label: 'Synth to delay', max: 1, min: 0, scale: 100, step: 1, unit: '%' },
  { id: 'synth_reverb', label: 'Synth to reverb', max: 1, min: 0, scale: 100, step: 1, unit: '%' },
  { id: 'drums_delay', label: 'Drums to delay', max: 1, min: 0, scale: 100, step: 1, unit: '%' },
  { id: 'drums_reverb', label: 'Drums to reverb', max: 1, min: 0, scale: 100, step: 1, unit: '%' },
  { id: 'synth_chorus', label: 'Synth to chorus', max: 1, min: 0, scale: 100, step: 1, unit: '%' },
  { id: 'drums_chorus', label: 'Drums to chorus', max: 1, min: 0, scale: 100, step: 1, unit: '%' },
  { id: 'delay_mix', label: 'Delay mix', max: 1, min: 0, scale: 100, step: 1, unit: '%' },
  { id: 'reverb_mix', label: 'Reverb mix', max: 1, min: 0, scale: 100, step: 1, unit: '%' },
  { id: 'chorus_mix', label: 'Chorus mix', max: 1, min: 0, scale: 100, step: 1, unit: '%' }
]

// The effect settings a lane can move (all but the synth filter).
export type EffectTarget = Exclude<AutomationTarget, 'synth_filter'>
export const EFFECT_TARGETS = LANES.map((l) => l.id).filter(
  (id): id is EffectTarget => id !== 'synth_filter'
)

export function lane(id: AutomationTarget): (typeof LANES)[number] {
  const found = LANES.find((l) => l.id === id)
  if (!found) throw new Error(`No automation lane "${id}"`)
  return found
}

// A lane's value where no section ramps it: the song's own setting (the synth
// filter's offset is 0, each sound's own cutoff).
export const restingValue = (id: AutomationTarget, effects: Effects): number =>
  id === 'synth_filter' ? 0 : effects[id]
