import type { Handle } from '@sveltejs/kit'

import { building } from '$app/environment'
import { resolve } from '$app/paths'
import { auth } from '$lib/server/auth.js'
import { EXAMPLES } from '$lib/server/examples/index.js'
import { json, redirect } from '@sveltejs/kit'
import { isAuthPath, svelteKitHandler } from 'better-auth/svelte-kit'

// Pages anyone can see, signed in or not. A signed-out visitor can play with a new
// song on the home page or an example, but saving and opening songs needs an account.
const PUBLIC_PAGES = new Set<string>([
  resolve('/'),
  resolve('/login'),
  ...EXAMPLES.map(({ slug }) => resolve('/examples/[slug]', { slug }))
])

export const handle: Handle = async ({ event, resolve: resolveEvent }) => {
  // Better Auth's own endpoints (/api/auth/*), such as the magic link itself.
  if (building || isAuthPath(event.url.toString(), auth.options)) {
    return svelteKitHandler({ auth, building, event, resolve: resolveEvent })
  }

  const session = await auth.api.getSession({ headers: event.request.headers })
  event.locals.user = session?.user ?? null
  event.locals.session = session?.session ?? null

  // Everything else (saved songs, the save/load API) needs a signed-in user.
  if (!event.locals.user && !PUBLIC_PAGES.has(event.url.pathname)) {
    if (event.url.pathname.startsWith('/api/')) {
      return json({ error: 'Sign in first' }, { status: 401 })
    }
    // Thrown rather than returned, so SvelteKit also redirects client-side navigations.
    redirect(303, resolve('/login'))
  }

  return resolveEvent(event)
}
