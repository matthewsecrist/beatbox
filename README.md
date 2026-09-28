# Beatbox

A music workstation in the browser: a polyphonic synth, a 16-step drum machine,
eight loop pads and an arranger, all locked to one tempo. Sessions are saved as
songs, and each user has their own. Sound is generated live with the Web Audio
API; nothing is sampled.

Built with [SvelteKit](https://svelte.dev/docs/kit) and Svelte 5, with
[Drizzle](https://orm.drizzle.team) on SQLite (libSQL) and
[Better Auth](https://better-auth.com) for sign-in.

## Getting started

Requirements: Node.js 22+.

```sh
npm run setup    # packages and database migrations
npm run dev
```

Open [localhost:5173](http://localhost:5173): everything plays without an account.
To save, press **Sign in to save** and enter your email. Unless `RESEND_API_KEY`
is set, the sign-in link isn't emailed but printed in the `npm run dev` output;
open it to sign in. Your first sign-in creates your account, with a generated
username (like `groovy-reverb-7916`, shown top right) and your own copy of
**Midnight Arcade**: pick it from **Open ▾** and press **Play song**.

## What's in it

**Accounts**: without one, the home page is a new song with every instrument,
factory preset and the arranger working, but **Save** and **Open ▾** become
**Sign in to save**, and synth presets can't be saved. An unsaved song is kept in
the browser while you sign in and comes back, still unsaved, once you're signed
in (even if the link opens in another tab of the same browser). Sign-in is by magic link (Better
Auth): enter your email and follow the link you're sent; it works once, for five
minutes. Everything you save (songs, with their loops and arrangement, and synth presets)
belongs to your account, and nobody else can see or change it. Song and preset
names only need to be unique among your own. **Sign out** is in the header.

**Synth**: two oscillators (sine, triangle, saw, square; octave, detune, level),
a resonant low-pass filter, an LFO, an ADSR envelope and 16 voices. The LFO's
target picks what it moves: **Filter** (wobbles; depth in octaves, the default),
**Pitch** (vibrato; depth in cents) or **Amp** (tremolo; depth as a share of the
level). Switching target keeps the depth at the same point of the new range. Play it with the on-screen keyboard or your computer keyboard. It comes
with factory presets (Acid Bass, Dubstep Wobble, Reese Bass, …), and you can
save your own. The oscillator, filter and envelope controls sit under **Sound
settings**, collapsed until you open it.

**Drum machine**: kick, snare, clap, closed and open hat, and tom on a 16-step
grid, with four patterns (**A–D**). Copy/Paste lets you build variations, and
Randomize, Clear and Reset act on the pattern you're editing. Switching patterns
while the drums play changes over on the next bar. Its **Tempo** slider sets
the tempo for the whole song.

- **Swing** (50–75%) pushes every second 16th late; 66% is a triplet shuffle.
- The step edit buttons pick what a click on a step does: **Hits** turns it on
  or off; **Velocity** (100/75/50/25%), **Chance** (the odds it plays each time
  round, same steps) and **Ratchet** (1–4 hits in the step) cycle through their
  values; **Accent** makes it louder. Outside Hits, clicking an off step turns
  it on. A step keeps its settings when switched off. Quieter steps look dimmer,
  a chance below 100% shows a dashed outline, accents a red dot.
- **Kit** picks a synthesized kit: Classic, 606, 808, 909, Lo-fi or Trap. Each voice has its own
  **Tune** (±12 semitones) and **Decay** sliders at the end of its row; picking
  a kit resets them.

**Loop pads**: eight pads. Tap an empty pad to record, then tap it again to
finish.

- If nothing is playing, you get a one-bar count-in; otherwise recording starts
  on the next bar. A metronome clicks while you record.
- Takes are rounded to whole bars.
- Each loop keeps the synth sound it was recorded with, and loops follow tempo
  changes.
- A pad started while something else plays joins on the next bar line.

**Piano roll**: the pencil on a pad opens its loop as notes (on an empty pad,
it starts an empty one-bar loop to draw in).

- Click to add a note and drag to set its length; drag a note to move it, or its
  right edge to resize. Right-click or double-click deletes it; a focused note
  moves with the arrow keys (Shift: an octave).
- Everything snaps to the grid (1/4 to 1/32). **Quantize** moves note starts to
  it, and − / + change the loop length in bars.
- Edits are heard straight away, even while the pad plays, and are saved with
  the song.

**Arrangement**: a list of sections, each with a length in bars, a drum pattern
(or none) and toggles for each pad. **Play song** plays the sections in order,
and every change lands on the section boundary.

**Loop Browser** (**Loops** in the song bar): 120 premade loops (bass, chords,
leads, arps, each with a factory synth sound) and 72 beats across 24 genres, from
house and techno to drill, amapiano and bossa nova (at least 5 loops and 3 beats
each), in one list. The sidebar searches (name, genre, instrument, synth sound) and
filters by type, genre, instrument and length: ticked labels in one filter widen
the list, different filters narrow it. **+** puts a loop on a pad (the first empty
one, or the one picked under **Add to**; it follows the song tempo) or writes a
beat into the picked drum pattern; either is one undo step. ▶ previews an item in
time with anything already playing (beats with the song's kit and swing); press
it again, close the browser or press Stop all to stop. To add more, add to
`LOOP_SPECS` or `BEAT_SPECS` in `src/lib/library_items.ts`: loops are written as a
16-step-per-bar score (`A3+C4+E4 - - . G3 …`) and beats as one `x..x` string per
drum; the file explains the notation, and a bad note or bar length fails the tests.

**Songs**: the song bar at the top saves everything together: synth, drums,
loops and arrangement. **Save** stores the song (a blank name becomes
"Untitled N"). **New** starts a fresh song, and **Open ▾** loads a saved one;
both ask first if you have unsaved changes. **Play all / Stop all** starts or
stops the drums and every recorded pad.

**Undo / Redo** (the arrows in the song bar, or Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z)
cover every edit to the song: synth settings and presets, drum steps, kit, tuning,
tempo, swing and level, recording or clearing a pad, piano-roll edits and the arrangement. A
slider drag or a burst of typing is one step. The history lasts until you open
another song; the song name keeps the browser's own text undo.

### Keyboard

| Keys                                | Action                                                           |
| ----------------------------------- | ---------------------------------------------------------------- |
| `A W S E D F T G Y H U J K O L P ;` | Play notes, C up to the E an octave above (white and black keys) |
| `Z` / `X`                           | Octave down / up                                                 |
| `1`–`8`                             | Loop pads: record, finish, start or stop                         |

Keys are ignored while you're typing in a text field.

## Development

```sh
npm run validate # everything CI runs: lint, type check, tests
npm run lint     # ESLint, including Prettier formatting (npm run format to fix)
npm run check    # svelte-check (strict TypeScript)
npm test         # Vitest: audio timing, looper, arranger, song/preset store, sign-in
npm run build && npm run preview   # production build (Cloudflare adapter)
```

The code is strict TypeScript. ESLint runs type-aware `typescript-eslint` rules,
the Svelte plugin (runes only), Perfectionist sorting and Prettier. CI should
run `npm run validate` and `npm run build`, failing on any lint, type or test error.

### Database

Users, sessions, songs and presets live in SQLite: locally `beatbox.db` by default
(set `DATABASE_URL` to use another file or any libSQL URL, for example Turso, with
`DATABASE_AUTH_TOKEN`); deployed, the D1 database `beatbox`, bound as `DB` in
`wrangler.jsonc`.

The migration that added accounts drops songs and presets saved before then,
since they have no owner; new users get Midnight Arcade on first sign-in.

- `npm run db:migrate` applies the migrations in `drizzle/` locally;
  `npx wrangler d1 migrations apply beatbox --remote` applies them to D1.
- After changing `src/lib/server/db/schema.ts`, run `npm run db:generate` to
  write a new migration.

### Configuration

Settings come from the environment (or a `.env` file; see `.env.example`):

| Variable             | What                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Signs sessions. Required in production (`openssl rand -base64 32`)                       |
| `BETTER_AUTH_URL`    | The site's public URL, used in sign-in links. Defaults to `http://localhost:5173` in dev |
| `DATABASE_URL`       | SQLite file or libSQL URL; defaults to `file:beatbox.db`                                 |
| `RESEND_API_KEY`     | Emails sign-in links with Resend. Unset, they're only printed in the server log          |
| `EMAIL_FROM`         | Sender of those emails, on a domain verified in Resend. Required with `RESEND_API_KEY`   |

### Deploying

The app runs on Cloudflare Workers at
[beatbox.matthewsecrist.workers.dev](https://beatbox.matthewsecrist.workers.dev).
Apply any new migrations to D1 (above), then `npm run deploy`. `BETTER_AUTH_URL` is
set in `wrangler.jsonc`; `BETTER_AUTH_SECRET` is a Worker secret
(`npx wrangler secret put BETTER_AUTH_SECRET`).

Pushed branches get a Preview (Workers Builds runs `npx wrangler preview`) at
`<branch>-beatbox.matthewsecrist.workers.dev`. Previews use the `previews` block of
`wrangler.jsonc`: their own D1 database, `beatbox-preview`, and
`BETTER_AUTH_ALLOWED_HOSTS` in place of `BETTER_AUTH_URL`. Their
`BETTER_AUTH_SECRET` is set with `npx wrangler preview base-config secret put`. Apply
new migrations to the Previews database before pushing them:
`npx wrangler d1 migrations apply beatbox-preview --remote --config wrangler.preview-migrations.jsonc`.

Sign-in links are emailed with Resend. `EMAIL_FROM` is set in `wrangler.jsonc`
(its domain must be verified in Resend); `RESEND_API_KEY` is a Worker secret
(`npx wrangler secret put RESEND_API_KEY`, and `npx wrangler preview base-config
secret put RESEND_API_KEY` for Previews). Without it, links are only logged
(`npx wrangler tail beatbox`).

### Where things live

| Path                                                                           | What                                                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/db/schema.ts`                                                  | Drizzle tables: users and Better Auth's sessions, plus `presets` and `songs` (song parts are JSON), owned by a user |
| `src/lib/server/auth.ts`                                                       | Better Auth setup: magic links, and a new user's username and starter songs                                         |
| `src/hooks.server.ts`                                                          | Loads the signed-in user; only `/` and `/login` are open to signed-out visitors                                     |
| `src/lib/server/usernames.ts`                                                  | Generated usernames                                                                                                 |
| `src/lib/server/starter_songs/`                                                | Songs every new user gets a copy of (Midnight Arcade)                                                               |
| `src/routes/login/`, `src/routes/logout/`                                      | Sign-in page and sign-out                                                                                           |
| `src/lib/server/validation.ts`                                                 | Shape and limits for presets and song parts: drums, loops, sections                                                 |
| `src/lib/server/music.ts`                                                      | Reading and saving a user's presets and songs                                                                       |
| `src/routes/api/`                                                              | JSON endpoints the page saves and loads through                                                                     |
| `src/routes/+page.server.ts`, `src/routes/songs/[id]/`                         | The page for a new song and for a saved one                                                                         |
| `src/lib/types.ts`                                                             | Shared shapes: synth params, drums, loops, sections, window events                                                  |
| `src/lib/song.svelte.ts`                                                       | `SongStore`: the open song as a Yjs document, with undo/redo                                                        |
| `src/lib/pending_song.ts`                                                      | A signed-out visitor's song, kept in `localStorage` while they sign in                                              |
| `src/lib/Workspace.svelte`                                                     | The page: song bar, save/load, and the working copy of the open song                                                |
| `src/lib/Synth.svelte`                                                         | Synth controls, keyboard, presets, loop pads                                                                        |
| `src/lib/PianoRoll.svelte`                                                     | Note editor for a loop pad                                                                                          |
| `src/lib/DrumMachine.svelte`                                                   | Step sequencer and tempo                                                                                            |
| `src/lib/Arranger.svelte`                                                      | Arrangement panel                                                                                                   |
| `src/lib/audio.ts`                                                             | The single shared `AudioContext`                                                                                    |
| `src/lib/transport.ts`                                                         | Tempo, beat grid and metronome shared by every instrument                                                           |
| `src/lib/LoopBrowser.svelte`, `src/lib/library.ts`, `src/lib/library_items.ts` | Loop Browser modal, its search/filters, and the premade loops and beats                                             |
| `src/lib/synth/`                                                               | Synth engine, loop recorder/player, piano-roll note conversion, factory presets                                     |
| `src/lib/drums/engine.ts`                                                      | Drum sounds and sequencer                                                                                           |
| `src/lib/arranger.ts`                                                          | Plays the arrangement section by section                                                                            |

How the pieces talk:

- The unsaved working copy of the song is a Yjs document wrapped by `SongStore`
  (`src/lib/song.svelte.ts`). The instruments read its reactive mirrors and change
  the song only through its methods, so every edit lands in one `Y.UndoManager`
  history. **Save** sends its contents to the server as JSON, which validates and
  stores it (the database doesn't store Yjs data).
- Opening a song remounts the page with a fresh store (and history) for it.
- Instruments coordinate in the browser through window events:
  `beatbox:transport` for Play all / Stop all, `beatbox:scene` for arrangement
  sections, and `beatbox:state` for what's currently playing.

### Starter songs

Every new user gets their own copy of each song in `src/lib/server/starter_songs/`
when their account is created. To add one, export it from the app to that folder
as JSON (with the keys `name`, `synth`, `drums`, `loops` and `arrangement`) and
add it to `STARTER_SONGS` in `index.ts`.
