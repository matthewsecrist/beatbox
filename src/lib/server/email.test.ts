import { afterEach, expect, test, vi } from 'vitest'

import { sendMagicLink } from './email.js'

const env = vi.hoisted((): Record<string, string | undefined> => ({}))
vi.mock('$env/dynamic/private', () => ({ env }))

const link = { email: 'a@example.com', url: 'https://beatbox.test/verify?token=t&callbackURL=%2F' }

afterEach(() => {
  delete env.RESEND_API_KEY
  delete env.EMAIL_FROM
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('logs the link when no Resend key is set', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(vi.fn())
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  await sendMagicLink(link)
  expect(log).toHaveBeenCalledWith(expect.stringContaining(link.url))
  expect(fetch).not.toHaveBeenCalled()
})

test('sends the link through Resend', async () => {
  env.RESEND_API_KEY = 're_test'
  env.EMAIL_FROM = 'Beatbox <noreply@beatbox.test>'
  const fetch = vi.fn(() => Promise.resolve(new Response('{}')))
  vi.stubGlobal('fetch', fetch)
  await sendMagicLink(link)
  expect(fetch).toHaveBeenCalledOnce()
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.resend.com/emails')
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer re_test')
  const body = JSON.parse(init.body as string) as {
    from: string
    html: string
    text: string
    to: string
  }
  expect(body.from).toBe(env.EMAIL_FROM)
  expect(body.to).toBe(link.email)
  expect(body.text).toContain(link.url)
  expect(body.html).toContain('href="https://beatbox.test/verify?token=t&amp;callbackURL=%2F"')
})

test('throws when Resend refuses the email', async () => {
  env.RESEND_API_KEY = 're_test'
  env.EMAIL_FROM = 'Beatbox <noreply@beatbox.test>'
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('bad from', { status: 422 })))
  )
  await expect(sendMagicLink(link)).rejects.toThrow('422')
})

test('refuses to send without a sender', async () => {
  env.RESEND_API_KEY = 're_test'
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  await expect(sendMagicLink(link)).rejects.toThrow('EMAIL_FROM')
  expect(fetch).not.toHaveBeenCalled()
})
