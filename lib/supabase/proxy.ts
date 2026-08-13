import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/* ============================================================
   Runs on (almost) every request via the root proxy.ts.

   OAuth sign-in is supported alongside the app's existing anonymous mode.
   Every browser keeps a persistent Supabase Auth session in a cookie. Visitors receive an
   anonymous session; Google/Facebook sign-in replaces it with an
   authenticated session. Either session supplies auth.uid() for the
   existing "tests_*" / "responses_*" RLS ownership policies.
   ============================================================ */

export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  let response = NextResponse.next({ request: { headers: requestHeaders } })

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
          response = NextResponse.next({ request: { headers: requestHeaders } })
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
