import 'server-only'
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
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; error: string }

async function checkRateLimit(
  key: string,
  maxCount: number,
  windowSeconds: number,
  friendlyError: string,
): Promise<RateLimitResult> {
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
    console.error('Rate limit check failed, allowing request:', error.message)
    return { allowed: true }
  }

  return data ? { allowed: true } : { allowed: false, error: friendlyError }
}

/* A teacher building several tests in one sitting is normal; a script
   creating thousands is not. */
export async function rateLimitCreateTest(): Promise<RateLimitResult> {
  const ip = await getClientIp()
  return checkRateLimit(
    `create-test:${ip}`,
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
    `submit:${testId}:${ip}`,
    8,
    10 * 60,
    'Too many submissions for this test from this connection. Please wait a few minutes and try again.',
  )
}

/* Covers code-guessing/enumeration attempts against getPublicTestByCode. */
export async function rateLimitCodeLookup(): Promise<RateLimitResult> {
  const ip = await getClientIp()
  return checkRateLimit(
    `code-lookup:${ip}`,
    30,
    5 * 60,
    'Too many attempts. Please wait a moment and try again.',
  )
}