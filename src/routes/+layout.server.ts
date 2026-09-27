import type { LayoutServerLoad } from './$types'

export const load = (({ locals }) => ({
  user: locals.user ? { email: locals.user.email, username: locals.user.username } : null
})) satisfies LayoutServerLoad
