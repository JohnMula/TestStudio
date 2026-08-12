import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function safeDestination(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/dashboard'
  }
  return value
}

function loginRedirect(request: NextRequest, error: 'oauth' | 'callback' | 'config') {
  const url = new URL('/login', request.url)
  url.searchParams.set('error', error)
  const next = safeDestination(request.nextUrl.searchParams.get('next'))
  if (next !== '/dashboard') url.searchParams.set('next', next)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('error')) {
    return loginRedirect(request, 'oauth')
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) return loginRedirect(request, 'callback')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return loginRedirect(request, 'config')

  const destination = safeDestination(request.nextUrl.searchParams.get('next'))
  const response = NextResponse.redirect(new URL(destination, request.url))
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return loginRedirect(request, 'callback')

  return response
}
