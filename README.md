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
**Open ▾** lists only the examples, and synth presets and drum kits can't be saved. An unsaved song is kept in
the browser while you sign in and comes back, still unsaved, once you're signed
in (even if the link opens in another tab of the same browser). Sign-in is by magic link (Better
Auth): enter your email and follow the link you're sent; it works once, for five
minutes. Everything you save (songs, with their loops and arrangement, synth presets
and drum kits) belongs to your account, and nobody else can see or change it unless you
share a song (below). Song, preset and kit names only need to be unique among your own. **My songs** and
**Sign out** are in the header.

**My songs and sharing** (**My songs** in the header, or **All my songs and sharing…**
in **Open ▾**): every song you've saved, newest change first, with its views and likes.
**Share** gives a song a link (`/s/<id>`, with an unguessable id) that anyone can open,
signed in or not; **Copy link** copies it, and **Shared** narrows the list to the songs
with a live link. **Stop sharing** makes the link stop working; sharing again makes a
new one, and the song keeps its views and likes. Shared songs are only reachable
through their link: there's no public list of them. **Delete** (after a confirmation)
removes a song for good, along with its link, views and likes.

- A shared song opens listen-only: **Play song**, each section's ▶, the drums' Play,
  its loop pads and the keyboard all play, and every setting can be seen (with its ⓘ),
  but nothing can be changed, recorded or saved.
- A **view** is someone other than the owner opening the link, counted once per person
  per song per day (by account, or a random cookie for signed-out visitors).
- **Likes** need an account: one per person per song, and pressing it again takes it
  back. You can't like your own song. Signing in from **Sign in to like it** comes back
  to the song.
- Opening your own song's link shows it as others see it, with an **Edit it** link.

**Layout**: the song bar (Play song, name, Save, **Tempo**, undo/redo, Loops, **Song
settings**, New, Open) sits on top; **Song settings** opens the master delay,
reverb, sidechain and compressor. Under it, **Tracks** lists the synth (with a row per loop pad) and the drums,
next to the arrangement: a column per section. Pick
a track's name to open it in the editor below it: the synth's **Pads, Osc, Filter,
Amp, Mod, Drive & Glide** and **Effects** tabs, the drums' **Steps, Kit** and
**Effects** tabs. The keyboard bar (octave, Chord/Arp
and the keys) stays at the bottom whichever track is open.

