import { resolve } from '$app/paths'
import { auth } from '$lib/server/auth.js'
import { describe, signInSchema } from '$lib/server/validation.js'
import { fail, redirect } from '@sveltejs/kit'

import type { Actions, PageServerLoad } from './$types'

export const load = (({ locals, url }) => {
  if (locals.user) redirect(303, resolve('/'))
  // Set by Better Auth when a link is expired, already used or otherwise invalid.
  return { linkError: url.searchParams.has('error') }
}) satisfies PageServerLoad

export const actions = {
  // Emails a sign-in link. The first sign-in with an email creates its user.
  default: async ({ request, url }) => {
    const email = (await request.formData()).get('email')
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
        callbackURL: absolute(resolve('/')),
        email: result.data.email,
        errorCallbackURL: absolute(resolve('/login'))
      },
      headers: request.headers
    })
    return { sent: result.data.email }
  }
} satisfies Actions
