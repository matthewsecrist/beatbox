import { resolve } from '$app/paths'
import { auth } from '$lib/server/auth.js'
import { redirect } from '@sveltejs/kit'

import type { RequestHandler } from './$types'

// Signing out is a POST (the header's Sign out form), so a link can't sign you out.
export const POST: RequestHandler = async ({ request }) => {
  await auth.api.signOut({ headers: request.headers })
  redirect(303, resolve('/login'))
}
