# Beatbox

A music workstation in the browser: a polyphonic synth, a 16-step drum machine,
eight loop pads and an arranger, all locked to one tempo. Sessions are saved as
songs. Sound is generated live with the Web Audio API; nothing is sampled.

Built with Phoenix LiveView, [Ash](https://ash-hq.org) on SQLite, and Svelte 5
components via [LiveSvelte](https://github.com/woutdp/live_svelte).

## Getting started

Requirements: Elixir/Erlang and Node.js (for Vite).

```sh
mix setup        # deps, database, migrations, seeds, JS packages, assets
mix phx.server   # or: iex -S mix phx.server
```

Open [localhost:4000](http://localhost:4000). A song, **Midnight Arcade**, is
seeded for you: pick it from **Open ▾** and press **Play song**.

## What's in it

**Synth**: two oscillators (sine, triangle, saw, square; octave, detune, level),
a resonant low-pass filter with an LFO for wobbles, an ADSR envelope and 16
voices. Play it with the on-screen keyboard or your computer keyboard. It comes
with factory presets (Dubstep Wobble, Reese Bass, Supersaw Lead, …), and you can
save your own.

**Drum machine**: kick, snare, clap, closed and open hat, and tom on a 16-step
grid, with four patterns (**A–D**). Copy/Paste lets you build variations, and
Randomize, Clear and Reset act on the pattern you're editing. Switching patterns
while the drums play changes over on the next bar. Its **Tempo** slider sets
the tempo for the whole song.

**Loop pads**: eight pads. Tap an empty pad to record, then tap it again to
finish.
- If nothing is playing, you get a one-bar count-in; otherwise recording starts
  on the next bar. A metronome clicks while you record.
- Takes are rounded to whole bars.
- Each loop keeps the synth sound it was recorded with, and loops follow tempo
  changes.
- A pad started while something else plays joins on the next bar line.

**Arrangement**: a list of sections, each with a length in bars, a drum pattern
(or none) and toggles for each pad. **Play song** plays the sections in order,
and every change lands on the section boundary.

**Songs**: the song bar at the top saves everything together: synth, drums,
loops and arrangement. **Save** stores the song (a blank name becomes
"Untitled N"). **New** starts a fresh song, and **Open ▾** loads a saved one;
both ask first if you have unsaved changes. **Play all / Stop all** starts or
stops the drums and every recorded pad.

### Keyboard

| Keys | Action |
|---|---|
| `A W S E D F T G Y H U J K O L P ;` | Play notes, C up to the E an octave above (white and black keys) |
| `Z` / `X` | Octave down / up |
| `1`–`8` | Loop pads: record, finish, start or stop |

Keys are ignored while you're typing in a text field.

## Development

```sh
mix precommit    # compile (warnings as errors), format, Elixir tests, JS tests
mix test         # Elixir tests only
node --test assets/svelte/   # JS tests only (audio timing, looper, arranger)
```

### Where things live

| Path | What |
|---|---|
| `lib/beatbox/music/` | Ash resources: `Preset`, `Song`, and song parts `Drums`, `Loop`, `Section` |
| `lib/beatbox_web/live/synth_live.ex` | The page: song bar, save/load, and the working copy of the open song |
| `assets/svelte/Synth.svelte` | Synth controls, keyboard, presets, loop pads |
| `assets/svelte/DrumMachine.svelte` | Step sequencer and tempo |
| `assets/svelte/Arranger.svelte` | Arrangement panel |
| `assets/svelte/audio.js` | The single shared `AudioContext` |
| `assets/svelte/transport.js` | Tempo, beat grid and metronome shared by every instrument |
| `assets/svelte/synth/` | Synth engine, loop recorder/player, factory presets |
| `assets/svelte/drums/engine.js` | Drum sounds and sequencer |
| `assets/svelte/arranger.js` | Plays the arrangement section by section |
| `priv/repo/seeds/*.json` | Songs seeded by `priv/repo/seeds.exs` |

How the pieces talk:
- The Svelte components own the live state. They push each change to the
  LiveView, which keeps the unsaved working copy of the song; **Save** writes it
  through Ash.
- Opening a song remounts the components with that song's state.
- Instruments coordinate in the browser through window events:
  `beatbox:transport` for Play all / Stop all, `beatbox:scene` for arrangement
  sections, and `beatbox:state` for what's currently playing.

### Seed songs

`priv/repo/seeds.exs` creates each song in `priv/repo/seeds/*.json` that doesn't
already exist by name, so it never overwrites songs you've edited. It's skipped
when `MIX_ENV=test`. To add a song, export it to that folder as JSON with the
keys `name`, `synth`, `drums`, `loops` and `arrangement`.

### Gotcha: Vite dev server caching

If you add a Svelte component or a colocated LiveView hook and the page doesn't
pick it up (for example, "unknown hook" in the console), restart
`mix phx.server`. The Vite dev server caches some generated modules.
