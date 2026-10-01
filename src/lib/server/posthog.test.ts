import { createServer } from 'node:http'
import { afterEach, expect, test, vi } from 'vitest'

import { captureServerEvent } from './posthog.js'

const env = vi.hoisted((): Record<string, string | undefined> => ({}))
vi.mock('$env/dynamic/public', () => ({ env }))

afterEach(() => {
  delete env.PUBLIC_POSTHOG_HOST
  delete env.PUBLIC_POSTHOG_PROJECT_TOKEN
  vi.restoreAllMocks()
})

test('a rejected analytics request runs in the background and cannot fail the mutation', async () => {
  let rejectRequest: (() => void) | undefined
  let received: (() => void) | undefined
  const requestReceived = new Promise<void>((resolve) => {
    received = resolve
  })
  const server = createServer((_request, response) => {
    rejectRequest = () => {
      response.writeHead(401)
      response.end('denied')
    }
    received?.()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No listening address')
  env.PUBLIC_POSTHOG_HOST = `http://127.0.0.1:${address.port}`
  env.PUBLIC_POSTHOG_PROJECT_TOKEN = 'invalid'
  const warn = vi.spyOn(console, 'warn').mockImplementation(vi.fn())
  let task: Promise<unknown> | undefined
  const platform = {
    ctx: {
      waitUntil: (promise: Promise<unknown>) => {
        task = promise
      }
    }
  } as App.Platform
  try {
    captureServerEvent(platform, 'user', 'song_created')
    await requestReceived
    // Capture has returned while the telemetry request still has no response.
    expect(warn).not.toHaveBeenCalled()
    if (!rejectRequest || !task) throw new Error('Analytics was not scheduled')
    rejectRequest()
    await task
    expect(warn).toHaveBeenCalledWith('PostHog capture failed', expect.any(Error))
    expect(warn.mock.calls[0]?.[1]).toHaveProperty('response.status', 401)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
