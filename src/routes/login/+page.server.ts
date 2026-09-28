import { resolve } from '$app/paths'
import { auth } from '$lib/server/auth.js'
import { describe, signInSchema } from '$lib/server/validation.js'
import { fail, redirect } from '@sveltejs/kit'

import type { Actions, PageServerLoad } from './$types'

// Where to go after signing in: back to a shared song (?next=/s/<shareId>) if the
// visitor came from one, else home. Only this site's share pages are allowed, so
// the link can't send anyone elsewhere. (`resolve` gives paths relative to the
// page here, hence the URLs to make them absolute.)
function next(url: URL, value: unknown = url.searchParams.get('next')): string {
  const home = new URL(resolve('/'), url).pathname
  const share = new RegExp(`^${home}s/[\\w-]+$`)
  return typeof value === 'string' && share.test(value) ? value : home
}

export const load = (({ locals, url }) => {
  if (locals.user) redirect(303, next(url))
  // Set by Better Auth when a link is expired, already used or otherwise invalid.
  return { linkError: url.searchParams.has('error'), next: next(url) }
}) satisfies PageServerLoad

export const actions = {
  // Emails a sign-in link. The first sign-in with an email creates its user.
  default: async ({ request, url }) => {
    const data = await request.formData()
    const email = data.get('email')
    const result = signInSchema.safeParse({ email })
    if (!result.success) {
      return fail(422, {
        email: typeof email === 'string' ? email : '',
        error: describe(result.error)
      })
    }
    // The link is opened from an email, so it needs absolute paths (`resolve` gives
    // paths relative to this page while rendering).
    const absolute = (path: string) => new URL(path, url).pathname
    await auth.api.signInMagicLink({
      body: {
        callbackURL: absolute(next(url, data.get('next'))),
        email: result.data.email,
        errorCallbackURL: absolute(resolve('/login'))
      },
      headers: request.headers
    })
    return { sent: result.data.email }
  }
} satisfies Actions
