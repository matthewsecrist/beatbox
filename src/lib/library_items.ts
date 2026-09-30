import type { TrackId } from './types.js'

// The Loop Browser's content; `library.ts` turns it into loops and patterns.
//
// A loop's `score` is bars separated by `|`, each 16 sixteenth-note steps: a note
// (`A3`, `C#4`, `Bb2`, or a chord like `A3+C4+E4`) starts on that step, `-` holds
// the notes before it one more step, `.` is a rest. A `~` after a note (`C3~`)
// slides it into the next one: the two overlap, so a sound with legato glide
// (Acid Bass, Deep Sub, …) glides between them. `sound` is a factory preset.
//
// A beat is one 16-step drum pattern, one string per track (the ids in `TRACKS`,
// `src/lib/drums/kits.ts`, percussion included): `x` hit, `X` accented hit, `o`
// soft hit (half velocity), `?` hit half the time, `2` `3` `4` that many hits in
// the step (a ratchet roll), `.` rest. Tracks left out are silent.

export interface BeatSpec {
  genre: string
  name: string
  tracks: BeatTracks
}

export type BeatTracks = Partial<Record<TrackId, string>>

export interface LoopSpec {
  genre: string
  instrument: 'Arp' | 'Bass' | 'Chords' | 'Lead'
  name: string
  score: string
  sound: string
}

