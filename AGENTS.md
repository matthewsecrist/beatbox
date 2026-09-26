This is a SvelteKit app (Svelte 5, JavaScript) with Drizzle on SQLite (libSQL).
See README.md for layout and commands.

## Project guidelines

- Before finishing, run `npm run check` and `npm test`, and fix what they report.
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) and event
  attributes (`onclick`), not Svelte 4 syntax (`export let`, `on:click`, stores for local state).
- Server-only code lives in `src/lib/server/`. Validate anything a client sends
  with the schemas in `src/lib/server/validation.js` before storing it.
- Schema changes: edit `src/lib/server/db/schema.js`, then `npm run db:generate`
  to create a migration. Never edit generated migrations by hand.
- Styling is Tailwind v4 (configured in `src/app.css`, no `tailwind.config.js`).
  Icons come from Lucide (`import { Play } from "@lucide/svelte"`, then `<Play class="size-4" />`).
- Audio runs entirely in the browser; keep Web Audio code out of server modules and
  only touch `window`/`AudioContext` from `onMount` or event handlers (pages are server-rendered).
- Give key elements stable ids (`#song-form`, `#save-song`, …) so they can be targeted in tests.
