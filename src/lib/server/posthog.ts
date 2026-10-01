import { env } from '$env/dynamic/public'
import { PostHog } from 'posthog-node'

// Analytics must never change the outcome or latency of a committed mutation.
export function captureServerEvent(
  platform: App.Platform | undefined,
  distinctId: string,
  event: string
): void {
  const { PUBLIC_POSTHOG_HOST: host, PUBLIC_POSTHOG_PROJECT_TOKEN: token } = env
  if (!token || !host) return
  const task = (async () => {
    // Keep queues and pending fetches scoped to this Worker's request.
    const posthog = new PostHog(token, { flushAt: 0, flushInterval: 0, host })
    posthog.capture({ distinctId, event })
    await posthog.flush()
  })().catch((error: unknown) => {
    console.warn('PostHog capture failed', error)
  })
  platform?.ctx.waitUntil(task)
}