export const LOOP_SPECS: LoopSpec[] = [
  // Afrobeat
  {
    genre: 'Afrobeat',
    instrument: 'Bass',
    name: 'Fela Bass Riff',
    score: 'D2 - . D2 . . F2 . G2 - . A2 . . C3 . | D2 - . D2 . . F2 . G2 . F2 . D2 - . .',
    sound: 'Pluck'
  },
  {
    genre: 'Afrobeat',
    instrument: 'Chords',
    name: 'Afropop Organ Skank',
    score: [
      'Eb4+G4+Bb4 . . Eb4+G4+Bb4 - . Eb4+G4+Bb4 - . . Eb4+G4+Bb4 - Eb4+G4+Bb4 . . .',
      'C4+Eb4+G4 . . C4+Eb4+G4 - . C4+Eb4+G4 - . . C4+Eb4+G4 - C4+Eb4+G4 . . .',
      'Ab3+C4+Eb4 . . Ab3+C4+Eb4 - . Ab3+C4+Eb4 - . . Ab3+C4+Eb4 - Ab3+C4+Eb4 . . .',
      'Bb3+D4+F4 . . Bb3+D4+F4 - . Bb3+D4+F4 - . . Bb3+D4+F4 - Bb3+D4+F4 . . .'
    ].join(' | '),
    sound: 'Organ'
  },
  {
    genre: 'Afrobeat',
    instrument: 'Lead',
    name: 'Highlife Guitar',
    score: [
      'E4 . G4 E4 . A4 . G4 E4 . D4 . E4 . G4 .',
      'A4 . G4 E4 . D4 . E4 G4 . A4 . B4 . A4 .'
    ].join(' | '),
    sound: 'Pluck'
  },
  {
    genre: 'Afrobeat',
    instrument: 'Lead',
    name: 'Shrine Horn Line',
    score: 'D5 - . D5 . C5 A4 - . . G4 - A4 - . . | F4 - G4 - A4 . . C5 - . A4 - G4 - . .',
    sound: 'Brass'
  },
  {
    genre: 'Afrobeat',
    instrument: 'Arp',
    name: 'Palm Wine Picking',
    score: [
      'Bb4 . G4 . Eb5 . Bb4 G4 . Bb4 . C5 . Bb4 G4 .',
      'Ab4 . F4 . C5 . Ab4 F4 . Ab4 . Bb4 . G4 . .'
    ].join(' | '),
    sound: 'Pluck'
  },

  // Amapiano
  {
    genre: 'Amapiano',
    instrument: 'Bass',
    name: 'Log Drum Bounce',
    score: 'F3 - . F3 . . Ab3 - . . F3 . C4 - Bb3 - | F3 - . F3 . . Eb3 - . . F3 . . . C3 -',
    sound: 'Deep Sub'
  },
  {
    genre: 'Amapiano',
    instrument: 'Bass',
    name: 'Yanos Log Slide',
    score: [
      'G3 . . G3 . . G3~ A3~ Bb3 . . D4 - . G3 .',
      'C4 . . C4 . . C4~ Bb3~ A3 . . G3 - . D3 .'
    ].join(' | '),
    sound: 'Deep Sub'
  },
  {
    genre: 'Amapiano',
    instrument: 'Chords',
    name: 'Private School Keys',
    score: [
      'Gb3+Bb3+Db4+F4 - - . . . Gb3+Bb3+Db4+F4 - . . Gb3+Bb3+Db4+F4 . . . . .',
      'F3+Ab3+C4+Eb4 - - . . . F3+Ab3+C4+Eb4 - . . Eb3+Gb3+Bb3+Db4 - - - . .'
    ].join(' | '),
    sound: 'Organ'
  },
  {
    genre: 'Amapiano',
    instrument: 'Chords',
    name: 'Soweto Night Pad',
    score: [
      'C3+Eb3+G3+Bb3+D4 - - - - - - - - - - - - - - -',
      'Ab3+C4+Eb4+G4 - - - - - - - - - - - - - - -',
      'Bb3+D4+F4+G4 - - - - - - - - - - - - - - -',
      'G3+Bb3+D4+F4 - - - - - - - - - - - . . . .'
    ].join(' | '),
    sound: 'Warm Pad'
  },
  {
    genre: 'Amapiano',
    instrument: 'Arp',
    name: 'Marimba Shaker Arp',
    score: 'A4 . . E4 . . C5 . . A4 . . G4 . E4 . | F4 . . C5 . . A4 . . F4 . . E4 . G4 .',
    sound: 'Bell'
  },

  // Ambient
  {
    genre: 'Ambient',
    instrument: 'Bass',
    name: 'Lydian Sub Drone',
    score: 'F3 - - - - - - - - - - - - - - - | - - - - - - - - G3 - - - - - - -',
    sound: 'Deep Sub'
  },
  {
    genre: 'Ambient',
    instrument: 'Chords',
    name: 'Slow Swell',
    score: [
      'D3+A3+E4 - - - - - - - - - - - - - - -',
      '- - - - - - - - - - - - - - - -',
      'Bb2+F3+C4 - - - - - - - - - - - - - - -',
      '- - - - - - - - - - - - - - - -'
    ].join(' | '),
    sound: 'Warm Pad'
  },
  {
    genre: 'Ambient',
    instrument: 'Chords',
    name: 'Glacier Pad',
    score: [
      'E3+B3+D#4+F#4 - - - - - - - - - - - - - - -',
      '- - - - - - - - - - - - - - - -',
      'C#3+G#3+B3+E4 - - - - - - - - - - - - - - -',
      '- - - - - - - - - - - - . . . .'
    ].join(' | '),
    sound: 'Pulse Pad'
  },
  {
    genre: 'Ambient',
    instrument: 'Chords',
    name: 'Thin Air',
    score: [
      'A3+E4+B4+C#5 - - - - - - - - - - - - - - -',
      '- - - - - - - - - - - - - - - -',
      'F#3+C#4+E4+A4 - - - - - - - - - - - - - - -',
      '- - - - - - - - - - - - . . . .'
    ].join(' | '),
    sound: 'Airy Pad'
  },
  {
    genre: 'Ambient',
    instrument: 'Lead',
    name: 'Tidal Drift Melody',
    score: [
      'E5 - - - - - - - D5 - - - G4 - - -',
      '- - - - - - - - . . . . . . . .',
      'C5 - - - - - - - B4 - - - G4 - - -',
      'A4 - - - - - - - - - - - . . . .'
    ].join(' | '),
    sound: 'Flute'
  },
  {
    genre: 'Ambient',
    instrument: 'Arp',
    name: 'Glass Bell Arp',
    score: 'A4 . . . E5 . . . C#5 . . . B4 . . . | F#4 . . . E5 . . . C#5 . . . A4 . . .',
    sound: 'Bell'
  },
  {
    genre: 'Ambient',
    instrument: 'Chords',
    name: 'Tidepool',
    score: [
      'D3+A3+E4+F#4 - - - - - - - - - - - - - - -',
      '- - - - - - - - - - - - - - - -',
      'B2+F#3+D4+A4 - - - - - - - - - - - - - - -',
      '- - - - - - - - - - - - . . . .'
    ].join(' | '),
    sound: 'Ocean Pad'
  },
  {
    genre: 'Ambient',
    instrument: 'Chords',
    name: 'Mountain Wind',
    score: ['D4+A4 - - - - - - - - - - - - - - -', '- - - - - - - - - - - - - - - -'].join(' | '),
    sound: 'Wind'
  },

  // Breakbeat
  {
    genre: 'Breakbeat',
    instrument: 'Bass',
    name: 'Nu Skool Reese',
    score: 'E2 - - - - - . E2 - - G2~ - - - A2 - | E2 - - - - - . E2 - - D3~ - B2~ - G2 -',
    sound: 'Reese Bass'
  },
  {
    genre: 'Breakbeat',
    instrument: 'Bass',
    name: 'Florida Breaks Bass',
    score: 'A3 - . A3 . . A4 . . A3 . C4 . D4~ E4 . | F3 - . F3 . . F4 . G3 - . G3 . . G4 .',
    sound: 'Acid Bass'
  },
  {
    genre: 'Breakbeat',
    instrument: 'Chords',
    name: 'Hardcore Rave Stabs',
    score: [
      'C4+Eb4+G4+Bb4 . . C4+Eb4+G4+Bb4 . . . . . . C4+Eb4+G4+Bb4 . . . . .',
      'Ab3+C4+Eb4+G4 . . Ab3+C4+Eb4+G4 . . . . . . Bb3+D4+F4+Ab4 - . . . .'
    ].join(' | '),
    sound: 'Hoover'
  },
  {
    genre: 'Breakbeat',
    instrument: 'Lead',
    name: 'Big Beat Siren',
    score: 'F#4 - . F#4 A4 - . B4 - . C#5 - B4 - A4 - | F#4 - - - - - . . E4 - - - F#4 - . .',
    sound: 'Hoover'
  },
  {
    genre: 'Breakbeat',
    instrument: 'Arp',
    name: 'Breakz Pluck Arp',
    score: [
      'D4 . A4 D5 . A4 F4 . D4 . A4 D5 . C5 A4 .',
      'Bb3 . F4 Bb4 . F4 D4 . Bb3 . F4 Bb4 . A4 F4 .'
    ].join(' | '),
    sound: 'Pluck'
  },

  // Chiptune
  {
    genre: 'Chiptune',
    instrument: 'Bass',
    name: 'Chip Bass',
    score: [
      'C3 . C3 C4 . C3 . C4 A2 . A2 A3 . A2 . A3',
      'F2 . F2 F3 . F2 . F3 G2 . G2 G3 . G2 . G3'
    ].join(' | '),
    sound: 'Chiptune'
  },
  {
    genre: 'Chiptune',
    instrument: 'Chords',
    name: 'Castle Stage Chords',
    score: [
      'D4+F4+A4 . D4+F4+A4 . . D4+F4+A4 . . Bb3+D4+F4 . Bb3+D4+F4 . . Bb3+D4+F4 . .',
      'C4+E4+G4 . C4+E4+G4 . . C4+E4+G4 . . A3+C#4+E4 . A3+C#4+E4 . . A3+C#4+E4 - -'
    ].join(' | '),
    sound: 'Chiptune'
  },
  {
    genre: 'Chiptune',
    instrument: 'Lead',
    name: 'Chip Melody',
    score: 'C5 . E5 . G5 . C6 - . . B5 . G5 - . . | F5 . E5 . D5 - . . C5 - - - . . . .',
    sound: 'Chiptune'
  },
  {
    genre: 'Chiptune',
    instrument: 'Lead',
    name: 'Boss Battle Lead',
    score: [
      'E5 . B4 . E5 F#5 G5 . F#5 . E5 . D5 . B4 .',
      'C5 . E5 . G5 . F#5 . E5 . D#5 . B4 - - -'
    ].join(' | '),
    sound: 'Chiptune'
  },
  {
    genre: 'Chiptune',
    instrument: 'Arp',
    name: 'Chip Arp Run',
    score: [
      'A3 C4 E4 A4 C5 E4 A4 C5 F3 A3 C4 F4 A4 C4 F4 A4',
      'G3 B3 D4 G4 B4 D4 G4 B4 E3 G#3 B3 E4 G#4 B3 E4 G#4'
    ].join(' | '),
    sound: 'Chiptune'
  },

  // Disco
  {
    genre: 'Disco',
    instrument: 'Bass',
    name: 'Disco Octaves',
    score: [
      'F2 - F3 - F2 - F3 - F2 - F3 - F2 - F3 -',
      'D2 - D3 - D2 - D3 - G2 - G3 - G2 - G3 -'
    ].join(' | '),
    sound: 'Pluck'
  },
  {
    genre: 'Disco',
    instrument: 'Bass',
    name: 'Studio Hustle Bass',
    score: [
      'A2 . A3 . A2 . A3 A2 . A2 A3 . G2 . G3 .',
      'F2 . F3 . F2 . F3 F2 . F2 F3 . E2 . E3 G#2'
    ].join(' | '),
    sound: 'Pluck'
  },
  {
    genre: 'Disco',
    instrument: 'Chords',
    name: 'Disco Strings',
    score: [
      '. . F4+A4+C5 - . . F4+A4+C5 - . . F4+A4+C5 - . . E4+G4+C5 -',
      '. . D4+F4+A4 - . . D4+F4+A4 - . . G4+B4+D5 - . . G4+B4+D5 -'
    ].join(' | '),
    sound: 'Strings'
  },
  {
    genre: 'Disco',
    instrument: 'Chords',
    name: 'Mirrorball Clav',
    score: [
      '. . C4+Eb4+G4+Bb4 . . . C4+Eb4+G4+Bb4 - . . C4+Eb4+G4+Bb4 . C4+Eb4+G4+Bb4 . . .',
      '. . F3+A3+C4+Eb4 . . . F3+A3+C4+Eb4 - . . F3+A3+C4+Eb4 . F3+A3+C4+Eb4 . . .'
    ].join(' | '),
    sound: 'Wah Clav'
  },
  {
    genre: 'Disco',
    instrument: 'Lead',
    name: 'Philly String Rise',
    score: 'G4 A4 B4 D5 E5 F#5 G5 - - - . . D5 - - - | E5 - D5 - B4 - - - A4 - G4 - - - - -',
    sound: 'Strings'
  },

  // Drill
  {
    genre: 'Drill',
    instrument: 'Bass',
    name: 'Gritty Drill Glide',
    score: [
      'F3 - - . . F3~ Ab3 - . . . . Gb3~ F3 - .',
      'Db3 - - . . . Db3 . Eb3~ F3 - - . . C3 -'
    ].join(' | '),
    sound: 'Dirty 808'
  },
  {
    genre: 'Drill',
    instrument: 'Bass',
    name: 'Drill Glide 808',
    score: 'F#3 - - - - - F#3~ - - - A3~ - - G#3 - - | F#3 - - - - - E3~ - - - D3~ - - - C#3 -',
    sound: 'Deep Sub'
  },
  {
    genre: 'Drill',
    instrument: 'Bass',
    name: 'Brixton 808 Bounce',
    score: 'C3 - - - - - C4~ - - - Bb3 - . G3 - - | Ab3 - - - - - - - G3~ - - - F3~ - Eb3 -',
    sound: 'Deep Sub'
  },
  {
    genre: 'Drill',
    instrument: 'Chords',
    name: 'Dark Drill Strings',
    score: [
      'G3+Bb3+D4 - - - - - - - - - - - - - - -',
      'G3+Bb3+Eb4 - - - - - - - - - - - - - - -',
      'G3+C4+Eb4 - - - - - - - - - - - - - - -',
      'F#3+A3+D4 - - - - - - - - - - - - - - -'
    ].join(' | '),
    sound: 'Strings'
  },
  {
    genre: 'Drill',
    instrument: 'Lead',
    name: 'Drill Bell Melody',
    score: 'B4 . . G4 . . E4 . D#4 . . E4 . . F#4 . | G4 - - . . . F#4 . E4 . D#4 . B3 - - .',
    sound: 'Bell'
  },
  {
    genre: 'Drill',
    instrument: 'Arp',
    name: 'Drill Piano Riff',
    score: [
      'Bb3 . Db4 . F4 . Db4 . Bb3 . Db4 . Gb4 . F4 .',
      'Bb3 . Db4 . F4 . Db4 . A3 . C4 . F4 . Eb4 .'
    ].join(' | '),
    sound: 'Electric Piano'
  },

  // Drum & Bass
  {
    genre: 'Drum & Bass',
    instrument: 'Bass',
    name: 'Neuro Fold Stab',
    score: ['E3 - . E3 . . G3 - . E3 . . D3 - B2 .', 'E3 - . E3 . . A3 - . G3 . . E3 - . .'].join(
      ' | '
    ),
    sound: 'Fold Growl'
  },
  {
    genre: 'Drum & Bass',
    instrument: 'Bass',
    name: 'Reese Roller',
    score: 'C3 - - - - - - - - - - - Eb3~ - - - | Bb2 - - - - - - - - - - - G2 - - -',
    sound: 'Reese Bass'
  },
  {
    genre: 'Drum & Bass',
    instrument: 'Bass',
    name: 'Jungle Reese',
    score: 'F2 - - - - - - - F2 - Ab2~ - - - C3 - | Db3 - - - - - - - C3~ - - - Ab2~ - G2 -',
    sound: 'Reese Bass'
  },
  {
    genre: 'Drum & Bass',
    instrument: 'Chords',
    name: 'Liquid Pad Sevenths',
    score: [
      'A3+C4+E4+G4 - - - - - - - - - - - - - - -',
      'F3+A3+C4+E4 - - - - - - - - - - - - - - -',
      'D3+F3+A3+C4 - - - - - - - - - - - - - - -',
      'E3+G3+B3+D4 - - - - - - - - - - - - - - -'
    ].join(' | '),
    sound: 'Warm Pad'
  },
  {
    genre: 'Drum & Bass',
    instrument: 'Lead',
    name: 'Rave Hoover Lead',
    score: 'G4 - - - - - - - F4 - G4 - Bb4 - - - | A4 - - - - - - - F4 - - - D4 - - -',
    sound: 'Hoover'
  },
  {
    genre: 'Drum & Bass',
    instrument: 'Arp',
    name: 'Liquid Pluck Arp',
    score: [
      'E3 B3 G4 B3 D4 B3 G4 F#4 E3 B3 G4 B3 D4 B3 F#4 G4',
      'C3 G3 E4 G3 B3 G3 E4 D4 C3 G3 E4 G3 B3 G3 D4 E4'
    ].join(' | '),
    sound: 'Pluck'
  },

  // Dubstep
  {
    genre: 'Dubstep',
    instrument: 'Bass',
    name: 'Folded Growl Riff',
    score: [
      'F3 - - - . . F3 - Ab3 - . . F3 . C4 -',
      'Eb3 - - . . . Eb3~ F3 - - - . . . Db3 -'
    ].join(' | '),
    sound: 'Fold Growl'
  },
  {
    genre: 'Dubstep',
    instrument: 'Bass',
    name: 'Wobble Drop',
    score: 'E3 - - - - - . . E3 - G3 - - - . . | E3 - - - - - . . D3 - - - B2 - - -',
    sound: 'Dubstep Wobble'
  },
  {
    genre: 'Dubstep',
    instrument: 'Bass',
    name: 'Growl Stabs',
    score: 'F3 - . . . . . . F3 . F3 . Ab3 - - - | C3 - - - - - - - . . Eb3 - Db3 - - -',
    sound: 'Dubstep Wobble'
  },
  {
    genre: 'Dubstep',
    instrument: 'Bass',
    name: 'Riddim Chug',
    score: 'G3 - - . G3 - - . . . G3 . G3 - - . | G3 - - . G3 - - . . . Bb3 . A3 - - .',
    sound: 'Dubstep Wobble'
  },
  {
    genre: 'Dubstep',
    instrument: 'Chords',
    name: 'Halftime Minor Pad',
    score: [
      'D3+F3+A3 - - - - - - - - - - - - - - -',
      'D3+F3+Bb3 - - - - - - - - - - - - - - -',
      'D3+G3+Bb3 - - - - - - - - - - - - - - -',
      'C#3+E3+A3 - - - - - - - - - - - - - - -'
    ].join(' | '),
    sound: 'Warm Pad'
  },
  {
    genre: 'Dubstep',
    instrument: 'Lead',
    name: 'Riddim Square Lead',
    score: 'G4 . G4 . Bb4 . . G4 . . D5 . C5 . Bb4 . | A4 - - - . . F4 . G4 - - - . . . .',
    sound: 'Square Lead'
  },

  // Electro
  {
    genre: 'Electro',
    instrument: 'Bass',
    name: 'Robot Buzz Line',
    score: [
      'C3 . C3 . Eb3 . C3 . G3 - . C3 . Bb2 . .',
      'C3 . C3 . Eb3 . F3 . G3 - . Bb3 . G3 F3 Eb3'
    ].join(' | '),
    sound: 'Buzz Bass'
  },
  {
    genre: 'Electro',
    instrument: 'Bass',
    name: 'Robot Funk Bass',
    score: [
      'E2 . E2 E3 . E2 . G2 . G2 . A2 . B2 D3 .',
      'E2 . E2 E3 . E2 . G2 . G2 . D3 . B2 A2 .'
    ].join(' | '),
    sound: 'Chiptune'
  },
  {
    genre: 'Electro',
    instrument: 'Chords',
    name: 'Electro Stab Chords',
    score: [
      '. . A3+C4+E4 . . . A3+C4+E4 . . . G3+B3+D4 . . . . .',
      '. . F3+A3+C4 . . . F3+A3+C4 . . . G3+B3+D4 . . . G3+B3+D4 .'
    ].join(' | '),
    sound: 'Supersaw Lead'
  },
  {
    genre: 'Electro',
    instrument: 'Lead',
    name: 'Electro Zap',
    score: 'C5 . . C5 . . Eb5 . . G5 . . F5 . Eb5 .',
    sound: 'Chiptune'
  },
  {
    genre: 'Electro',
    instrument: 'Lead',
    name: 'Breakdance Lead',
    score: 'D5 . . D5 . . F5 . D5 . C5~ - A4 - - . | D5 . . D5 . . F5 . G5 . F5 . E5~ - C5 .',
    sound: 'Square Lead'
  },
  {
    genre: 'Electro',
    instrument: 'Arp',
    name: 'Circuit Arp',
    score: [
      'C3 C4 G3 C4 Eb4 C4 G3 C4 C3 C4 G3 C4 Bb3 C4 G3 C4',
      'Ab3 C4 Eb4 C4 G4 C4 Eb4 C4 Bb3 D4 F4 D4 G4 D4 F4 D4'
    ].join(' | '),
    sound: 'Square Lead'
  },

  // Funk
  {
    genre: 'Funk',
    instrument: 'Chords',
    name: 'Gritty Organ Comp',
    score: [
      '. . D4+F4+A4+C5 . . D4+F4+A4+C5 . . . . D4+F4+A4+C5 . D4+F4+A4+C5 . . .',
      '. . G3+B3+D4+F4 . . G3+B3+D4+F4 . . . . G3+B3+D4+F4 . . G3+B3+D4+F4 - .'
    ].join(' | '),
    sound: 'Overdrive Organ'
  },
  {
    genre: 'Funk',
    instrument: 'Bass',
    name: 'Slap Pop',
    score: 'E2 - . E2 . . G2 . A2 - . E3 . D3 B2 .',
    sound: 'Pluck'
  },
  {
    genre: 'Funk',
    instrument: 'Bass',
    name: 'Bootsy Octave Bass',
    score: [
      'G3 . G4 . . G3 Bb3 . C4 . . G3 . F3~ F#3 .',
      'G3 . G4 . . G3 Bb3 . C4 . C#4~ D4 . F4 D4 .'
    ].join(' | '),
    sound: 'Acid Bass'
  },
  {
    genre: 'Funk',
    instrument: 'Chords',
    name: 'Clavinet Chank',
    score: [
      '. . G#3+D4+F#4 . G#3+D4+F#4 . . G#3+D4+F#4 . . G#3+D4+F#4 . G#3+D4+F#4 . . .',
      '. . G3+C#4+F#4 . G3+C#4+F#4 . . G3+C#4+F#4 . . G#3+D4+F#4 . G#3+D4+F#4 . G#3+D4+F#4 .'
    ].join(' | '),
    sound: 'Wah Clav'
  },
  {
    genre: 'Funk',
    instrument: 'Lead',
    name: 'Funky Horn Stabs',
    score: [
      'Bb4 . . Bb4 . . C5 - . . Db5 . C5 . Bb4 .',
      'G4 - - - . . . . F4 . Ab4 . Bb4 - . .'
    ].join(' | '),
    sound: 'Brass'
  },
  {
    genre: 'Funk',
    instrument: 'Arp',
    name: 'Wah Guitar Scratch',
    score: 'D4 . D4 F4 . D4 A4 . D4 . C4 . D4 . F4 G4',
    sound: 'Auto-Wah Lead'
  },
  {
    genre: 'Funk',
    instrument: 'Bass',
    name: 'Minimoog Funk',
    score: 'E3 . . E3 G3 . E3 . A3 - . G3 . E3 D3 . | E3 . . E3 G3 . E3 . B3 - . A3 . G3~ A3 .',
    sound: 'Moog Bass'
  },

  // Hip-hop
  {
    genre: 'Hip-hop',
    instrument: 'Bass',
    name: 'Boom Bap Upright',
    score: 'D2 - - . . . . D2 F2 - . . A2 - G2 . | Bb2 - - . . . . Bb2 A2 - . . G2 - F2 .',
    sound: 'Pluck'
  },
  {
    genre: 'Hip-hop',
    instrument: 'Chords',
    name: 'Soul Keys',
    score: [
      'Eb4+G4+Bb4 - - - - - . . . . D4+F4+Bb4 - - - . .',
      'C4+Eb4+G4 - - - - - - - - - - - . . . .'
    ].join(' | '),
    sound: 'Electric Piano'
  },
  {
    genre: 'Hip-hop',
    instrument: 'Chords',
    name: 'Dusty Ninths',
    score: [
      'Ab3+C4+Eb4+G4 - - - - - - - - - . . Ab3+C4+Eb4+G4 - . .',
      'Ab3+Db4+F4+C4 - - - - - - - - - . . G3+Bb3+Db4+F4 - - -'
    ].join(' | '),
    sound: 'Radio Keys'
  },
  {
    genre: 'Hip-hop',
    instrument: 'Lead',
    name: 'Golden Era Hook',
    score: 'A4 - - - C5 - - . E5 - D5 - C5 - A4 - | G4 - - - - - A4 - - - - - . . . .',
    sound: 'Flute'
  },
  {
    genre: 'Hip-hop',
    instrument: 'Arp',
    name: 'Vinyl Pluck Arp',
    score: [
      'C4 . Eb4 . G4 . Bb4 . G4 . Eb4 . C4 . . .',
      'Ab3 . C4 . Eb4 . G4 . Eb4 . C4 . Ab3 . . .'
    ].join(' | '),
    sound: 'Pluck'
  },

  // House
  {
    genre: 'House',
    instrument: 'Bass',
    name: 'Offbeat Bass',
    score: '. . A3 - . . A3 - . . A3 - . . A3 - | . . A3 - . . A3 - . . G3~ - - - C4 -',
    sound: 'Acid Bass'
  },
  {
    genre: 'House',
    instrument: 'Bass',
    name: 'Hollow Deep Bass',
    score: 'A3 - . A3 . . C4 . . A3 . . G3 - E3 . | F3 - . F3 . . A3 . . F3 . . G3 - . .',
    sound: 'Hollow Bass'
  },
  {
    genre: 'House',
    instrument: 'Chords',
    name: 'Organ Stabs',
    score: '. . C4+E4+G4 . . . C4+E4+G4 . . . C4+E4+G4 . . . C4+E4+G4 .',
    sound: 'Organ'
  },
  {
    genre: 'House',
    instrument: 'Chords',
    name: 'Piano House Riff',
    score: [
      '. . A3+C4+E4+G4 . . . A3+C4+E4+G4 . . . . . A3+C4+E4+G4 . . .',
      '. . D4+F4+A4+C5 . . . D4+F4+A4+C5 . . . . . D4+F4+A4+C5 - . .'
    ].join(' | '),
    sound: 'Organ'
  },
  {
    genre: 'House',
    instrument: 'Lead',
    name: 'Filter House Hook',
    score: 'G4 . . G4 . . Bb4 - . . D5 . C5 - Bb4 . | G4 . . G4 . . F4 - . . G4 - - - . .',
    sound: 'Supersaw Lead'
  },
  {
    genre: 'House',
    instrument: 'Arp',
    name: 'Jackin Pluck Arp',
    score: [
      'F3 C4 Ab3 F4 . C4 Ab3 F4 C4 . Ab3 F4 C4 Ab3 . Eb4',
      'Db3 Ab3 F3 Db4 . Ab3 F3 Db4 Ab3 . F3 Db4 Ab3 F3 . C4'
    ].join(' | '),
    sound: 'Pluck'
  },
  {
    genre: 'House',
    instrument: 'Bass',
    name: 'Deep House Sub Pluck',
    score: 'A3 . . A3 . . C4 . A3 . . . E3 . G3 . | F3 . . F3 . . A3 . F3 . . . G3 . G3 .',
    sound: 'Sub Pluck Bass'
  },

  // Latin
  {
    genre: 'Latin',
    instrument: 'Bass',
    name: 'Salsa Tumbao',
    score: 'A3 - - - - - E3 - - - - - E3 - - - | - - - - - - B3 - - - - - A3 - - -',
    sound: 'Deep Sub'
  },
  {
    genre: 'Latin',
    instrument: 'Bass',
    name: 'Cumbia Bajo',
    score: 'G2 - - . . . . . D2 - - . . . G2 . | D2 - - . . . . . A2 - - . . . D2 .',
    sound: 'Pluck'
  },
  {
    genre: 'Latin',
    instrument: 'Chords',
    name: 'Montuno',
    score: [
      'C4+E4 . G4 C4+E4 . G4 . C4+E4 . G4 C4+E4 . G4 . F4 .',
      'G3+B3 . D4 G3+B3 . D4 . G3+B3 . D4 G3+B3 . F4 . E4 .'
    ].join(' | '),
    sound: 'Electric Piano'
  },
  {
    genre: 'Latin',
    instrument: 'Chords',
    name: 'Bossa Guitar Comp',
    score: [
      'F#3+A3+C#4+E4 - . F#3+A3+C#4+E4 - . F#3+A3+C#4+E4 - . . F#3+A3+C#4+E4 - F#3+A3+C#4+E4 - . .',
      '. . G3+B3+D4+F#4 - G3+B3+D4+F#4 - . G3+B3+D4+F#4 - . G3+B3+D4+F#4 - . G3+B3+D4+F#4 - .',
      'G3+C#4+F#4 - . G3+C#4+F#4 - . G3+C#4+F#4 - . . G3+C#4+F#4 - G3+C#4+F#4 - . .',
      '. . F#3+A3+C#4+E4 - F#3+A3+C#4+E4 - . F#3+A3+C#4+E4 - . F#3+A3+C#4+E4 - . F#3+A3+C#4+E4 - .'
    ].join(' | '),
    sound: 'Pluck'
  },
  {
    genre: 'Latin',
    instrument: 'Lead',
    name: 'Mambo Horn Line',
    score: 'A4 - . . . . C5 - . . . . F5 - - . | . . . . E5 - . . D5 - . . C5 - Bb4 A4',
    sound: 'Brass'
  },

  // Lo-fi
  {
    genre: 'Lo-fi',
    instrument: 'Bass',
    name: 'Walking Bass',
    score: 'D3 - - - F3 - - - A3 - - - C4 - - - | G2 - - - B2 - - - D3 - - - F3 - - -',
    sound: 'Pluck'
  },
  {
    genre: 'Lo-fi',
    instrument: 'Chords',
    name: 'Lo-fi Sevenths',
    score: [
      'F3+A3+C4+E4 - - - - - . . F3+A3+C4+E4 - - - - - . .',
      'E3+G3+B3+D4 - - - - - . . E3+G3+B3+D4 - - - - - . .',
      'D3+F3+A3+C4 - - - - - . . D3+F3+A3+C4 - - - - - . .',
      'C3+E3+G3+B3 - - - - - - - - - - - - - . .'
    ].join(' | '),
    sound: 'Warm Pad'
  },
  {
    genre: 'Lo-fi',
    instrument: 'Chords',
    name: 'Rainy Rhodes',
    score: [
      'Ab3+C4+Eb4+G4 - - - - - . . . . Ab3+C4+Eb4+G4 - - - . .',
      'Ab3+D4+G4 - - - - - - - - - - - - - . .',
      'G3+Bb3+D4+F4 - - - - - . . . . G3+Bb3+D4+F4 - - - . .',
      'Eb3+G3+Bb3+D4 - - - - - - - - - - - - - . .'
    ].join(' | '),
    sound: 'Electric Piano'
  },
  {
    genre: 'Lo-fi',
    instrument: 'Chords',
    name: 'AM Radio Chords',
    score: [
      'D3+F3+A3+C4 - - - . . D3+F3+A3+C4 - . . . . D3+F3+A3+C4 - . .',
      'G3+B3+D4+F4 - - - . . G3+B3+D4+F4 - . . . . G3+B3+D4+F4 - - -'
    ].join(' | '),
    sound: 'Radio Keys'
  },
  {
    genre: 'Lo-fi',
    instrument: 'Lead',
    name: 'Sleepy Kalimba',
    score: 'A4 . C5 . . . A4 G4 . . F4 . . . . . | D4 . F4 . G4 . . A4 - - - . . . . .',
    sound: 'Bell'
  },
  {
    genre: 'Lo-fi',
    instrument: 'Arp',
    name: 'Late Night Arp',
    score: [
      'D3 . A3 . C4 . E4 . F4 . E4 . C4 . A3 .',
      'G3 . Bb3 . D4 . F4 . A4 . F4 . D4 . Bb3 .'
    ].join(' | '),
    sound: 'Electric Piano'
  },
  {
    genre: 'Lo-fi',
    instrument: 'Chords',
    name: 'Tape Hiss Keys',
    score: [
      'Bb3+D4+F4+A4 - - - - - . . Bb3+D4+F4+A4 - - - . . . .',
      'A3+C4+E4+G4 - - - - - - - - - - - . . . .'
    ].join(' | '),
    sound: 'Vinyl Keys'
  },

  // Pop
  {
    genre: 'Pop',
    instrument: 'Bass',
    name: 'Whisper Pop Bass',
    score: ['G2 - - . . . G2 . Bb2 - . . C3 - . .', 'D3 - . . C3 . Bb2 . G2 - - . . . F2 .'].join(
      ' | '
    ),
    sound: 'Buzz Bass'
  },
  {
    genre: 'Pop',
    instrument: 'Bass',
    name: 'Chorus Pump Bass',
    score: [
      'G3 - - G3 - - G3 - G3 - - G3 - - G3 -',
      'D3 - - D3 - - D3 - D3 - - D3 - - D3 -',
      'E3 - - E3 - - E3 - E3 - - E3 - - E3 -',
      'C3 - - C3 - - C3 - C3 - - C3 - - C3 -'
    ].join(' | '),
    sound: 'Deep Sub'
  },
  {
    genre: 'Pop',
    instrument: 'Chords',
    name: 'Four Chord Pop',
    score: [
      'C4+E4+G4 - C4+E4+G4 - C4+E4+G4 - C4+E4+G4 - C4+E4+G4 - C4+E4+G4 - C4+E4+G4 - C4+E4+G4 -',
      'G3+B3+D4 - G3+B3+D4 - G3+B3+D4 - G3+B3+D4 - G3+B3+D4 - G3+B3+D4 - G3+B3+D4 - G3+B3+D4 -',
      'A3+C4+E4 - A3+C4+E4 - A3+C4+E4 - A3+C4+E4 - A3+C4+E4 - A3+C4+E4 - A3+C4+E4 - A3+C4+E4 -',
      'F3+A3+C4 - F3+A3+C4 - F3+A3+C4 - F3+A3+C4 - F3+A3+C4 - F3+A3+C4 - F3+A3+C4 - F3+A3+C4 -'
    ].join(' | '),
    sound: 'Electric Piano'
  },
  {
    genre: 'Pop',
    instrument: 'Chords',
    name: 'Stadium Ballad Pad',
    score: [
      'F#3+A3+D4 - - - - - - - - - - - - - - -',
      'E3+A3+C#4 - - - - - - - - - - - - - - -',
      'F#3+B3+D4 - - - - - - - - - - - - - - -',
      'G3+B3+D4 - - - - - - - - - - - - - - -'
    ].join(' | '),
    sound: 'Warm Pad'
  },
  {
    genre: 'Pop',
    instrument: 'Lead',
    name: 'Radio Topline',
    score: 'D5 - . D5 - . C5 - Bb4 - . . F4 - . . | G4 - . G4 - . F4 - D5 - - - C5 - Bb4 -',
    sound: 'Vibrato Lead'
  },
  {
    genre: 'Pop',
    instrument: 'Arp',
    name: 'Tropical Pluck Arp',
    score: [
      'A3 . E4 A4 . C4 . E4 A3 . E4 A4 . C4 . E4',
      'F3 . C4 F4 . A3 . C4 F3 . C4 F4 . A3 . C4',
      'C4 . G4 C5 . E4 . G4 C4 . G4 C5 . E4 . G4',
      'G3 . D4 G4 . B3 . D4 G3 . D4 G4 . B3 . D4'
    ].join(' | '),
    sound: 'Pluck'
  },
  {
    genre: 'Pop',
    instrument: 'Arp',
    name: 'Crystal Pluck Arp',
    score: [
      'E4 . B4 . G4 E5 . B4 E4 . B4 . G4 E5 . B4',
      'C4 . G4 . E4 C5 . G4 C4 . G4 . E4 C5 . G4'
    ].join(' | '),
    sound: 'Glass Pluck'
  },

  // Reggae
  {
    genre: 'Reggae',
    instrument: 'Bass',
    name: 'Rockers Dub Bass',
    score: 'A3 - - - - - . . C4 - D4 - E3 - G3 - | D3 - - - - - . . F3 - A3 - . . C4 -',
    sound: 'Deep Sub'
  },
  {
    genre: 'Reggae',
    instrument: 'Chords',
    name: 'Skank Chords',
    score: [
      '. . . . G3+B3+D4 . . . . . . . G3+B3+D4 . . .',
      '. . . . C4+E4+G4 . . . . . . . D4+F#4+A4 . . .'
    ].join(' | '),
    sound: 'Organ'
  },
  {
    genre: 'Reggae',
    instrument: 'Chords',
    name: 'Bubble Organ',
    score: [
      '. . D4+F#4+A4 D4+F#4+A4 . . D4+F#4+A4 D4+F#4+A4 . . D4+F#4+A4 D4+F#4+A4 . . D4+F#4+A4 D4+F#4+A4',
      '. . D4+G4+B4 D4+G4+B4 . . D4+G4+B4 D4+G4+B4 . . C#4+E4+A4 C#4+E4+A4 . . C#4+E4+A4 C#4+E4+A4'
    ].join(' | '),
    sound: 'Organ'
  },
  {
    genre: 'Reggae',
    instrument: 'Lead',
    name: 'Melodica Dub',
    score: 'E4 - - - G4 - A4 - B4 - - - . . . . | D5 - B4 - A4 - G4 - E4 - - - - - . .',
    sound: 'Flute'
  },
  {
    genre: 'Reggae',
    instrument: 'Arp',
    name: 'Dub Echo Pluck',
    score: 'D4 . . D4 . . D4 . . . Bb3 . . Bb3 . . | C4 . . C4 . . C4 . . . G3 . . G3 . .',
    sound: 'Pluck'
  },
  {
    genre: 'Reggae',
    instrument: 'Lead',
    name: 'Whistle Dub',
    score: 'D5 - - - B4 - A4 - G4 - - - . . . . | A4 - B4 - D5 - - - E5 - D5 - B4 - - -',
    sound: 'Breathy Lead'
  },

  // Reggaeton
  {
    genre: 'Reggaeton',
    instrument: 'Bass',
    name: 'Dembow Bass',
    score: 'D3 - - D3 . . D3 - Bb2 - - Bb2 . . Bb2 -',
    sound: 'Deep Sub'
  },
  {
    genre: 'Reggaeton',
    instrument: 'Bass',
    name: 'Barrio Sub',
    score: [
      'B3 - - . . . B3 - B3 - - . . . B3 -',
      'G3 - - . . . G3 - G3 - - . . . G3 -',
      'D3 - - . . . D3 - D3 - - . . . D3 -',
      'A3 - - . . . A3 - A3 - - . . . A3 -'
    ].join(' | '),
    sound: 'Deep Sub'
  },
  {
    genre: 'Reggaeton',
    instrument: 'Chords',
    name: 'Perreo Piano',
    score: [
      'B3+D4+F#4 - - B3+D4+F#4 . . B3+D4+F#4 . B3+D4+F#4 - - B3+D4+F#4 . . B3+D4+F#4 .',
      'B3+D4+G4 - - B3+D4+G4 . . B3+D4+G4 . B3+D4+G4 - - B3+D4+G4 . . B3+D4+G4 .',
      'A3+D4+F#4 - - A3+D4+F#4 . . A3+D4+F#4 . A3+D4+F#4 - - A3+D4+F#4 . . A3+D4+F#4 .',
      'A3+C#4+E4 - - A3+C#4+E4 . . A3+C#4+E4 . A3+C#4+E4 - - A3+C#4+E4 . . A3+C#4+E4 .'
    ].join(' | '),
    sound: 'Electric Piano'
  },
  {
    genre: 'Reggaeton',
    instrument: 'Lead',
    name: 'Reggaeton Synth Hook',
    score: 'C#5 . . E5 . . C#5 . B4 . . G#4 . . B4 . | C#5 . . E5 . . F#5~ - E5 - - - . . . .',
    sound: 'Vibrato Lead'
  },
  {
    genre: 'Reggaeton',
    instrument: 'Arp',
    name: 'Dembow Pluck Arp',
    score: 'E4 . . B4 . . G4 . E4 . . B4 . . G4 . | C4 . . G4 . . E4 . C4 . . G4 . . E4 .',
    sound: 'Pluck'
  },

  // Rock
  {
    genre: 'Rock',
    instrument: 'Lead',
    name: 'Fuzz Pedal Riff',
    score: ['E4 - . G4 . A4 - . B4 . A4 G4 - . E4 .', 'D4 - . E4 - - . . G4 . E4 . D4 - B3 -'].join(
      ' | '
    ),
    sound: 'Fuzz Lead'
  },
  {
    genre: 'Rock',
    instrument: 'Chords',
    name: 'Overdriven Organ Stabs',
    score: [
      'E3+B3+E4 - - . . . E3+B3+E4 - . . D3+A3+D4 - - . . .',
      'A3+E4+A4 - - . . . A3+E4+A4 - . . G3+D4+G4 - - - . .'
    ].join(' | '),
    sound: 'Overdrive Organ'
  },
  {
    genre: 'Rock',
    instrument: 'Bass',
    name: 'Pick Bass Eighths',
    score: [
      'D2 . D2 . D2 . D2 . D2 . D2 . C2 . C2 .',
      'G2 . G2 . G2 . G2 . A2 . A2 . A2 . A2 .'
    ].join(' | '),
    sound: 'Pluck'
  },
  {
    genre: 'Rock',
    instrument: 'Chords',
    name: 'Power Chord Chug',
    score: [
      'G3+D4+G4 - - . G3+D4+G4 - . G3+D4+G4 - - . G3+D4+G4 - . G3+D4+G4 -',
      'F3+C4+F4 - - . F3+C4+F4 - . F3+C4+F4 - - . F3+C4+F4 - . F3+C4+F4 -',
      'C4+G4+C5 - - . C4+G4+C5 - . C4+G4+C5 - - . C4+G4+C5 - . C4+G4+C5 -',
      'D4+A4+D5 - - . D4+A4+D5 - . D4+A4+D5 - - . D4+A4+D5 - . D4+A4+D5 -'
    ].join(' | '),
    sound: 'Supersaw Lead'
  },
  {
    genre: 'Rock',
    instrument: 'Chords',
    name: 'Anthem Organ',
    score: [
      'C4+E4+G4 - - - - - - - C4+E4+G4 - - - C4+E4+G4 - - -',
      'G3+B3+D4 - - - - - - - G3+B3+D4 - - - G3+B3+D4 - - -',
      'A3+C4+E4 - - - - - - - A3+C4+E4 - - - A3+C4+E4 - - -',
      'F3+A3+C4 - - - - - - - F3+A3+C4 - - - F3+A3+C4 - - -'
    ].join(' | '),
    sound: 'Organ'
  },
  {
    genre: 'Rock',
    instrument: 'Lead',
    name: 'Power Riff',
    score: [
      'E3 - E3 - G3 - E3 - A3 - G3 - E3 - D3 -',
      'E3 - E3 - G3 - E3 - Bb3 - A3 - G3 - E3 -'
    ].join(' | '),
    sound: 'Supersaw Lead'
  },
  {
    genre: 'Rock',
    instrument: 'Lead',
    name: 'Blues Rock Lick',
    score: 'A4 - C5 - D5 - Eb5~ E5 - - G5 - E5 - D5 - | C5 - A4 - - - G4~ - A4 - - - - - . .',
    sound: 'Vibrato Lead'
  },

  // Synthwave
  {
    genre: 'Synthwave',
    instrument: 'Lead',
    name: 'Neon Fuzz Solo',
    score: ['A4 - - . C5 - . E5 - - . D5 . C5 - .', 'B4 - - . G4 - . B4 . C5 - . A4 - - -'].join(
      ' | '
    ),
    sound: 'Fuzz Lead'
  },
  {
    genre: 'Synthwave',
    instrument: 'Bass',
    name: 'Night Drive Bass',
    score: [
      'A2 - A2 - A2 - A2 - A2 - A2 - A2 - A2 -',
      'F2 - F2 - F2 - F2 - G2 - G2 - G2 - G2 -'
    ].join(' | '),
    sound: 'Pluck'
  },
  {
    genre: 'Synthwave',
    instrument: 'Chords',
    name: 'Minor Pad Chords',
    score: [
      'A3+C4+E4 - - - - - - - - - - - - - - -',
      'F3+A3+C4 - - - - - - - - - - - - - - -',
      'G3+C4+E4 - - - - - - - - - - - - - - -',
      'G3+B3+D4 - - - - - - - - - - - - - - -'
    ].join(' | '),
    sound: 'Pulse Pad'
  },
  {
    genre: 'Synthwave',
    instrument: 'Chords',
    name: 'Phaser Sunset',
    score: [
      'A3+C4+E4+G4 - - - - - - - - - - - - - - -',
      'F3+A3+C4+E4 - - - - - - - - - - - - - - -'
    ].join(' | '),
    sound: 'Phaser Pad'
  },
  {
    genre: 'Synthwave',
    instrument: 'Lead',
    name: 'Synth Brass',
    score: 'E4 - - - . . G4 - A4 - - - - - . . | C5 - - - B4 - - - G4 - - - A4 - - -',
    sound: 'Brass'
  },
  {
    genre: 'Synthwave',
    instrument: 'Lead',
    name: 'Jet Stream Lead',
    score: 'A4 - - - E5 - - - D5 - C5 - B4 - - - | C5 - - - B4 - - - G4 - - - A4 - - -',
    sound: 'Jet Lead'
  },
  {
    genre: 'Synthwave',
    instrument: 'Arp',
    name: 'Pluck Arp',
    score: 'C4 - E4 - G4 - C5 - G4 - E4 - C4 - E4 -',
    sound: 'Pluck'
  },
  {
    genre: 'Synthwave',
    instrument: 'Arp',
    name: 'Outrun Sequencer',
    score: [
      'A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4',
      'F3 A3 C4 F4 F3 A3 C4 F4 F3 A3 C4 F4 F3 A3 C4 F4',
      'G3 C4 E4 G4 G3 C4 E4 G4 G3 C4 E4 G4 G3 C4 E4 G4',
      'G3 B3 D4 G4 G3 B3 D4 G4 G3 B3 D4 G4 G3 B3 D4 G4'
    ].join(' | '),
    sound: 'Pluck'
  },

  // Techno
  {
    genre: 'Techno',
    instrument: 'Bass',
    name: 'Acid Line',
    score: 'C4 C4 C5~ C4 . C4 Eb4 C4 C4 . Bb3~ C4 G4 C4~ C5 .',
    sound: 'Acid Bass'
  },
  {
    genre: 'Techno',
    instrument: 'Bass',
    name: 'Rumble Sub',
    score: '. . F3 - . . F3 - . . F3 - . . Ab3 F3',
    sound: 'Deep Sub'
  },
  {
    genre: 'Techno',
    instrument: 'Chords',
    name: 'Dub Stab',
    score: '. . . C4+Eb4+G4 . . C4+Eb4+G4 . . . . . . . C4+Eb4+G4 .',
    sound: 'Organ'
  },
  {
    genre: 'Techno',
    instrument: 'Chords',
    name: 'Detroit Stabs',
    score: [
      '. . D4+F4+A4+C5 - . . D4+F4+A4+C5 . . . D4+F4+A4+C5 - . . D4+F4+A4+C5 .',
      '. . Bb3+D4+F4+A4 - . . Bb3+D4+F4+A4 . . . Bb3+D4+F4+A4 - . . Bb3+D4+F4+A4 .'
    ].join(' | '),
    sound: 'Brass'
  },
  {
    genre: 'Techno',
    instrument: 'Arp',
    name: 'Warehouse Sequence',
    score: 'A4 . C5~ A4 . E5 A4 . C5 A4 . E5 A4~ - G5 .',
    sound: 'Acid Bass'
  },

  // Trance
  {
    genre: 'Trance',
    instrument: 'Bass',
    name: 'Rolling Offbeat Bass',
    score: [
      '. A2 A2 A2 . A2 A2 A2 . A2 A2 A2 . A2 A2 A2',
      '. F2 F2 F2 . F2 F2 F2 . F2 F2 F2 . F2 F2 F2',
      '. C3 C3 C3 . C3 C3 C3 . C3 C3 C3 . C3 C3 C3',
      '. G2 G2 G2 . G2 G2 G2 . G2 G2 G2 . G2 G2 G2'
    ].join(' | '),
    sound: 'Pluck'
  },
  {
    genre: 'Trance',
    instrument: 'Chords',
    name: 'Epic Pad',
    score: [
      'A3+C4+E4 - - - - - - - - - - - - - - -',
      'F3+A3+C4 - - - - - - - - - - - - - - -',
      'C4+E4+G4 - - - - - - - - - - - - - - -',
      'G3+B3+D4 - - - - - - - - - - - - - - -'
    ].join(' | '),
    sound: 'Pulse Pad'
  },
  {
    genre: 'Trance',
    instrument: 'Chords',
    name: 'Build-Up Riser',
    score: ['A3+E4+A4 - - - - - - - - - - - - - - -', '- - - - - - - - - - - - - - - -'].join(
      ' | '
    ),
    sound: 'Riser'
  },
  {
    genre: 'Trance',
    instrument: 'Lead',
    name: 'Supersaw Hook',
    score: 'A4 - C5 - E5 - - - D5 - C5 - B4 - - - | A4 - - - - - G4 - A4 - - - - - - -',
    sound: 'Supersaw Lead'
  },
  {
    genre: 'Trance',
    instrument: 'Lead',
    name: 'Trance Gate',
    score: [
      'E5 E5 . E5 E5 . E5 E5 . E5 E5 . D5 D5 C5 C5',
      'B4 B4 . B4 B4 . B4 B4 . B4 B4 . C5 C5 D5 D5'
    ].join(' | '),
    sound: 'Supersaw Lead'
  },
  {
    genre: 'Trance',
    instrument: 'Arp',
    name: 'Rising Arp',
    score: [
      'A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 C5 A4 E4 C4 E4 A4',
      'F3 A3 C4 F4 C4 A3 F3 A3 C4 F4 A4 F4 C4 A3 C4 F4'
    ].join(' | '),
    sound: 'Pluck'
  },

  // Trap
  {
    genre: 'Trap',
    instrument: 'Bass',
    name: 'Distorted 808 Slide',
    score: ['C3 - - - . . . C3 . . Eb3~ G3 - - . .', 'F3 - - . . . F3 . . . Eb3~ C3 - - - .'].join(
      ' | '
    ),
    sound: 'Dirty 808'
  },
  {
    genre: 'Trap',
    instrument: 'Bass',
    name: 'Sub Pulse',
    score: 'C3 - - . . . C3 - . . C3~ - Eb3 - . .',
    sound: 'Deep Sub'
  },
  {
    genre: 'Trap',
    instrument: 'Bass',
    name: '808 Slide',
    score: 'F3 - - - - - - - - - . . F3~ - Ab3~ - | C4 - - - - - - . Bb3~ - - - G3 - - -',
    sound: 'Deep Sub'
  },
  {
    genre: 'Trap',
    instrument: 'Chords',
    name: 'Dark Trap Pad',
    score: [
      'C4+Eb4+G4 - - - - - - - - - - - - - - -',
      'Ab3+C4+Eb4 - - - - - - - G3+B3+D4 - - - - - - -'
    ].join(' | '),
    sound: 'Warm Pad'
  },
  {
    genre: 'Trap',
    instrument: 'Lead',
    name: 'Trap Bell Melody',
    score: [
      'F4 . Ab4 . C5 . Ab4 . G4 . . . Eb4 . F4 .',
      'F4 . Ab4 . C5 . Db5 . C5 . . . Ab4 . G4 .'
    ].join(' | '),
    sound: 'Bell'
  },
  {
    genre: 'Trap',
    instrument: 'Arp',
    name: 'Eerie Trap Arp',
    score: 'G3 Bb3 D4 G3 Bb3 D4 G3 Bb3 D4 G3 Bb3 D4 F4 D4 Bb3 A3',
    sound: 'Bell'
  },

  // UK Garage
  {
    genre: 'UK Garage',
    instrument: 'Bass',
    name: 'Garage Sub',
    score: 'G3 - . . . . G3 . . . Bb3 - . . F3 -',
    sound: 'Garage Bass'
  },
  {
    genre: 'UK Garage',
    instrument: 'Bass',
    name: 'Speed Garage Reese',
    score: 'E2 - . E2 . . E3 - . . E2 - . G2~ A2 . | E2 - . E2 . . E3 - . . D3 - . B2~ G2 .',
    sound: 'Reese Bass'
  },
  {
    genre: 'UK Garage',
    instrument: 'Chords',
    name: 'Garage Organ',
    score: [
      '. . . Bb3+D4+F4+A4 . . . . . . Bb3+D4+F4+A4 . . . . .',
      '. . . G3+Bb3+D4+F4 . . . . . . G3+Bb3+D4+F4 . . . . .'
    ].join(' | '),
    sound: 'Organ'
  },
  {
    genre: 'UK Garage',
    instrument: 'Chords',
    name: 'Two-Step Stabs',
    score: [
      'A3+C4+E4+G4 - . A3+C4+E4+G4 . . A3+C4+E4+G4 - . . A3+C4+E4+G4 . . A3+C4+E4+G4 - .',
      'F3+A3+C4+E4 - . F3+A3+C4+E4 . . F3+A3+C4+E4 - . . F3+A3+C4+E4 . . F3+A3+C4+E4 - .'
    ].join(' | '),
    sound: 'Electric Piano'
  },
  {
    genre: 'UK Garage',
    instrument: 'Lead',
    name: 'Garage Vocal Chop',
    score: 'C5 . . Eb5 . . G4 . . . Bb4 - . C5 . . | C5 . . Eb5 . . F5~ - - Eb5 . . Bb4 - - .',
    sound: 'Vibrato Lead'
  }
]

