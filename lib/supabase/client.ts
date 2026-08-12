'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

/**
 * The browser-side Supabase client used exclusively for the public OAuth
 * exchange and session UI. Auth cookies are shared with the server client so
 * server actions continue to receive the current session and RLS context.
 */
export function createClient(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('Authentication is not configured.')
  }

  client = createBrowserClient(url, key)
  return client
}
