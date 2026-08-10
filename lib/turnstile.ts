import 'server-only'

/* ============================================================
   Cloudflare Turnstile verification, used by submitResponse().

   Rate limiting (lib/rate-limit.ts) slows a script down; this stops
   the scripted path more directly — something hitting the server
   action straight via fetch() has no way to produce a valid token
   without actually solving Turnstile's challenge, which needs a real
   browser context, unlike a per-IP counter.

   Needs two env vars, set together:
     NEXT_PUBLIC_TURNSTILE_SITE_KEY  — public, read by the widget
     TURNSTILE_SECRET_KEY            — server-only, used here

   Until both are set, this fails OPEN (same convention as
   lib/rate-limit.ts): submissions go through unverified, exactly as
   today, with a loud console.error so the gap doesn't go unnoticed.
   Once TURNSTILE_SECRET_KEY is set, verification is enforced — a
   missing or invalid token is rejected.

   Cloudflare publishes fixed test keys for local development that
   always pass/fail without a real site registered:
   https://developers.cloudflare.com/turnstile/troubleshooting/testing/
   ============================================================ */

export async function verifyTurnstileToken(
  token: string,
  ip: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.error(
      'TURNSTILE_SECRET_KEY is not set — accepting submission unverified. ' +
        'Set NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY together to enforce this.',
    )
    return true
  }
  if (!token) return false

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      },
    )
    const data = (await res.json()) as { success: boolean }
    return data.success === true
  } catch (err) {
    // A network hiccup reaching Cloudflare shouldn't block every real
    // submission app-wide — this is the one spot that errs toward
    // "allow" on infra failure rather than policy failure, same
    // reasoning as the fail-open above, just triggered differently.
    console.error('Turnstile verification request failed:', err)
    return true
  }
}