import { building, dev } from '$app/environment'
import { getRequestEvent } from '$app/server'
import { env } from '$env/dynamic/private'
import { error } from '@sveltejs/kit'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { sveltekitCookies } from 'better-auth/svelte-kit'

import { db } from './db/index.js'
import { accounts, sessions, users, verifications } from './db/schema.js'
import { sendMagicLink } from './email.js'
import { generateUsername } from './usernames.js'

// Sign-in is by magic link only: the user enters their email and follows the link
// they're sent. The first sign-in creates the user, with a generated username.
//
// Environment (see .env.example): BETTER_AUTH_SECRET signs sessions and is required
// in production; BETTER_AUTH_URL is the site's public URL, used in the links sent
// (in development it defaults to Vite's dev server). Previews are served on many
// hosts, so they set BETTER_AUTH_ALLOWED_HOSTS (comma-separated, `*` wildcards)
// instead, and links use the host each request came in on.
// A blank value (as in a copied .env.example) counts as unset.
const allowedHosts = (env.BETTER_AUTH_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter((host) => host !== '')
const configuredURL = env.BETTER_AUTH_URL?.trim()
const baseURL =
  allowedHosts.length > 0
    ? { allowedHosts, protocol: 'https' as const }
    : configuredURL !== undefined && configuredURL !== ''
      ? configuredURL
      : dev
        ? 'http://localhost:5173'
        : undefined
// `vite build` loads this module to analyse the app, without the runtime
// environment, and Better Auth refuses to start without a secret. Nothing is
// signed during the build.
const secret = building ? 'placeholder-secret-used-only-while-building' : env.BETTER_AUTH_SECRET

export const auth = betterAuth({
  ...(baseURL ? { baseURL } : {}),
  ...(secret ? { secret } : {}),
  advanced: { database: { generateId: 'uuid' } },
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { account: accounts, session: sessions, user: users, verification: verifications }
  }),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const username = await generateUsername()
          return { data: { ...user, name: user.name || username, username } }
        }
      }
    }
  },
  plugins: [
    magicLink({ sendMagicLink }),
    // Must stay last: copies cookies set by `auth.api` calls onto the SvelteKit response.
    sveltekitCookies(getRequestEvent)
  ],
  user: {
    additionalFields: {
      username: { input: false, required: true, type: 'string', unique: true }
    }
  }
})

export type AuthSession = typeof auth.$Infer.Session.session
export type SessionUser = typeof auth.$Infer.Session.user

// The signed-in user, for routes that need one. `hooks.server.ts` already sends
// signed-out visitors to the login page, so this only guards against a route
// being reached some other way.
export function requireUser(locals: App.Locals): SessionUser {
  if (!locals.user) error(401, 'Sign in first')
  return locals.user
}
