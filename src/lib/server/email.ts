import { env } from '$env/dynamic/private'

// Sign-in links are sent with Resend (https://resend.com) when RESEND_API_KEY is
// set; without it (in development) they're written to the server log instead.
// EMAIL_FROM is the sender, on a domain verified in Resend.
export async function sendMagicLink({ email, url }: { email: string; url: string }): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.log(`Sign-in link for ${email}: ${url}`)
    return
  }
  const from = env.EMAIL_FROM?.trim()
  if (!from) throw new Error('EMAIL_FROM must be set to send email with Resend')
  const note = "The link works once, for five minutes. If you didn't ask for it, ignore this email."
  const href = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  const response = await fetch('https://api.resend.com/emails', {
    body: JSON.stringify({
      from,
      html: `<p><a href="${href}">Sign in to Beatbox</a></p><p>${note}</p>`,
      subject: 'Sign in to Beatbox',
      text: `Sign in to Beatbox: ${url}\n\n${note}`,
      to: email
    }),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    method: 'POST'
  })
  // Throwing makes Better Auth report the failure instead of claiming the link was sent.
  if (!response.ok)
    throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`)
}
