This is a SvelteKit app (Svelte 5, strict TypeScript) with Drizzle on SQLite (libSQL).
See README.md for layout and commands.

## Project guidelines

- Before finishing, run `npm run validate` (ESLint + Prettier, svelte-check, Vitest)
  and fix everything it reports. `npm run format` fixes formatting; `npx eslint . --fix`
  fixes import/key ordering.
- Never silence the linter or type checker (`eslint-disable`, `@ts-ignore`, `any`,
  non-null `!`) to get green; fix the types instead.
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) and event
  attributes (`onclick`), not Svelte 4 syntax (`export let`, `on:click`, stores for local state).
  Type props with an annotation on `$props()`; use `lang="ts"` in every component.
- The open song lives in `SongStore` (`src/lib/song.svelte.ts`, a Yjs document with
  undo/redo). Components read its mirrors and change the song only through its
  methods, never by keeping their own copy; UI-only state (playing, selection) stays
  local. New song data needs a place in the document and a store method.
- Shared shapes live in `src/lib/types.ts`. Server-only code lives in `src/lib/server/`.
  Validate anything a client sends with the zod schemas in `src/lib/server/validation.ts`
  before storing it.
- Links and navigation go through `resolve()` from `$app/paths`.
- Schema changes: edit `src/lib/server/db/schema.ts`, then `npm run db:generate`
  to create a migration. Never edit generated migrations by hand.
- Styling is Tailwind v4 (configured in `src/app.css`, no `tailwind.config.js`).
  Icons come from Lucide (`import { Play } from "@lucide/svelte"`, then `<Play class="size-4" />`).
- Audio runs entirely in the browser; keep Web Audio code out of server modules and
  only touch `window`/`AudioContext` from `onMount` or event handlers (pages are server-rendered).
- Tests use Vitest with `expect` (every test must assert). Stub audio with small fakes
  cast to `BaseAudioContext`, and use `vi.fn()` for no-op callbacks.
- Give key elements stable ids (`#song-form`, `#save-song`, …) so they can be targeted in tests.
