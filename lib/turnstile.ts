import 'server-only'

/* Cloudflare Turnstile verification for public quiz submission.
   Production fails closed: a missing key, invalid token, verification
   failure, or Cloudflare timeout rejects the submission. Local development
   may omit the keys. */
export async function verifyTurnstileToken(
  token: string,
  ip: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not set.')
    return process.env.NODE_ENV !== 'production'
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
    if (process.env.NODE_ENV === 'production' && permittedHostnames.length === 0) {
      console.error('TURNSTILE_HOSTNAMES is not set.')
      return false
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
