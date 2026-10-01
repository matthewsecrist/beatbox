import type { HandleClientError } from '@sveltejs/kit'

import { env } from '$env/dynamic/public'
import posthog from 'posthog-js'

// PostHog runs only where both are set: production, via wrangler.jsonc `vars`.
export function init(): void {
  if (!env.PUBLIC_POSTHOG_PROJECT_TOKEN || !env.PUBLIC_POSTHOG_HOST) return

  posthog.init(env.PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: env.PUBLIC_POSTHOG_HOST,
    capture_exceptions: {
      capture_console_errors: false,
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true
    },
    tracing_headers: [window.location.hostname]
  })
}

export const handleError: HandleClientError = ({ error }) => {
  posthog.captureException(error)
}
