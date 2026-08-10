import 'server-only'
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/* ============================================================
   Two server-only Supabase clients.

   - createServiceClient(): the service-role key, bypasses RLS.
     Reserved for the handful of actions that are intentionally
     public/unscoped — getPublicTestByCode() and submitResponse()
     (taking a test never requires an account), plus gradeEssay().
     These already strip anything sensitive (answer keys, etc.)
     before returning data to the browser.

   - createClient(): the anon/publishable key, bound to whatever
     cookie session the current request is carrying. proxy.ts (see
     the project root) makes sure every browser has a persistent
     anonymous auth session before this ever runs, so auth.uid()
     resolves inside RLS policies. Use this for anything that
     should be scoped to "whichever browser is asking" — ownership
     is enforced by the "tests_*" / "responses_*" RLS policies (see
     the SQL migration), not by application code.
   ============================================================ */

let serviceClient: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    )
  }
  serviceClient = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return serviceClient
}

export async function createClient(): Promise<SupabaseClient> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: missing SUPABASE_URL or SUPABASE_ANON_KEY.',
    )
  }

  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Called from a Server Component render, which can't set
          // cookies. Safe to ignore — proxy.ts refreshes the session
          // cookie on every request, and every read/write this app
          // does goes through a Server Action anyway, which CAN set
          // cookies.
        }
      },
    },
  })
}