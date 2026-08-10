import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/* ============================================================
   Runs on (almost) every request via the root proxy.ts.

   There's no login in this app — instead, every browser gets a
   persistent anonymous Supabase Auth session on its first visit,
   stored in a cookie. That session's auth.uid() is what the
   "tests_*" / "responses_*" RLS policies key off of, so a device
   only ever sees the tests it created (see lib/actions.ts and the
   SQL migration).
   ============================================================ */

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getClaims() verifies the JWT (locally, or with a single Auth-server
  // call on older symmetric-key projects) — enough to know "is there a
  // session at all" without trusting an unverified cookie.
  const { data: claimsData } = await supabase.auth.getClaims()

  if (!claimsData?.claims) {
    // First visit from this browser (or an expired/cleared session):
    // give it a fresh anonymous identity. signInAnonymously() persists
    // the new session through the cookies methods above, so it rides
    // along on this response.
    const { error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.error('Anonymous sign-in failed:', error.message)
    }
  }

  return response
}