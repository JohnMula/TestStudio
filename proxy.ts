import { type NextRequest } from 'next/server'
import {
  applySecurityHeaders,
  createContentSecurityPolicy,
} from '@/lib/security-headers'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const requestHeaders = new Headers(request.headers)
  // Next reads the request CSP to attach the nonce to framework scripts.
  // The nonce is per response, so an injected script cannot reuse a value
  // from a previous page load.
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', createContentSecurityPolicy(nonce))

  const response = await updateSession(request, requestHeaders)
  applySecurityHeaders(response.headers, nonce)
  return response
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets, so any page load or
     * Server Action call can rely on an anonymous session already
     * being present.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
