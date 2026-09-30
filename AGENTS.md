This is a SvelteKit app (Svelte 5, strict TypeScript) with Drizzle on SQLite (libSQL).
See README.md for layout and commands.

## Project guidelines

- Before finishing, run `npm run validate` and fix everything it reports. It formats
  (Prettier) and applies ESLint's fixes (import/key ordering) first, then lints,
  type-checks (svelte-check) and tests (Vitest), so there's no separate format step.
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

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