- Each instrument track has a **level** (the synth's covers its loop pads), and **M**
  mutes it and **S** solos it, like the drum tracks' own (solo wins over mute). Track
  mute and solo silence the instrument's echo and reverb sends too, and, like the
  drums', are for listening only: they aren't saved with the song.

**Synth**: two oscillators (sine, triangle, saw, square; octave, detune, level)
plus a sub and noise, with a pitch envelope,
a drive (distortion), a resonant filter (low-pass, high-pass, band-pass or notch) with
its own envelope, two LFOs, an ADSR envelope and 16 voices. **Drive** distorts the oscillators before the filter. **Amount** at 0 is
clean; turning it up pushes the wave harder into the **Character**'s curve: **Soft**
rounds it off towards a square, **Tube** does too but lopsided, for a warmer sound
with even harmonics, **Hard** cuts it flat for a sharper edge, and **Fold** flips it
back on itself for a wild, metallic tone that keeps changing with the amount. **Mix**
blends the clean sound back in underneath (100% is all driven), so a bass keeps
its weight. Drive keeps the level about even as it goes up. A preset shows off each
character: Buzz Bass and Overdrive Organ (tube), Dirty 808 (soft), Fuzz Lead (hard)
and Fold Growl (fold), and the Loop Browser has loops built on them. It's part of the
sound, so presets and loop pads keep their own. The
filter's **Type** picks what it keeps: **Low** (low-pass, the usual), **High**
(high-pass, thin and airy), **Band** (band-pass, nasal, a wah as it sweeps) or
**Notch** (cuts a slice out, phasey as it moves); the envelope and LFOs move the
cutoff whatever the type, and **Resonance** feels the same for each. Presets show
off each type: Airy Pad, Glass Pluck and Riser (high), Wah Clav, Auto-Wah Lead and
Radio Keys (band), Phaser Pad, Jet Lead and Hollow Bass (notch), with loops built
on them in the Loop Browser. The
filter envelope sweeps the cutoff from each note's start: **Env amount** sets how
far (up to ±4 octaves; negative sweeps down, 0 is off), with its own attack, decay, sustain and
release, so a note can open bright and close down (Acid Bass, Pluck). **Env
velocity** lets softer notes (see the piano roll's velocity lane) open it less: at
100% the sweep follows velocity all the way, off every note sweeps the full amount
(Acid Bass, Pluck, Brass, Electric Piano, Wah Clav, Moog Bass and Glass Pluck have
some). Each LFO
has its own rate, depth and target: **Filter** (wobbles; depth in octaves),
**Pitch** (vibrato; depth in cents) or **Amp** (tremolo; depth as a share of the
level), so a slow filter sweep can run under a fast vibrato. Switching target
keeps the depth at the same point of the new range. Each LFO's **Speed** is **Hz**
(free, the default) or **Sync**: one cycle per **Note** (1/1 to 1/32, dotted or
triplet) at the tempo playing, a section's own included, so it keeps time when the
tempo changes (Dubstep Wobble, Pulse Pad's gate, Riser's stutter, Auto-Wah Lead,
Jet Lead). **Glide** slides each note's
pitch from the last one over its **Time** (up to 1 s; 0 is off): **Legato** only
into a note played while the last is still held (hold one key, press the next:
the 303 slide Acid Bass uses), **Always** into every note. Chords don't slide
within themselves, and the keyboard, the arpeggiator (which lets go of each note
before the next, so it slides only on **Always**) and each loop pad glide
separately. The **Pitch Envelope** (on the Osc tab) bends each note in from its
**Amount** away (up to ±48 semitones; negative starts below, 0 is off) onto its
pitch over its **Decay**, on top of glide and vibrato: a small, fast drop punches
up an 808 (Dirty 808), a big one makes a laser (Laser) or a zap (Zap). **Sub &
Noise** (also on the Osc tab) mix two more sources in before the drive: **Sub**,
a sine an octave below Osc 1 that follows its pitch, detune, glide, vibrato and
pitch envelope, for weight under a bass (Reese Bass, Hollow Bass, Sub Pluck Bass,
Garage Bass, Moog Bass); and **Noise**, white noise for breath (Flute, Breathy
Lead), air and hiss (Airy Pad, Vinyl Keys), surf and wind (Ocean Pad, Wind), risers
(Riser) or drums on the keys (Noise Hat, Synth Snare, and Synth Kick, which adds the
sub and a pitch drop). Both are off at 0%, and a note only gets them if it starts with
them turned up. Play it
with the on-screen keyboard or your computer keyboard. It comes
with factory presets (Acid Bass, Dubstep Wobble, Reese Bass, …), and you can
save your own. The oscillator (with sub, noise and the pitch envelope), filter,
envelope (**Amp**), LFO (**Mod**), drive and glide controls each have a tab in the
synth editor.

**ⓘ explanations**: every synth sound control and panel, the Chord/Arp bar, the
drum machine's step edit buttons (Hits, Velocity, Accent, Chance, Ratchet), the
effects and the track levels have an ⓘ. Hover over it (or tap it, or tab to it) for a plain-English
explanation of what it does, written for beginners. The explanations live in
`src/lib/help.ts`, and a new setting without one fails the tests.

**Chord and Arp** (the keyboard bar, next to the octave controls): **Chord** makes one key
play a chord built up from it (major, minor, 7th, major/minor 7th, sus2, sus4,
diminished, augmented or power). **Arp** plays the notes you hold (chords
included) one at a time: **Up**, **Down**, **Up-Down** or **Random**, a **Rate**
apart (1/4 to 1/32, with triplets), locked to the song tempo. The first key starts
the pattern on the next step (at once if nothing is playing), and letting go of
every key stops it. Recording a loop keeps the notes that played, so a loop
doesn't need the arp or chord to sound the same. Both settings are saved with the
song (not with presets, which leave them alone).

**Drum machine**: kick, snare, clap, closed and open hat, and tom on a 16-step
grid, plus eight percussion tracks (rim shot, snap, shaker, conga, cowbell, wood
block, ride and crash), with four patterns (**A–D**). Copy/Paste lets you build
variations, and Randomize, Clear and Reset act on the pattern you're editing.
Switching patterns while the drums play changes over on the next bar. The song
bar's **Tempo** slider sets the tempo for the whole song (a section can have its
own; see **Arrangement**). **Tap** next to it sets the tempo from the average gap
between your last five taps; after a 2 s pause the next tap starts over, and each
run of taps is one undo step.

- The grid shows the six core tracks and any percussion the pattern uses. **Add
  track** gives another one a row to write into; the **×** on an empty percussion
  row hides it again. Which rows show is a view setting, not saved with the song.
- **Euclid** spreads a number of hits as evenly as possible over a cycle of steps
  (Bjorklund's algorithm: 3 over 8 is the tresillo, 5 over 8 the cinquillo),
  turned **Rotate** steps later and repeated to fill the bar. Pick a track, and
  **Apply** writes the rhythm into it in the pattern you're editing, as one undo
  step; each step keeps its velocity, accent and other settings.
- **Swing** (50–75%) pushes every second 16th late; 66% is a triplet shuffle.
- **Humanize** (off to 100%) nudges every hit a little early or late (up to 20 ms)
  and a little softer or louder (up to 30%), different each time round, so a
  programmed beat feels played. It's saved with the song but changes no steps.
- The step edit buttons pick what a click on a step does: **Hits** turns it on
  or off; **Velocity** (100/75/50/25%), **Chance** (the odds it plays each time
  round, same steps) and **Ratchet** (1–4 hits in the step) cycle through their
  values; **Accent** makes it louder. Outside Hits, clicking an off step turns
  it on. A step keeps its settings when switched off. Quieter steps look dimmer,
  a chance below 100% shows a dashed outline, accents a red dot.
- **Lock** gives one step its own **Tune** and **Decay** (parameter locks, as on
  an Elektron): click a step to pick it (it plays, and an off step turns on), then
  set the sliders, which start from the track's own values in the Kit tab.
  The hit plays with those in place of the track's, for melodic toms, an 808 kick
  bassline or one short open hat. **Clear** gives it back the track's settings.
  Locked steps get a blue dot (and show their tune in Lock), keep their locks when
  switched off, and save with the song; each slider drag is one undo step.
- **M** mutes a track and **S** solos it. With any track soloed only the soloed
  ones play (solo wins over mute; several can be soloed); otherwise every unmuted
  track plays. Silenced tracks look dimmer. It applies to the drums' own Play and
  to the arrangement, takes effect on the next step, and isn't saved with the song.
- **Kit** (its own tab) picks a synthesized kit: Classic, 606, 808, 909, Lo-fi or Trap.
  Every track gets the kit's sound, and **Sound** swaps in any other from the
  instrument library: each kit's own kick, snare, hats, clap and tom, plus the
  percussion (808 Cowbell, Bongo, 909 Ride, …), grouped by part, so a song can
  play an 808 kick with a 909 snare. Picking one plays it, and ▶ plays it again.
  Each track also has its own **Tune** (±12 semitones) and **Decay**. Picking a
  kit resets all three.
- **Save kit** (next to the Kit menu) saves your mix as a kit of your own: the
  kit it started from and every track's sound, tune and decay. Saved kits show
  under **Saved** in the Kit menu, to load into any song; saving under a name you
  already have overwrites that kit. A song keeps its own copy, so changing a saved
  kit later doesn't change songs that used it.

**Loop pads** (the synth's **Pads** tab): eight pads. Tap an empty pad to record, then tap it again to
finish.

- If nothing is playing, you get a one-bar count-in; otherwise recording starts
  on the next bar. A metronome clicks while you record.
- Takes are rounded to whole bars.
- Each loop keeps the synth sound it was recorded with, and loops follow tempo
  changes. To give a loop another sound, open it in the piano roll (below).
- A pad started while something else plays joins on the next bar line.

**Piano roll**: the pencil on a pad opens its loop as notes (on an empty pad,
it starts an empty one-bar loop to draw in).

- Click to add a note and drag to set its length; drag a note to move it, or its
  right edge to resize. Right-click or double-click deletes it; a focused note
  moves with the arrow keys (Shift: an octave).
- Everything snaps to the grid (1/4 to 1/32). **Quantize** moves note starts to
  it, and − / + change the loop length in bars.
- **Velocity**: the **Vel** lane under the notes has a bar per note, as tall as
  how hard it plays. Drag up or down over the bars to set them (dragging across
  several paints them; pressing a bar sets just that note, so a chord's notes can
  differ), or focus a bar and use ↑/↓ (5%, Shift: 25%). Softer notes are quieter
  and look fainter. New notes play at full velocity, as do the keyboard and the
  arpeggiator. Some Loop Browser loops have softer ghost notes (funk and disco
  basses, acid lines, busy arps), and some example-song loops have dynamics: accented
  acid lines in Acid Sunrise, pulsing arps in Afterglow Over Ibiza and Midnight
  Arcade, and unevenly played Rhodes chords in Rain on the Tape Deck.
- Edits are heard straight away, even while the pad plays, and are saved with
  the song.
- While a pad is open, the synth's sound controls and presets change that pad's
  own sound instead of the keyboard's ("Editing pad N's sound" shows at the top;
  **Done** goes back to the keyboard). Its notes change as you turn the controls,
  even while it plays; the keyboard keeps its own sound.

**Effects**: a delay and a reverb shared by the synth (loop pads included) and
the drums. Each instrument's **Effects** tab has its **Sends**: how much of it goes
to each effect (all off in a new song). **Song settings** in the song bar has the effects
themselves, with **Mix** for how loud each comes back. The delay's
**Time** is a note value (1/16 to 1/2, with dotted and triplet ones) that follows
the song tempo, with **Feedback** for how many repeats; each repeat comes back a
little darker. **Bounce** keeps the repeats in the middle (**Straight**) or sends
them from side to side (**Ping-pong**: the first from the left, the next from the
right, and so on, each a delay time apart). The reverb's **Size** is how long its tail rings (0.3–6 s). Loop
Browser previews play through the same effects.

**Sidechain** (also in Song settings) ducks the synth, dry and sends, every time
the kick plays, for the pumping house and trance sound. **Amount** is how far it
drops (off in a new song; a softer kick ducks it less) and **Release** how long it
takes to come back, as a note value at the tempo playing (1/4 swells back just as
the next four-on-the-floor kick lands). It follows the kick track wherever it
plays: the drums' own Play, the arrangement and Loop Browser beat previews. A
muted kick track, or muted drums, don't duck it.

Everything (both instruments dry and both effect returns) then goes through the
**Master** stage on its way to the speakers: a glue **Compressor** (off in a new
song; **Amount** lowers its threshold from 0 to −24 dB at 3:1, and its built-in
makeup gain keeps a typical mix about as loud: quiet parts up, peaks down), a DJ
**Filter** (off in the middle; left sweeps a low-pass down from 20 kHz to 100 Hz,
right a high-pass up from 20 Hz to 8 kHz, evenly in pitch, with a little resonance
at the cutoff, for build-ups and breakdowns), then a
fixed limiter at −1 dB and a clipper that bends smoothly from 0.95 and never lets
a sample past 0.984, so stacked sends, feedback and drive can't clip, however hot.
Below the limiter the master stage leaves the sound untouched (the filter, in the
middle, passes everything); the two compressors look ahead, which delays
everything by about 12 ms together.

**Arrangement** (the columns next to the tracks): a list of sections, each with a
length in bars, a drum pattern (or none) on the drums' row, and a toggle on each
pad's row. **Play song** plays the sections in order, and every change lands on the
section boundary. The ▶ at the top of a section plays just that one, through to its
end, and then stops; ← and → move a section.

- A section's **Tempo** plays it at its own speed (60–200 BPM); left empty, it
  follows the song's Tempo slider. Everything (drums, pads, arp, metronome and
  the delay's timing) switches exactly on the section's first beat and back to
  the song tempo after it, including when its ▶ plays it alone. Stopping goes
  back to the song tempo. Pads keep their length in beats, so they speed up
  or slow down with the section.

**Loop Browser** (**Loops** in the song bar): 143 premade loops (bass, chords,
leads, arps, each with a factory synth sound) and 72 beats across 24 genres, from
house and techno to drill, amapiano and bossa nova (at least 5 loops and 3 beats
each), in one list. The sidebar searches (name, genre, instrument, synth sound) and
filters by type, genre, instrument and length: ticked labels in one filter widen
the list, different filters narrow it. **+** puts a loop on a pad (the first empty
one, or the one picked under **Add to**; it follows the song tempo) or writes a
beat into the picked drum pattern; either is one undo step. ▶ previews an item in
time with anything already playing (beats with the song's kit, swing and humanize); press
it again, close the browser or press Stop to stop. To add more, add to
`LOOP_SPECS` or `BEAT_SPECS` in `src/lib/library_items.ts`: loops are written as a
16-step-per-bar score (`A3+C4+E4 - - . G3 …`, with a note in brackets, `(G3)`, as a
half-velocity ghost note) and beats as one `x..x` string per drum; the file explains
the notation, and a bad note or bar length fails the tests.

**Songs**: the song bar at the top saves everything together: synth, chord and
arp settings, drums, effects, loops and arrangement. **Save** stores the song (a blank name becomes
"Untitled N"). **New** starts a fresh song, and **Open ▾** loads a saved one or
an example; both ask first if you have unsaved changes. An example opens as a new,
unsaved song: change it as you like, and **Save** makes your own copy. **Play song**
plays the arrangement from the start; with no sections yet, it starts the drums and
every recorded pad instead. **Stop** stops whatever is playing.

**Undo / Redo** (the arrows in the song bar, or Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z)
cover every edit to the song: synth settings and presets, chord and arp, drum steps, kit, tuning, effects,
tempo, swing, humanize and level, recording or clearing a pad, piano-roll edits and the arrangement. A
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
npm run validate # fix what can be fixed (Prettier, ESLint --fix), then lint, type check, tests
npm run lint     # ESLint, including Prettier formatting, without changing anything
npm run check    # svelte-check (strict TypeScript)
npm test         # Vitest: audio timing, looper, arranger, song/preset store, sign-in
npm run build && npm run preview   # production build (Cloudflare adapter)
```

The code is strict TypeScript. ESLint runs type-aware `typescript-eslint` rules,
the Svelte plugin (runes only), Perfectionist sorting and Prettier. `validate` rewrites
files, so CI runs the read-only steps instead: `npm run lint`, `npm run check`,
`npm test` and `npm run build`, failing on any lint, type or test error.

### Database

Users, sessions, songs, presets and kits live in SQLite: locally `beatbox.db` by default
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

| Path                                                                           | What                                                                                                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/db/schema.ts`                                                  | Drizzle tables: users and Better Auth's sessions, plus `presets`, `kits` and `songs` (song parts are JSON), owned by a user |
| `src/lib/server/auth.ts`                                                       | Better Auth setup: magic links, and a new user's username                                                                   |
| `src/hooks.server.ts`                                                          | Loads the signed-in user; only `/`, `/login`, the examples and share links are open to signed-out visitors                  |
| `src/lib/server/usernames.ts`                                                  | Generated usernames                                                                                                         |
| `src/lib/server/examples/`, `src/routes/examples/[slug]/`                      | Example songs anyone can open (see [Example songs](#example-songs)), and their page                                         |
| `src/routes/login/`, `src/routes/logout/`                                      | Sign-in page and sign-out                                                                                                   |
| `src/lib/server/validation.ts`                                                 | Shape and limits for presets, kits and song parts: drums, loops, sections                                                   |
| `src/lib/server/music.ts`                                                      | Reading and saving a user's presets, kits and songs                                                                         |
| `src/lib/server/sharing.ts`, `src/routes/s/[shareId]/`, `src/routes/songs/`    | Share links, views and likes; a shared song's listen-only page; the My songs dashboard                                      |
| `src/routes/api/`                                                              | JSON endpoints the page saves and loads through                                                                             |
| `src/routes/+page.server.ts`, `src/routes/songs/[id]/`                         | The page for a new song and for a saved one                                                                                 |
| `src/lib/types.ts`                                                             | Shared shapes: synth params, drums, loops, sections, window events                                                          |
| `src/lib/song.svelte.ts`                                                       | `SongStore`: the open song as a Yjs document, with undo/redo                                                                |
| `src/lib/pending_song.ts`                                                      | A signed-out visitor's song, kept in `localStorage` while they sign in                                                      |
| `src/lib/Workspace.svelte`                                                     | The page: song bar, save/load, and the working copy of the open song                                                        |
| `src/lib/Synth.svelte`                                                         | Synth editor (presets, pads, sound tabs) and the keyboard bar                                                               |
| `src/lib/PianoRoll.svelte`                                                     | Note editor for a loop pad                                                                                                  |
| `src/lib/DrumMachine.svelte`                                                   | Drums editor: step sequencer, kit, saved kits                                                                               |
| `src/lib/Arranger.svelte`                                                      | Track list (level, mute, solo) and the arrangement grid                                                                     |
| `src/lib/Effects.svelte`, `src/lib/effects.ts`                                 | Master effects and per-instrument sends, and the shared delay/reverb bus and master stage every instrument plays into       |
| `src/lib/Tabs.svelte`                                                          | The editors' tab rows                                                                                                       |
| `src/lib/audio.ts`                                                             | The single shared `AudioContext`                                                                                            |
| `src/lib/transport.ts`, `src/lib/tap_tempo.ts`                                 | Tempo, beat grid and metronome shared by every instrument; tap tempo                                                        |
| `src/lib/LoopBrowser.svelte`, `src/lib/library.ts`, `src/lib/library_items.ts` | Loop Browser modal, its search/filters, and the premade loops and beats                                                     |
| `src/lib/synth/`                                                               | Synth engine, loop recorder/player, arpeggiator and chords, piano-roll note conversion, factory presets                     |
| `src/lib/drums/engine.ts`, `src/lib/drums/kits.ts`                             | Drum sounds and sequencer; the tracks, kits and instrument library                                                          |
| `src/lib/arranger.ts`                                                          | Plays the arrangement section by section                                                                                    |

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

| Example                   | Style                         | Shows off                                                                                                                                                                                                                             |
| ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Midnight Arcade**       | Synthwave / chiptune, 125 BPM | Filter-envelope bass and arp, a gliding lead with vibrato, an LFO wobble, 909 kit with ghost notes and ratchet rolls (and 808 toms swapped in), a soft shaker, a ride in the outro, which winds down to 116 BPM, dotted-8th delay     |
| **Acid Sunrise**          | Acid house, 126 BPM           | Acid Bass slides and squelch opening up across the song, tube drive on the peak's acid line, a gated Pulse Pad, 909 with swing, chance and roll fills, congas on the peak, a shaker in the breakdown, a second peak pushed to 128 BPM |
| **Glass Casket**          | Trap, 140 BPM                 | Sliding 808s (driven in the second drop), ratcheted and chance hi-hats, a tuned trap kit with rim shots and snaps, Bell and Flute melodies in reverb, a last outro slowed to 120 BPM                                                  |
| **Rain on the Tape Deck** | Lo-fi hip-hop, 82 BPM         | Electric Piano tremolo chords, heavy swing on the Lo-fi kit, ghost snares, rim clicks and a dusty shaker, gliding flute and vibrato lead, a tape that slows down (76, then 70 BPM) at the end                                         |
| **Afterglow Over Ibiza**  | Trance, 138 BPM               | Supersaw anthem, Hoover riff (always-glide), Strings swell, builds with snare rolls, a ride in the drops, breakdowns with a shaker, a final drop lifted to 140 BPM                                                                    |

The songs in `src/lib/server/examples/` are served from code, not the database:
anyone can open one at `/examples/<slug>`, signed in or not, and saving it makes
the user's own copy. To add one, export it from the app to that folder as JSON
(with the keys `name`, `synth`, `performance`, `effects`, `drums`, `loops` and
`arrangement`) and add it to `SOURCES` in `index.ts` under its slug. They're checked
with the same schema as a saved song, so a bad one fails the tests, and so does a
section that plays a pad with no loop or a pattern the song doesn't have.
