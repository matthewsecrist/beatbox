import type { AuthSession, SessionUser } from '$lib/server/auth'
import type { ExecutionContext } from '@cloudflare/workers-types'

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      // The signed-in user and their session; null when signed out.
      session: AuthSession | null
      user: null | SessionUser
    }
    interface Platform {
      ctx: ExecutionContext
    }
  }
}

export {}
