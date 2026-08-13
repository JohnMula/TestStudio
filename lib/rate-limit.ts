import 'server-only'
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'

/* ============================================================
   IP-based rate limiting for the actions that have none today:
   createTest, submitResponse, getPublicTestByCode.

   Backed by a tiny Postgres table (see supabase/rate_limits.sql —
   run that once in the Supabase SQL editor) rather than a new
   Redis/Upstash service, since the app already has Supabase and
   this keeps everything in one place. check_rate_limit() is a
   single atomic UPSERT on the DB side, so concurrent requests
   can't race past the limit the way a read-then-write check in
   application code could.

   Limits are per-IP via the x-forwarded-for header, which Vercel
   sets on every request.
   ============================================================ */

export async function getClientIp(): Promise<string> {
  const h = await headers()
  const canTrustProxyHeaders =
    process.env.VERCEL === '1' || process.env.TRUST_PROXY_IP_HEADERS === 'true'
  if (!canTrustProxyHeaders) return 'unknown'

  const forwarded = h.get('x-vercel-forwarded-for') ?? h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; error: string }

async function checkRateLimit(
  scope: string,
  subject: string,
  maxCount: number,
  windowSeconds: number,
  friendlyError: string,
): Promise<RateLimitResult> {
  const secret = process.env.RATE_LIMIT_SECRET
  if (!secret) {
    console.error('RATE_LIMIT_SECRET is not set.')
    if (process.env.NODE_ENV === 'production') {
      return {
        allowed: false,
        error: 'Requests are temporarily unavailable. Please try again shortly.',
      }
    }
  }
  const key = `${scope}:${createHash('sha256')
    .update(`${secret ?? 'development-only'}|${subject}`)
    .digest('hex')}`
  const db = createServiceClient()
  const { data, error } = await db.rpc('check_rate_limit', {
    p_key: key,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    // Fails OPEN on infra errors (e.g. supabase/rate_limits.sql hasn't
    // been run yet) so a setup gap doesn't take the whole app down —
    // but this is loud in the server logs, since a silently-broken
    // limiter is exactly the "zero protection" state we're fixing.
    console.error('Rate limit check failed:', error.message)
    if (process.env.NODE_ENV === 'production') {
      return {
        allowed: false,
        error: 'Requests are temporarily unavailable. Please try again shortly.',
      }
    }
    return { allowed: true }
  }

  return data ? { allowed: true } : { allowed: false, error: friendlyError }
}

/* A teacher building several tests in one sitting is normal; a script
   creating thousands is not. */
export async function rateLimitCreateTest(): Promise<RateLimitResult> {
  const ip = await getClientIp()
  return checkRateLimit(
    'create-test',
    ip,
    15,
    60 * 60,
    'Too many tests created from this connection recently. Please try again in a bit.',
  )
}

/* Scoped per (test, ip) rather than globally per ip — a whole classroom
   can share one IP behind school wifi/NAT, so this only limits how many
   times ONE ip hits ONE test in the window, not every test everywhere. */
export async function rateLimitSubmitResponse(
  testId: string,
): Promise<RateLimitResult> {
  const ip = await getClientIp()
  return checkRateLimit(
    'submit',
    `${testId}:${ip}`,
    8,
    10 * 60,
    'Too many submissions for this test from this connection. Please wait a few minutes and try again.',
  )
}

/* Covers code-guessing/enumeration attempts against getPublicTestByCode. */
export async function rateLimitCodeLookup(): Promise<RateLimitResult> {
  const ip = await getClientIp()
  return checkRateLimit(
    'code-lookup',
    ip,
    30,
    5 * 60,
    'Too many attempts. Please wait a moment and try again.',
  )
}

export async function rateLimitSubmissionStatus(testId: string): Promise<RateLimitResult> {
  const ip = await getClientIp()
  return checkRateLimit(
    'submission-status',
    `${testId}:${ip}`,
    60,
    5 * 60,
    'Too many attempts. Please wait a moment and try again.',
  )
}

export async function rateLimitTestWrite(): Promise<RateLimitResult> {
  const ip = await getClientIp()
  return checkRateLimit(
    'test-write',
    ip,
    30,
    60 * 60,
    'Too many test changes from this connection recently. Please try again later.',
  )
}

export async function rateLimitDraftWrite(): Promise<RateLimitResult> {
  const ip = await getClientIp()
  return checkRateLimit(
    'draft-write',
    ip,
    240,
    10 * 60,
    'Too many draft updates from this connection recently. Please wait a few minutes and try again.',
  )
}

export async function rateLimitGradeEssay(): Promise<RateLimitResult> {
  const ip = await getClientIp()
  return checkRateLimit(
    'grade-essay',
    ip,
    120,
    10 * 60,
    'Too many grading changes from this connection recently. Please try again later.',
  )
}
