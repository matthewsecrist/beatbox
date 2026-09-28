import { expect, test } from 'vitest'

import { DEFAULT_EFFECTS } from './effects.js'
import { help } from './help.js'
import { DEFAULT_PERFORMANCE } from './synth/arp.js'
import { DEFAULT_PARAMS } from './synth/engine.js'

test('every synth, chord/arp and effects setting, and every panel, has a plain-English explanation', () => {
  const keys = [
    ...Object.keys(DEFAULT_PARAMS),
    ...Object.keys(DEFAULT_PERFORMANCE),
    ...Object.keys(DEFAULT_EFFECTS),
    ...['osc', 'filter', 'envelope', 'lfo', 'glide', 'delay', 'reverb', 'sends'].map(
      (panel) => 'panel_' + panel
    ),
    // Drum step edit buttons
    ...['step_hits', 'step_velocity', 'step_accent', 'step_probability', 'step_ratchet']
  ]
  expect(keys.filter((key) => !help(key))).toStrictEqual([])
})

test('both oscillators and both LFOs share one explanation per setting', () => {
  expect(help('osc2_level')).toBe(help('osc1_level'))
  expect(help('lfo2_target')).toBe(help('lfo1_target'))
  expect(help('nope')).toBe(undefined)
})
