const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export function createContentSecurityPolicy(nonce: string): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self'",
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com https://va.vercel-scripts.com`,
    "script-src-attr 'none'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://vitals.vercel-insights.com",
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "block-all-mixed-content",
    ...(IS_PRODUCTION ? ['upgrade-insecure-requests'] : []),
  ]
  return directives.join('; ')
}

export function applySecurityHeaders(headers: Headers, nonce: string) {
  headers.set('Content-Security-Policy', createContentSecurityPolicy(nonce))
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set(
    'Permissions-Policy',
    'accelerometer=(), camera=(self), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()',
  )
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  if (IS_PRODUCTION) {
    headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }
}