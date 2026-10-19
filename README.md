# Beatbox

A music workstation in the browser: a polyphonic synth, a 16-step drum machine,
eight loop pads and an arranger, all locked to one tempo. Sound is generated live
with the Web Audio API; nothing is sampled. Songs are saved per account, and can be
shared as listen-only links.

Try it at [beatbox.matthewsecrist.workers.dev](https://beatbox.matthewsecrist.workers.dev).

Built with [SvelteKit](https://svelte.dev/docs/kit) and Svelte 5, with
[Drizzle](https://orm.drizzle.team) on SQLite (libSQL, or Cloudflare D1 when
deployed) and [Better Auth](https://better-auth.com) for magic-link sign-in.

## Features

- **Synth**: two oscillators plus sub and noise, a plucked-string mode, drive,
  a multi-mode filter with its own envelope, two tempo-syncable LFOs, glide, a pitch
  envelope and per-sound FX, with factory presets and your own.
- **Drum machine**: six core tracks and eight percussion tracks, patterns A–H of
  1–4 bars with fills, triplet grids, per-track lengths (polymeter), Euclidean
  rhythms, swing, humanize, per-step velocity, chance, ratchets and parameter locks,
  and six synthesized kits to mix and match.
- **Loop pads and piano roll**: record or draw loops with velocity and pitch bends;
  each keeps its own sound.
- **Arrangement**: sections with their own drum pattern, pads, fills, tempo and
  automation lanes.
- **Effects**: shared delay, reverb and chorus/flanger with per-instrument sends,
  per-instrument pan and EQ, sidechain, and a master compressor, DJ filter,
  bitcrusher and limiter.
- **Loop Browser**: about 150 premade loops and 70 beats across 24 genres.
- **Learn**: ten interactive music lessons for beginners, with quizzes.
- **Undo/redo** for every edit, and a plain-English ⓘ on every control.

[docs/features.md](docs/features.md) covers every control in detail.

## Getting started

Requirements: Node.js 22+.

```sh
npm run setup    # install packages and run the database migrations
npm run dev
```

Open [localhost:5173](http://localhost:5173). Everything plays without an account:
pick an [example song](#example-songs) under **Open ▾ → Examples** and press
**Play song**.

To save, press **Sign in to save** and enter any email. Unless `RESEND_API_KEY` is
set, the sign-in link isn't emailed but printed in the `npm run dev` output; open it
to sign in. Your first sign-in creates your account with a generated username (like
`groovy-reverb-7916`).

No configuration is needed locally. To change anything, copy `.env.example` to
`.env` (see [Configuration](#configuration)).

## Development

```sh
npm run validate # fix what can be fixed (Prettier, ESLint --fix), then lint, type check, test
npm run lint     # ESLint, including Prettier formatting, without changing anything
npm run check    # svelte-check (strict TypeScript)
npm test         # Vitest
npm run build && npm run preview   # production build (Cloudflare adapter)
```

The code is strict TypeScript. ESLint runs type-aware `typescript-eslint` rules,
the Svelte plugin (runes only), Perfectionist sorting and Prettier. `validate`
rewrites files, so CI (`.github/workflows/validate.yml`) runs the read-only steps
instead: `lint`, `check`, `test` and `build`. Contributor and coding-agent
conventions are in [AGENTS.md](AGENTS.md).

### Database

Users, sessions, songs, presets and kits live in SQLite: locally `beatbox.db` by
default (set `DATABASE_URL` to use another file or any libSQL URL, such as Turso,
with `DATABASE_AUTH_TOKEN`); deployed, a D1 database bound as `DB` in
`wrangler.jsonc`.

- `npm run db:migrate` applies the migrations in `drizzle/` locally.
- After changing `src/lib/server/db/schema.ts`, run `npm run db:generate` to write
  a new migration. Don't edit generated migrations by hand.

## Configuration

Settings come from the environment, or a `.env` file locally (see `.env.example`).
When deployed, plain values are `vars` in `wrangler.jsonc` and secrets are Worker
secrets.

| Variable                       | What                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`           | Signs sessions. Required in production (`openssl rand -base64 32`). Keep it secret         |
| `BETTER_AUTH_URL`              | The site's public URL, used in sign-in links. Defaults to `http://localhost:5173` in dev   |
| `BETTER_AUTH_ALLOWED_HOSTS`    | Previews only: comma-separated hosts (with `*` wildcards) that sign-in links may use       |
| `DATABASE_URL`                 | SQLite file or libSQL URL; defaults to `file:beatbox.db`. Ignored on Workers, which use D1 |
| `DATABASE_AUTH_TOKEN`          | Auth token for a remote libSQL `DATABASE_URL`. Keep it secret                              |
| `RESEND_API_KEY`               | Emails sign-in links with [Resend](https://resend.com). Unset, they're only logged         |
| `EMAIL_FROM`                   | Sender of those emails, on a domain verified in Resend. Required with `RESEND_API_KEY`     |
| `PUBLIC_POSTHOG_PROJECT_TOKEN` | [PostHog](https://posthog.com) analytics project token. Unset, analytics are off           |
| `PUBLIC_POSTHOG_HOST`          | PostHog ingestion host, such as `https://us.i.posthog.com`                                 |

PostHog server events run as best-effort background work (Worker `waitUntil`), so
analytics failures are logged without failing a save. The PostHog project token is
public by design (it's sent to every browser), which is why it can live in
`wrangler.jsonc`.

## Deploying your own copy

The app runs on Cloudflare Workers with a D1 database. `wrangler.jsonc` is set up
for the original deployment, so a fork needs its own values before deploying.

1. **Create the databases** and note the `database_id` each command prints:

   ```sh
   npx wrangler login
   npx wrangler d1 create beatbox
   npx wrangler d1 create beatbox-preview   # only if you'll use Previews
   ```

2. **Edit `wrangler.jsonc`**:

   | Key                                       | Change it to                                                                   |
   | ----------------------------------------- | ------------------------------------------------------------------------------ |
   | `name`                                    | Your Worker's name (it's part of the `*.workers.dev` URL)                      |
   | `vars.BETTER_AUTH_URL`                    | Your site's URL, such as `https://beatbox.<your-subdomain>.workers.dev`        |
   | `vars.EMAIL_FROM`                         | A sender on your Resend-verified domain, or remove it if you won't email links |
   | `vars.PUBLIC_POSTHOG_PROJECT_TOKEN`       | Your own PostHog token, or remove both `PUBLIC_POSTHOG_*` vars to turn it off  |
   | `vars.PUBLIC_POSTHOG_HOST`                | Your PostHog region's host (`us` or `eu`), or remove it                        |
   | `d1_databases[0].database_id`             | The id from `wrangler d1 create beatbox`                                       |
   | `previews.vars.BETTER_AUTH_ALLOWED_HOSTS` | `*-<worker-name>.<your-subdomain>.workers.dev`                                 |
   | `previews.vars.EMAIL_FROM`                | As above                                                                       |
   | `previews.d1_databases[0].database_id`    | The id from `wrangler d1 create beatbox-preview`                               |

   If you don't use Previews, you can delete the whole `previews` block and
   `wrangler.preview-migrations.jsonc`. Otherwise set the same preview
   `database_id` in `wrangler.preview-migrations.jsonc`.

   **Leaving the original values in place sends your analytics to someone else's
   PostHog project**, and your deploy fails on the database ids, which belong to
   another Cloudflare account.

3. **Set the secrets** (never put these in `wrangler.jsonc`):

   ```sh
   npx wrangler secret put BETTER_AUTH_SECRET   # paste the output of: openssl rand -base64 32
   npx wrangler secret put RESEND_API_KEY       # optional; without it, links only appear in `npx wrangler tail`
   ```

4. **Apply the migrations and deploy**:

   ```sh
   npx wrangler d1 migrations apply beatbox --remote
   npm run deploy
   ```

   Apply new migrations the same way before deploying code that needs them.

### Previews

With [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
connected to the repository, each pushed branch gets a Preview
(`npx wrangler preview`) at `<branch>-<worker-name>.<your-subdomain>.workers.dev`.
Previews use the `previews` block of `wrangler.jsonc`: their own D1 database and
`BETTER_AUTH_ALLOWED_HOSTS` in place of `BETTER_AUTH_URL`, since they're served on
many hosts. Their secrets are set separately:

```sh
npx wrangler preview base-config secret put BETTER_AUTH_SECRET
npx wrangler preview base-config secret put RESEND_API_KEY
```

Apply new migrations to the Previews database before pushing them:

```sh
npx wrangler d1 migrations apply beatbox-preview --remote --config wrangler.preview-migrations.jsonc
```

## How it's built

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
| `src/lib/Effects.svelte`, `src/lib/effects.ts`                                 | Song settings' effects panel, and the shared delay/reverb/chorus bus and master stage every instrument plays into           |
| `src/lib/Channel.svelte`                                                       | Each instrument's Mix tab: its pan and 3-band EQ                                                                            |
| `src/lib/Tabs.svelte`                                                          | The editors' tab rows                                                                                                       |
| `src/lib/audio.ts`                                                             | The single shared `AudioContext`, and the bitcrusher and chorus both buses build on                                         |
| `src/lib/transport.ts`, `src/lib/tap_tempo.ts`                                 | Tempo, beat grid and metronome shared by every instrument; tap tempo                                                        |
| `src/lib/LoopBrowser.svelte`, `src/lib/library.ts`, `src/lib/library_items.ts` | Loop Browser modal, its search/filters, and the premade loops and beats                                                     |
| `src/lib/synth/`                                                               | Synth engine, loop recorder/player, arpeggiator and chords, piano-roll note conversion, factory presets                     |
| `src/lib/drums/engine.ts`, `src/lib/drums/kits.ts`                             | Drum sounds and sequencer; the tracks, kits and instrument library                                                          |
| `src/lib/arranger.ts`                                                          | Plays the arrangement section by section                                                                                    |

### How it fits together

- The unsaved working copy of the song is a Yjs document wrapped by `SongStore`
  (`src/lib/song.svelte.ts`). The instruments read its reactive mirrors and change
  the song only through its methods, so every edit lands in one `Y.UndoManager`
  history. **Save** sends its contents to the server as JSON, which validates and
  stores it (the database doesn't store Yjs data).
- Opening a song remounts the page with a fresh store (and history) for it.
- Instruments coordinate in the browser through window events:
  `beatbox:transport` for starting everything and Stop, `beatbox:song` for Play song, `beatbox:scene` for arrangement
  sections, and `beatbox:state` for what's currently playing.

Audio details:

The plucked-string DSP and AudioWorklet live in `src/lib/synth/pluck_dsp.ts` and
`pluck_worklet.ts`; `pluck.ts` loads the bundled worklet once per audio context.
After `createSynth()`, await `synth.ready()` before enabling notes or starting a
player. Live playback and both browsers surface loading failures instead of
dropping the first notes. Audio initialization stays browser-only.

Clean synth notes (Drive amount or mix at zero) omit the distortion branch to
reduce audio-node creation and processing. The clean path keeps its 4× oversampling
and DC filter; enabling Drive on a held note adds the branch and fades it in.
Disabled voice LFOs likewise allocate no nodes. Enabling one on a held note starts
it at phase zero and fades its depth in; once enabled, it keeps its phase until
the voice ends, including while its depth is zero. Shared sound effects update
only changed settings (and delay time when tempo changes), not every note.

Audio scheduling still runs every 25 ms with a 100 ms lookahead. Pad and piano-roll
progress updates are limited to 20 Hz while visible and stop while the synth
editor or Pads tab is hidden; playing/stop state continues to follow the audio.

## Example songs

Each example shows off a different corner of the app, and each sets up the
keyboard (**Chord** and **Arp**) to play along:

| Example                   | Style                         | Shows off                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Midnight Arcade**       | Synthwave / chiptune, 125 BPM | Filter-envelope bass and arp, a gliding lead with vibrato and two-semitone scoops, an LFO wobble, 909 kit with ghost notes and ratchet rolls (and 808 toms swapped in), a soft shaker, a ride in the outro, which winds down to 116 BPM, dotted-8th delay, a chorus on the synths, bitcrushed arp and chip lead, a one-shot zap arpeggio shooting into each drop, an intro that boots up out of a crushed mix                                             |
| **Acid Sunrise**          | Acid house, 126 BPM           | Acid Bass slides and squelch opening up across the song, tube drive on the peak's acid line, a gated Pulse Pad, 909 with swing, chance and roll fills (one a section's Fill into the stabs), congas on the peak, a shaker and a flanger swept into the drums in the breakdown, a second peak pushed to 128 BPM, the outro's acid loop entering from bar 3                                                                                                 |
| **Glass Casket**          | Trap, 140 BPM                 | Sliding 808s with octave dives (driven in the second drop), ratcheted and chance hi-hats, snare rolls into each drop and, as the first drop's Fill, into the hook, a tuned trap kit with rim shots and snaps, Bell and Flute melodies in reverb, a one-shot laser stinger at the top of each drop, a last outro slowed to 120 BPM                                                                                                                         |
| **Rain on the Tape Deck** | Lo-fi hip-hop, 82 BPM         | Electric Piano tremolo chords (lightly crushed, in their own small room, through a slow, deep chorus), clean plucked-guitar fills with natural string decay, heavy swing on the crushed Lo-fi kit, ghost snares, fills closing out the flute and lead themes, rim clicks and a dusty shaker, gliding flute and vibrato lead, a tape that slows down (76, then 70 BPM) and wears out into crunch at the end, the final pad entering from bar 3 of its loop |
| **Afterglow Over Ibiza**  | Trance, 138 BPM               | Supersaw anthem (chorused wide), Hoover riff (always-glide), Strings swell, a snare-roll Fill into the build, builds with snare rolls, a ride in the drops, breakdowns with a shaker, a final drop lifted to 140 BPM                                                                                                                                                                                                                                      |

Every example also spreads its hats, toms and hand percussion across the speakers
(each drum's **Pan**), with the kick, snare and clap in the middle, and shapes its
instruments with the **Mix** tab's EQ: a deeper kick in the house, trance, synthwave
and trap songs, dulled drums and warmer keys in the lo-fi one.

The songs in `src/lib/server/examples/` are served from code, not the database:
anyone can open one at `/examples/<slug>`, signed in or not, and saving it makes
the user's own copy. To add one, export it from the app to that folder as JSON
(with the keys `name`, `synth`, `performance`, `effects`, `drums`, `loops` and
`arrangement`) and add it to `SOURCES` in `index.ts` under its slug. They're checked
with the same schema as a saved song, so a bad one fails the tests, and so does a
section that plays a pad with no loop or a pattern the song doesn't have.

## License

[MIT](LICENSE)