export const BEAT_SPECS: BeatSpec[] = [
  // Afrobeat
  {
    genre: 'Afrobeat',
    name: 'Afrobeats Bounce',
    tracks: {
      conga: '.......x......x.',
      kick: 'x.....x.x.......',
      shaker: 'x.xxx.xxx.xxx.xx',
      snare: '...x......x..x..'
    }
  },
  {
    genre: 'Afrobeat',
    name: 'Lagos Shuffle',
    tracks: {
      chat: 'x.x.x.xxx.x.x.xx',
      kick: 'x.....x...x..x..',
      snare: '...x..x....xX...'
    }
  },
  {
    genre: 'Afrobeat',
    name: 'Naija Pocket',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      clap: '....x.......x...',
      conga: '...x..x....x..x.',
      kick: 'x......x..x.....'
    }
  },

  // Amapiano
  {
    genre: 'Amapiano',
    name: 'Log Drum Groove',
    tracks: {
      chat: '..x...x...x...x.',
      clap: '....x.......x...',
      kick: 'x...x...x...x...',
      tom: 'x..x..x...x.x...'
    }
  },
  {
    genre: 'Amapiano',
    name: 'Piano Shaker Drive',
    tracks: {
      kick: 'x...x...x...x...',
      shaker: 'xoXoxoXoxoXoxoXo',
      snare: '.......x......x.',
      tom: '...x..x.......x.'
    }
  },
  {
    genre: 'Amapiano',
    name: 'Sgija Bounce',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      clap: '....x.......x...',
      kick: 'x.......x.......',
      ohat: '...x.......x....',
      tom: '..x..x...x..x...'
    }
  },

  // Ambient
  {
    genre: 'Ambient',
    name: 'Sparse Pulse',
    tracks: {
      chat: '....x.......x...',
      kick: 'x.........x.....',
      tom: '..............x.'
    }
  },
  {
    genre: 'Ambient',
    name: 'Heartbeat Drift',
    tracks: {
      chat: '........x.......',
      kick: 'X..x............'
    }
  },
  {
    genre: 'Ambient',
    name: 'Rainfall Ticks',
    tracks: {
      chat: 'x..x..x...x..x..',
      kick: 'x...............',
      tom: '..........x.....'
    }
  },

  // Breakbeat
  {
    genre: 'Breakbeat',
    name: 'Amen-ish Break',
    tracks: {
      kick: 'x.x.......xx....',
      ride: 'x.x.x.x.x.x.x?x.',
      snare: '....X..o.x.o..X.'
    }
  },
  {
    genre: 'Breakbeat',
    name: 'Big Beat',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'x.....x.x.x.....',
      ohat: '..x...........x.',
      snare: '....X.......X..x'
    }
  },
  {
    genre: 'Breakbeat',
    name: 'Nu Skool Break',
    tracks: {
      chat: 'x.?xx.x.x.?xx...',
      kick: 'x.....xx..x.....',
      ohat: '..............x.',
      snare: '....X.....o.X...'
    }
  },

  // Chiptune
  {
    genre: 'Chiptune',
    name: 'Chip Beat',
    tracks: {
      chat: 'xxxxxxxxxxxxxxxx',
      kick: 'x.......x.x.....',
      snare: '....x.......x...'
    }
  },
  {
    genre: 'Chiptune',
    name: 'Chip Gallop',
    tracks: {
      chat: 'x.xxx.xxx.xxx.xx',
      kick: 'x.x...x.x.x...x.',
      snare: '....x.......x..x'
    }
  },
  {
    genre: 'Chiptune',
    name: 'Stage Clear Fill',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      crash: 'X...............',
      kick: 'x.......x.......',
      snare: '....x.......x234'
    }
  },

  // Disco
  {
    genre: 'Disco',
    name: 'Disco Hats',
    tracks: {
      chat: 'x...x...x...x...',
      kick: 'x...x...x...x...',
      ohat: '..x...x...x...x.',
      snare: '....X.......X...'
    }
  },
  {
    genre: 'Disco',
    name: 'Hustle Hi-Hats',
    tracks: {
      chat: 'x...x...x...x...',
      clap: '....x.......x...',
      kick: 'X...x...X...x...',
      ohat: '..x...x...x...x.'
    }
  },
  {
    genre: 'Disco',
    name: 'Philly Tom Break',
    tracks: {
      chat: 'xxxxxxxxxxxxxxxx',
      kick: 'x...x...x...x...',
      snare: '....x.......x...',
      tom: '..........x.x.xx'
    }
  },

  // Drill
  {
    genre: 'Drill',
    name: 'Drill Slide',
    tracks: {
      chat: 'x..x..x.x..3.x..',
      kick: 'X.....x...x..x..',
      snare: '........X.....x.'
    }
  },
  {
    genre: 'Drill',
    name: 'Drill Triplet Hats',
    tracks: {
      chat: 'x..x..x.x3x..x..',
      kick: 'X.........X..x..',
      snare: '........X..o...x'
    }
  },
  {
    genre: 'Drill',
    name: 'NY Drill Stomp',
    tracks: {
      chat: 'x.x..x.xx.x..3.x',
      clap: '........X.......',
      kick: 'X..x......x..x..',
      snare: '...........x..x.'
    }
  },

  // Drum & Bass
  {
    genre: 'Drum & Bass',
    name: 'Two-step',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'X.........x.....',
      snare: '....X.......X...'
    }
  },
  {
    genre: 'Drum & Bass',
    name: 'Liquid Roll',
    tracks: {
      chat: 'x.oxx.x.x.oxx.x.',
      kick: 'X.........x.....',
      ohat: '..............x.',
      snare: '....X..o....X...'
    }
  },
  {
    genre: 'Drum & Bass',
    name: 'Jungle Chop',
    tracks: {
      kick: 'x.x.......x.....',
      ride: 'x.x.x.x.x.x.x.x.',
      snare: '....X.o..x..X..2'
    }
  },

  // Dubstep
  {
    genre: 'Dubstep',
    name: 'Half-time Drop',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'X.........x.....',
      snare: '........X.......'
    }
  },
  {
    genre: 'Dubstep',
    name: 'Tom Drop',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'X.....x.........',
      snare: '........X.......',
      tom: '..........x.x.xx'
    }
  },
  {
    genre: 'Dubstep',
    name: 'Riddim Stomp',
    tracks: {
      chat: 'x.xxx.x.x.xxx.x3',
      clap: '........x.......',
      kick: 'X......x..X.....',
      snare: '........X.......'
    }
  },

  // Electro
  {
    genre: 'Electro',
    name: 'Electro Funk',
    tracks: {
      chat: 'x.xxx.xxx.xxx.xx',
      clap: '....x.......x...',
      kick: 'x......x..x.....',
      woodblock: 'x..x..x...x.x...'
    }
  },
  {
    genre: 'Electro',
    name: 'Breaker Boogie',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      clap: '....X.......X...',
      kick: 'X.....x...x.....',
      tom: '..........x.x...'
    }
  },
  {
    genre: 'Electro',
    name: 'Bass Machine',
    tracks: {
      chat: 'x.x.x.xxx.x.x.x.',
      clap: '....X.......X...',
      cowbell: 'x..x..x...x..x..',
      kick: 'X......X..X..X..',
      ohat: '..............x.'
    }
  },

  // Funk
  {
    genre: 'Funk',
    name: 'Tom Groove',
    tracks: {
      chat: 'x.xxx.x.x.xxx.x.',
      cowbell: 'x...o...x...o...',
      kick: 'x..x..x...x..x..',
      snare: '....X.......X...',
      tom: '..............xx'
    }
  },
  {
    genre: 'Funk',
    name: 'Ghost Notes',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'x.x...x...x..x..',
      snare: '....X..o.o..X..o'
    }
  },
  {
    genre: 'Funk',
    name: 'Pocket Break',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'X.x.......x.x...',
      ohat: '.......x........',
      snare: '....X..o.x..X..o'
    }
  },

  // Hip-hop
  {
    genre: 'Hip-hop',
    name: 'Boom Bap',
    tracks: {
      chat: 'x.x.x.o.x.x.x.o.',
      kick: 'x.....x...x.....',
      snare: '....X.......X..o'
    }
  },
  {
    genre: 'Hip-hop',
    name: 'Knock',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'X..x......x..x..',
      snare: '....X.......X...'
    }
  },
  {
    genre: 'Hip-hop',
    name: 'West Coast',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      clap: '....x.......x...',
      kick: 'x.....x.x.......',
      ohat: '..............x.',
      snap: '....x.......x...'
    }
  },

  // House
  {
    genre: 'House',
    name: 'Four on the Floor',
    tracks: {
      chat: 'x?x.x?x.x?x.x?x.',
      clap: '....x.......x...',
      kick: 'X...x...X...x...',
      ohat: '..x...x...x...x.'
    }
  },
  {
    genre: 'House',
    name: 'Deep House Shuffle',
    tracks: {
      clap: '....x.......x...',
      kick: 'x...x...x...x...',
      ride: '..x...x...x...x.',
      shaker: 'x.oxx.oxx.oxx.ox'
    }
  },
  {
    genre: 'House',
    name: 'Jackin Groove',
    tracks: {
      chat: 'xo.xxo.xxo.xxo.x',
      clap: '....X.......X...',
      conga: '...x..x....x.ox.',
      kick: 'x...x...x...x..x',
      ohat: '..x...x...x...x.',
      snare: '.......?......x.'
    }
  },

  // Latin
  {
    genre: 'Latin',
    name: 'Bossa Nova',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'x..xx..xx..xx..x',
      rim: 'x..x..x...x..x..'
    }
  },
  {
    genre: 'Latin',
    name: 'Cumbia Scrape',
    tracks: {
      conga: '......x.......xx',
      kick: 'x.......x.......',
      shaker: 'x.xxx.xxx.xxx.xx',
      snare: '....x.......x...'
    }
  },
  {
    genre: 'Latin',
    name: 'Son Clave Salsa',
    tracks: {
      chat: 'x.x.xx.xx.xx.x.x',
      conga: '....x.......x.x.',
      cowbell: 'x...x...x...x...',
      kick: '......x.......x.',
      woodblock: 'x..x..x...x.x...'
    }
  },

  // Lo-fi
  {
    genre: 'Lo-fi',
    name: 'Dusty Loop',
    tracks: {
      chat: 'x.o.x.o.x.o.x.o.',
      kick: 'x.......x.x....?',
      snap: '....x.......x...'
    }
  },
  {
    genre: 'Lo-fi',
    name: 'Lazy Sunday Bap',
    tracks: {
      chat: 'x.o.x.o.x.oxx.o.',
      kick: 'x......x..x.....',
      snare: '....x..o....x...'
    }
  },
  {
    genre: 'Lo-fi',
    name: 'Cassette Knock',
    tracks: {
      chat: 'x...x...x...x...',
      kick: 'x..x......x.....',
      ohat: '..............x.',
      snare: '....X.......X...'
    }
  },

  // Pop
  {
    genre: 'Pop',
    name: 'Pop Clap',
    tracks: {
      chat: '..x...x...x...x.',
      clap: '....X.......X...',
      kick: 'x......xx.......'
    }
  },
  {
    genre: 'Pop',
    name: 'Stomp and Clap',
    tracks: {
      clap: '....X.......X...',
      kick: 'X.......X.x.....'
    }
  },
  {
    genre: 'Pop',
    name: 'Dance Pop Drive',
    tracks: {
      chat: 'xoxoxoxoxoxoxoxo',
      clap: '....X.......X...',
      kick: 'X...x...X...x...',
      snare: '..............x2'
    }
  },

  // Reggae
  {
    genre: 'Reggae',
    name: 'One Drop',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: '........x.......',
      rim: '........X.......'
    }
  },
  {
    genre: 'Reggae',
    name: 'Reggae Steppers',
    tracks: {
      chat: 'x...x...x...x...',
      kick: 'X...x...X...x...',
      ohat: '..x...x...x...x.',
      snare: '........X.......'
    }
  },
  {
    genre: 'Reggae',
    name: 'Rockers Riddim',
    tracks: {
      chat: 'x.xxx.xxx.xxx.xx',
      kick: 'x.......x.....x.',
      snare: '....X.......X...'
    }
  },

  // Reggaeton
  {
    genre: 'Reggaeton',
    name: 'Dembow',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'x...x...x...x...',
      snare: '...x..x....x..x.'
    }
  },
  {
    genre: 'Reggaeton',
    name: 'Moombah',
    tracks: {
      kick: 'x...x...x...x...',
      ohat: '..x...x...x...x.',
      snare: '...x..x....x..x.'
    }
  },
  {
    genre: 'Reggaeton',
    name: 'Perreo Clap',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      clap: '....x.......x...',
      kick: 'x...x...x...x...',
      snare: '...x..x....x..x.'
    }
  },

  // Rock
  {
    genre: 'Rock',
    name: 'Rock Steady',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'x.......x.x.....',
      snare: '....X.......X...'
    }
  },
  {
    genre: 'Rock',
    name: 'Punk Drive',
    tracks: {
      crash: 'X...............',
      kick: 'x.x...x.x.x...x.',
      ohat: 'x.x.x.x.x.x.x.x.',
      snare: '....X.......X...'
    }
  },
  {
    genre: 'Rock',
    name: 'Tom Fill',
    tracks: {
      chat: 'x.x.x.x.........',
      crash: 'X...............',
      kick: 'x.......x.......',
      snare: '....X.......XXXX',
      tom: '........xxxx....'
    }
  },

  // Synthwave
  {
    genre: 'Synthwave',
    name: 'Gated Eighties',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'x.......x.......',
      snare: '....X.......X...',
      tom: '..............xx'
    }
  },
  {
    genre: 'Synthwave',
    name: 'Retro Drive',
    tracks: {
      chat: '..x...x...x...x.',
      clap: '....x.......x...',
      kick: 'X...x...X...x...',
      snare: '....X.......X...'
    }
  },
  {
    genre: 'Synthwave',
    name: 'Midnight Halftime',
    tracks: {
      chat: 'x.x.x.x.x.x.x.x.',
      kick: 'X.........x.....',
      snare: '........X.......',
      tom: '.............xxx'
    }
  },

  // Techno
  {
    genre: 'Techno',
    name: 'Techno Driver',
    tracks: {
      chat: 'xoxox?xoxoxox?xo',
      clap: '....x.......x...',
      kick: 'X...x...X...x...',
      ohat: '..x...x...x...x.'
    }
  },
  {
    genre: 'Techno',
    name: 'Minimal Tick',
    tracks: {
      chat: '..x...x...x...x.',
      kick: 'x...x...x...x...',
      rim: '.......o.......x',
      tom: '......x...?...x.'
    }
  },
  {
    genre: 'Techno',
    name: 'Industrial Stomp',
    tracks: {
      clap: '....x.......x...',
      kick: 'X..xX...X..xX...',
      ohat: '..x...x...x...x.',
      tom: '...........x..x.'
    }
  },

  // Trance
  {
    genre: 'Trance',
    name: 'Trance Build',
    tracks: {
      clap: '....x.......x...',
      kick: 'X...x...X...x...',
      ohat: '..x...x...x...x.',
      snare: '............xx22'
    }
  },
  {
    genre: 'Trance',
    name: 'Uplifting Four',
    tracks: {
      chat: '.x.x.x.x.x.x.x.x',
      clap: '....x.......x...',
      kick: 'X...X...X...X...',
      ohat: '..x...x...x...x.'
    }
  },
  {
    genre: 'Trance',
    name: 'Snare Roll Riser',
    tracks: {
      kick: 'X...X...X...X...',
      ohat: '..x...x...x...x.',
      snare: 'o.o.o.o.xxxxXXXX'
    }
  },

  // Trap
  {
    genre: 'Trap',
    name: 'Trap Hats',
    tracks: {
      chat: 'xoxoxox3xoxoxo4x',
      clap: '........X.......',
      kick: 'X......x..x.....'
    }
  },
  {
    genre: 'Trap',
    name: 'Trap Bounce',
    tracks: {
      chat: 'x.x.x.x.x3x3x.x.',
      kick: 'X.....x...x..x..',
      ohat: '..............x.',
      snap: '........X.......'
    }
  },
  {
    genre: 'Trap',
    name: 'Trap Rattle',
    tracks: {
      chat: 'x.x.x3x.x.x.3x4x',
      clap: '........X.......',
      kick: 'X.....x...X..x..',
      ohat: '..............x.'
    }
  },

  // UK Garage
  {
    genre: 'UK Garage',
    name: 'Garage Skip',
    tracks: {
      chat: '..x..?x.x.x..?x.',
      kick: 'x......x..x.....',
      ohat: '..............x.',
      snare: '....x.......x...'
    }
  },
  {
    genre: 'UK Garage',
    name: 'Two-Step Shuffle',
    tracks: {
      chat: '..x..ox...x..ox.',
      kick: 'X.........x.....',
      snare: '....X.......X...'
    }
  },
  {
    genre: 'UK Garage',
    name: 'Speed Garage Stomp',
    tracks: {
      chat: 'x..xx..xx..xx..x',
      clap: '....x.......x...',
      kick: 'X...X...X...X...',
      ohat: '..x...x...x...x.'
    }
  }
]
