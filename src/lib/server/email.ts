// There's no mail provider yet, so sign-in links are written to the server log.
// Swap this for a real sender (SMTP, Resend, …) before deploying.
export function sendMagicLink({ email, url }: { email: string; url: string }): void {
  console.log(`Sign-in link for ${email}: ${url}`)
}
