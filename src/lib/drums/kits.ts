import type { CoreTrackId, InstrumentId, KitId, TrackId } from '../types.js'

// The drum machine's tracks, in the grid's order. The `core` six always show in
// the step grid; the percussion below them shows once a pattern uses it, or when
// it's added.
export const TRACKS: { core: boolean; id: TrackId; label: string }[] = [
  { core: true, id: 'kick', label: 'Kick' },
  { core: true, id: 'snare', label: 'Snare' },
  { core: true, id: 'clap', label: 'Clap' },
  { core: true, id: 'chat', label: 'Closed Hat' },
  { core: true, id: 'ohat', label: 'Open Hat' },
  { core: true, id: 'tom', label: 'Tom' },
  { core: false, id: 'rim', label: 'Rim Shot' },
  { core: false, id: 'snap', label: 'Snap' },
  { core: false, id: 'shaker', label: 'Shaker' },
  { core: false, id: 'conga', label: 'Conga' },
  { core: false, id: 'cowbell', label: 'Cowbell' },
  { core: false, id: 'woodblock', label: 'Wood Block' },
  { core: false, id: 'ride', label: 'Ride' },
  { core: false, id: 'crash', label: 'Crash' }
]

export const KITS: { id: KitId; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: '606', label: '606' },
  { id: '808', label: '808' },
  { id: '909', label: '909' },
  { id: 'lofi', label: 'Lo-fi' },
  { id: 'trap', label: 'Trap' }
]

// The instrument library: every synthesized drum sound, which any track can play.
// Each kit has its own six core sounds; the percussion is shared between kits.
// `part` is the track an instrument is made for, which groups the library.
export const INSTRUMENTS: Record<InstrumentId, { label: string; part: TrackId }> = {
  '606-chat': { label: '606 Closed Hat', part: 'chat' },
  '606-clap': { label: '606 Clap', part: 'clap' },
  '606-kick': { label: '606 Kick', part: 'kick' },
  '606-ohat': { label: '606 Open Hat', part: 'ohat' },
  '606-snare': { label: '606 Snare', part: 'snare' },
  '606-tom': { label: '606 Tom', part: 'tom' },
  '808-chat': { label: '808 Closed Hat', part: 'chat' },
  '808-clap': { label: '808 Clap', part: 'clap' },
  '808-claves': { label: '808 Claves', part: 'woodblock' },
  '808-conga': { label: '808 Conga', part: 'conga' },
  '808-cowbell': { label: '808 Cowbell', part: 'cowbell' },
  '808-crash': { label: '808 Cymbal', part: 'crash' },
  '808-kick': { label: '808 Kick', part: 'kick' },
  '808-ohat': { label: '808 Open Hat', part: 'ohat' },
  '808-rim': { label: '808 Rim Shot', part: 'rim' },
  '808-snare': { label: '808 Snare', part: 'snare' },
  '808-tom': { label: '808 Tom', part: 'tom' },
  '909-chat': { label: '909 Closed Hat', part: 'chat' },
  '909-clap': { label: '909 Clap', part: 'clap' },
  '909-crash': { label: '909 Crash', part: 'crash' },
  '909-kick': { label: '909 Kick', part: 'kick' },
  '909-ohat': { label: '909 Open Hat', part: 'ohat' },
  '909-ride': { label: '909 Ride', part: 'ride' },
  '909-rim': { label: '909 Rim Shot', part: 'rim' },
  '909-snare': { label: '909 Snare', part: 'snare' },
  '909-tom': { label: '909 Tom', part: 'tom' },
  bongo: { label: 'Bongo', part: 'conga' },
  'classic-chat': { label: 'Classic Closed Hat', part: 'chat' },
  'classic-clap': { label: 'Classic Clap', part: 'clap' },
  'classic-kick': { label: 'Classic Kick', part: 'kick' },
  'classic-ohat': { label: 'Classic Open Hat', part: 'ohat' },
  'classic-snare': { label: 'Classic Snare', part: 'snare' },
  'classic-tom': { label: 'Classic Tom', part: 'tom' },
  'lofi-chat': { label: 'Lo-fi Closed Hat', part: 'chat' },
  'lofi-clap': { label: 'Lo-fi Clap', part: 'clap' },
  'lofi-conga': { label: 'Lo-fi Conga', part: 'conga' },
  'lofi-cowbell': { label: 'Lo-fi Cowbell', part: 'cowbell' },
  'lofi-crash': { label: 'Lo-fi Crash', part: 'crash' },
  'lofi-kick': { label: 'Lo-fi Kick', part: 'kick' },
  'lofi-ohat': { label: 'Lo-fi Open Hat', part: 'ohat' },
  'lofi-ride': { label: 'Lo-fi Ride', part: 'ride' },
  'lofi-rim': { label: 'Lo-fi Rim Shot', part: 'rim' },
  'lofi-shaker': { label: 'Lo-fi Shaker', part: 'shaker' },
  'lofi-snap': { label: 'Lo-fi Snap', part: 'snap' },
  'lofi-snare': { label: 'Lo-fi Snare', part: 'snare' },
  'lofi-tom': { label: 'Lo-fi Tom', part: 'tom' },
  shaker: { label: 'Shaker', part: 'shaker' },
  snap: { label: 'Finger Snap', part: 'snap' },
  'trap-chat': { label: 'Trap Closed Hat', part: 'chat' },
  'trap-clap': { label: 'Trap Clap', part: 'clap' },
  'trap-kick': { label: 'Trap Kick', part: 'kick' },
  'trap-ohat': { label: 'Trap Open Hat', part: 'ohat' },
  'trap-snare': { label: 'Trap Snare', part: 'snare' },
  'trap-tom': { label: 'Trap Tom', part: 'tom' },
  woodblock: { label: 'Wood Block', part: 'woodblock' }
}

