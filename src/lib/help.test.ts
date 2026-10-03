import { expect, test } from 'vitest'

import { LANES } from './automation.js'
import { DEFAULT_EFFECTS } from './effects.js'
import { help } from './help.js'
import { DEFAULT_PERFORMANCE } from './synth/arp.js'
import { DEFAULT_PARAMS } from './synth/engine.js'

test('every synth, chord/arp and effects setting, and every panel, has a plain-English explanation', () => {
  const keys = [
    ...Object.keys(DEFAULT_PARAMS),
    ...Object.keys(DEFAULT_PERFORMANCE),
    ...Object.keys(DEFAULT_EFFECTS),
    ...[
      'osc',
      'sub_noise',
      'pitch_env',
      'drive',
      'filter',
      'envelope',
      'lfo',
      'glide',
      'delay',
      'reverb',
      'sends',
      'chorus',
      'crush',
      'sound_chorus',
      'sound_crush',
      'sound_delay',
      'sound_reverb',
      'duck',
      'master',
      'mix'
    ].map((panel) => 'panel_' + panel),
    // Drum machine controls and step edit buttons
    ...[
      'tempo',
      'drums_level',
      'swing',
      'humanize',
      'drums_crush',
      'drums_fill',
      'drums_voice_pan',
      'kit',
      'drums_sound',
      'drums_tracks',
      'drums_grid',
      'drums_bars',
      'drums_euclid'
    ],
    ...[
      'step_hits',
      'step_velocity',
      'step_accent',
      'step_probability',
      'step_ratchet',
      'step_lock'
    ],
    'tap_tempo',
    // Arrangement
    'pad_once',
    'section_bpm',
    'section_fill',
    'section_pad_start',
    'automation',
    ...LANES.map((l) => l.id)
  ]
  expect(keys.filter((key) => !help(key))).toStrictEqual([])
})

test('both oscillators and both LFOs share one explanation per setting', () => {
  expect(help('osc2_level')).toBe(help('osc1_level'))
  expect(help('lfo2_target')).toBe(help('lfo1_target'))
  expect(help('nope')).toBe(undefined)
})
