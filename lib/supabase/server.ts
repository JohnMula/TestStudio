import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/* ============================================================
   Server-only Supabase client.

   There are no user accounts in this app, so all data access
   happens on the server with the service-role key. The `tests`
   and `responses` tables have RLS enabled with no public
   policies, which means the anon/browser client can never read
   them — answer keys and raw responses stay on the server and
   are only exposed through the vetted server actions.
   ============================================================ */

let client: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    )
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
