import 'server-only'

/* Cloudflare Turnstile verification for public quiz submission.
   A configured key (TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY,
   see .env.example) fails closed: an invalid token, verification failure,
   or Cloudflare timeout rejects the submission. Until the keys are set,
   this is a compatibility fallback — it allows submissions through (like
   local development always has) rather than locking every test-taker out,
   but logs loudly so the missing setup step doesn't go unnoticed. */
export async function verifyTurnstileToken(
  token: string,
  ip: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.error(
      '[turnstile] TURNSTILE_SECRET_KEY is not set — allowing test submissions through unverified. ' +
        'Set TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY to turn verification on.',
    )
    return true
  }
  if (!token || token.length > 2048) return false

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!res.ok) return false

    const data = (await res.json()) as { success?: boolean; hostname?: string }
    if (data.success !== true) return false

    const permittedHostnames = (process.env.TURNSTILE_HOSTNAMES ?? '')
      .split(',')
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean)
    if (permittedHostnames.length === 0) {
      console.error(
        '[turnstile] TURNSTILE_HOSTNAMES is not set — skipping the hostname check. ' +
          'Set it to a comma-separated allowlist of your production domain(s) to turn this check on.',
      )
    }
    return (
      permittedHostnames.length === 0 ||
      (!!data.hostname && permittedHostnames.includes(data.hostname.toLowerCase()))
    )
  } catch (err) {
    console.error('Turnstile verification request failed:', err)
    return false
  }
}