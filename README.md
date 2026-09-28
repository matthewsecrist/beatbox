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
To hear what it can do, pick one of the [example songs](#example-songs) under **Examples** in **Open ▾**
and press **Play song**. To save, press **Sign in to save** and enter your email.
Unless `RESEND_API_KEY` is set, the sign-in link isn't emailed but printed in the
`npm run dev` output; open it to sign in. Your first sign-in creates your account,
with a generated username (like `groovy-reverb-7916`, shown top right).

## What's in it

**Accounts**: without one, the home page is a new song with every instrument,
factory preset and the arranger working, but **Save** becomes **Sign in to save**,
**Open ▾** lists only the examples, and synth presets can't be saved. An unsaved song is kept in
the browser while you sign in and comes back, still unsaved, once you're signed
in (even if the link opens in another tab of the same browser). Sign-in is by magic link (Better
Auth): enter your email and follow the link you're sent; it works once, for five
minutes. Everything you save (songs, with their loops and arrangement, and synth presets)
belongs to your account, and nobody else can see or change it unless you share a song
(below). Song and preset names only need to be unique among your own. **My songs** and
**Sign out** are in the header.

**My songs and sharing** (**My songs** in the header, or **All my songs and sharing…**
in **Open ▾**): every song you've saved, newest change first, with its views and likes.
**Share** gives a song a link (`/s/<id>`, with an unguessable id) that anyone can open,
signed in or not; **Copy link** copies it, and **Shared** narrows the list to the songs
with a live link. **Stop sharing** makes the link stop working; sharing again makes a
new one, and the song keeps its views and likes. Shared songs are only reachable
through their link: there's no public list of them.

- A shared song opens listen-only: **Play song**, each section's ▶, the drums' Play,
  its loop pads and the keyboard all play, and every setting can be seen (with its ⓘ),
  but nothing can be changed, recorded or saved.
- A **view** is someone other than the owner opening the link, counted once per person
  per song per day (by account, or a random cookie for signed-out visitors).
- **Likes** need an account: one per person per song, and pressing it again takes it
  back. You can't like your own song. Signing in from **Sign in to like it** comes back
  to the song.
- Opening your own song's link shows it as others see it, with an **Edit it** link.

**Synth**: two oscillators (sine, triangle, saw, square; octave, detune, level),
a resonant low-pass filter with its own envelope, two LFOs, an ADSR envelope and 16 voices. The
filter envelope sweeps the cutoff from each note's start: **Env amount** sets how
far (up to ±4 octaves; negative sweeps down, 0 is off), with its own attack, decay, sustain and
release, so a note can open bright and close down (Acid Bass, Pluck). Each LFO
has its own rate, depth and target: **Filter** (wobbles; depth in octaves),
**Pitch** (vibrato; depth in cents) or **Amp** (tremolo; depth as a share of the
level), so a slow filter sweep can run under a fast vibrato. Switching target
keeps the depth at the same point of the new range. **Glide** slides each note's
pitch from the last one over its **Time** (up to 1 s; 0 is off): **Legato** only
into a note played while the last is still held (hold one key, press the next:
the 303 slide Acid Bass uses), **Always** into every note. Chords don't slide
within themselves, and the keyboard, the arpeggiator (which lets go of each note
before the next, so it slides only on **Always**) and each loop pad glide
separately. Play it with the on-screen keyboard or your computer keyboard. It comes
with factory presets (Acid Bass, Dubstep Wobble, Reese Bass, …), and you can
save your own. The oscillator, filter, envelope, LFO and glide controls sit under **Sound
settings**, collapsed until you open it.

**ⓘ explanations**: every Sound settings control and panel, the Chord/Arp bar, the
drum machine's step edit buttons (Hits, Velocity, Accent, Chance, Ratchet) and the
Effects panel have an ⓘ. Hover over it (or tap it, or tab to it) for a plain-English
explanation of what it does, written for beginners. The explanations live in
`src/lib/help.ts`, and a new setting without one fails the tests.

**Chord and Arp** (the bar under the octave controls): **Chord** makes one key
play a chord built up from it (major, minor, 7th, major/minor 7th, sus2, sus4,
diminished, augmented or power). **Arp** plays the notes you hold (chords
included) one at a time: **Up**, **Down**, **Up-Down** or **Random**, a **Rate**
apart (1/4 to 1/32, with triplets), locked to the song tempo. The first key starts
the pattern on the next step (at once if nothing is playing), and letting go of
every key stops it. Recording a loop keeps the notes that played, so a loop
doesn't need the arp or chord to sound the same. Both settings are saved with the
song (not with presets, which leave them alone).

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

**Effects**: a delay and a reverb shared by the synth (loop pads included) and
the drums. **Sends** set how much of each instrument goes to each effect (all
off in a new song), and **Mix** how loud each effect comes back. The delay's
**Time** is a note value (1/16 to 1/2, with dotted and triplet ones) that follows
the song tempo, with **Feedback** for how many repeats; each repeat comes back a
little darker. The reverb's **Size** is how long its tail rings (0.3–6 s). Loop
Browser previews play through the same effects.

**Arrangement**: a list of sections, each with a length in bars, a drum pattern
(or none) and toggles for each pad. **Play song** plays the sections in order,
and every change lands on the section boundary. The ▶ at the start of a section
plays just that one, through to its end, and then stops.

**Loop Browser** (**Loops** in the song bar): 120 premade loops (bass, chords,
leads, arps, each with a factory synth sound) and 72 beats across 24 genres, from
house and techno to drill, amapiano and bossa nova (at least 5 loops and 3 beats
each), in one list. The sidebar searches (name, genre, instrument, synth sound) and
filters by type, genre, instrument and length: ticked labels in one filter widen
the list, different filters narrow it. **+** puts a loop on a pad (the first empty
one, or the one picked under **Add to**; it follows the song tempo) or writes a
beat into the picked drum pattern; either is one undo step. ▶ previews an item in
time with anything already playing (beats with the song's kit and swing); press
it again, close the browser or press Stop to stop. To add more, add to
`LOOP_SPECS` or `BEAT_SPECS` in `src/lib/library_items.ts`: loops are written as a
16-step-per-bar score (`A3+C4+E4 - - . G3 …`) and beats as one `x..x` string per
drum; the file explains the notation, and a bad note or bar length fails the tests.

**Songs**: the song bar at the top saves everything together: synth, chord and
arp settings, drums, effects, loops and arrangement. **Save** stores the song (a blank name becomes
"Untitled N"). **New** starts a fresh song, and **Open ▾** loads a saved one or
an example; both ask first if you have unsaved changes. An example opens as a new,
unsaved song: change it as you like, and **Save** makes your own copy. **Play song**
plays the arrangement from the start; with no sections yet, it starts the drums and
every recorded pad instead. **Stop** stops whatever is playing.

**Undo / Redo** (the arrows in the song bar, or Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z)
cover every edit to the song: synth settings and presets, chord and arp, drum steps, kit, tuning, effects,
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
since they have no owner.

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
| `src/lib/server/auth.ts`                                                       | Better Auth setup: magic links, and a new user's username                                                           |
| `src/hooks.server.ts`                                                          | Loads the signed-in user; only `/`, `/login`, the examples and share links are open to signed-out visitors          |
| `src/lib/server/usernames.ts`                                                  | Generated usernames                                                                                                 |
| `src/lib/server/examples/`, `src/routes/examples/[slug]/`                      | Example songs anyone can open (Midnight Arcade), and their page                                                     |
| `src/routes/login/`, `src/routes/logout/`                                      | Sign-in page and sign-out                                                                                           |
| `src/lib/server/validation.ts`                                                 | Shape and limits for presets and song parts: drums, loops, sections                                                 |
| `src/lib/server/music.ts`                                                      | Reading and saving a user's presets and songs                                                                       |
| `src/lib/server/sharing.ts`, `src/routes/s/[shareId]/`, `src/routes/songs/`    | Share links, views and likes; a shared song's listen-only page; the My songs dashboard                              |
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
| `src/lib/Effects.svelte`, `src/lib/effects.ts`                                 | Effects panel, and the shared delay/reverb bus every instrument plays into                                          |
| `src/lib/audio.ts`                                                             | The single shared `AudioContext`                                                                                    |
| `src/lib/transport.ts`                                                         | Tempo, beat grid and metronome shared by every instrument                                                           |
| `src/lib/LoopBrowser.svelte`, `src/lib/library.ts`, `src/lib/library_items.ts` | Loop Browser modal, its search/filters, and the premade loops and beats                                             |
| `src/lib/synth/`                                                               | Synth engine, loop recorder/player, arpeggiator and chords, piano-roll note conversion, factory presets             |
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
  `beatbox:transport` for starting everything and Stop, `beatbox:song` for Play song, `beatbox:scene` for arrangement
  sections, and `beatbox:state` for what's currently playing.

### Example songs

Each example shows off a different corner of the app, and each sets up the
keyboard (**Chord** and **Arp**) to play along:

| Example                   | Style                         | Shows off                                                                                                                              |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Midnight Arcade**       | Synthwave / chiptune, 125 BPM | Filter-envelope bass and arp, a gliding lead with vibrato, an LFO wobble, 909 kit with ghost notes and ratchet rolls, dotted-8th delay |
| **Acid Sunrise**          | Acid house, 126 BPM           | Acid Bass slides and squelch opening up across the song, a gated Pulse Pad, 909 with swing, chance and roll fills                      |
| **Glass Casket**          | Trap, 140 BPM                 | Sliding 808s, ratcheted and chance hi-hats, a tuned trap kit, Bell and Flute melodies in reverb                                        |
| **Rain on the Tape Deck** | Lo-fi hip-hop, 82 BPM         | Electric Piano tremolo chords, heavy swing on the Lo-fi kit, ghost snares, gliding flute and vibrato lead                              |
| **Afterglow Over Ibiza**  | Trance, 138 BPM               | Supersaw anthem, Hoover riff (always-glide), Strings swell, builds with snare rolls, breakdowns                                        |

The songs in `src/lib/server/examples/` are served from code, not the database:
anyone can open one at `/examples/<slug>`, signed in or not, and saving it makes
the user's own copy. To add one, export it from the app to that folder as JSON
(with the keys `name`, `synth`, `performance`, `effects`, `drums`, `loops` and
`arrangement`) and add it to `SOURCES` in `index.ts` under its slug. They're checked
with the same schema as a saved song, so a bad one fails the tests, and so does a
section that plays a pad with no loop or a pattern the song doesn't have.