export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS) as InstrumentId[]

type Percussion = Record<Exclude<TrackId, CoreTrackId>, InstrumentId>

const kit = (id: KitId, percussion: Percussion): Record<TrackId, InstrumentId> => ({
  chat: `${id}-chat`,
  clap: `${id}-clap`,
  kick: `${id}-kick`,
  ohat: `${id}-ohat`,
  snare: `${id}-snare`,
  tom: `${id}-tom`,
  ...percussion
})

// What each kit plays on each track, unless the song picks another instrument.
export const KIT_SOUNDS: Record<KitId, Record<TrackId, InstrumentId>> = {
  '606': kit('606', {
    conga: 'bongo',
    cowbell: '808-cowbell',
    crash: '808-crash',
    ride: '909-ride',
    rim: '808-rim',
    shaker: 'shaker',
    snap: 'snap',
    woodblock: '808-claves'
  }),
  '808': kit('808', {
    conga: '808-conga',
    cowbell: '808-cowbell',
    crash: '808-crash',
    ride: '909-ride',
    rim: '808-rim',
    shaker: 'shaker',
    snap: 'snap',
    woodblock: '808-claves'
  }),
  '909': kit('909', {
    conga: '808-conga',
    cowbell: '808-cowbell',
    crash: '909-crash',
    ride: '909-ride',
    rim: '909-rim',
    shaker: 'shaker',
    snap: 'snap',
    woodblock: 'woodblock'
  }),
  classic: kit('classic', {
    conga: '808-conga',
    cowbell: '808-cowbell',
    crash: '909-crash',
    ride: '909-ride',
    rim: '909-rim',
    shaker: 'shaker',
    snap: 'snap',
    woodblock: 'woodblock'
  }),
  lofi: kit('lofi', {
    conga: 'lofi-conga',
    cowbell: 'lofi-cowbell',
    crash: 'lofi-crash',
    ride: 'lofi-ride',
    rim: 'lofi-rim',
    shaker: 'lofi-shaker',
    snap: 'lofi-snap',
    woodblock: 'woodblock'
  }),
  trap: kit('trap', {
    conga: 'bongo',
    cowbell: '808-cowbell',
    crash: '808-crash',
    ride: '909-ride',
    rim: '808-rim',
    shaker: 'shaker',
    snap: 'snap',
    woodblock: '808-claves'
  })
}
