'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import type { Provider, SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { LoginSkeleton } from '@/components/skeletons/login-skeleton'
import { createClient } from '@/lib/supabase/client'

type AuthProvider = Extract<Provider, 'google' | 'facebook'>

function safeDestination(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/dashboard'
  }
  return value
}

function messageFor(error: string | null): string | null {
  switch (error) {
    case 'oauth':
      return 'We could not complete that sign-in. Please try again.'
    case 'callback':
      return 'Your sign-in link expired or could not be verified. Please try again.'
    case 'config':
      return 'Sign-in is not configured yet. Please contact the site administrator.'
    default:
      return null
  }
}

async function shouldLinkAnonymousIdentity(
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user.is_anonymous) return false

  // The existing test table is already RLS-scoped to auth.uid(), so this only
  // checks whether this browser's anonymous identity has content to preserve.
  const { data, error } = await supabase.from('tests').select('id').limit(1)
  if (!error && (data?.length ?? 0) > 0) return true

  try {
    return Boolean(window.localStorage.getItem('teststudio.draft.v2'))
  } catch {
    return false
  }
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const destination = safeDestination(searchParams.get('next'))
  const [provider, setProvider] = useState<AuthProvider | null>(null)
  const [error, setError] = useState<string | null>(messageFor(searchParams.get('error')))

  useEffect(() => {
    let active = true
    try {
      const supabase = createClient()
      void supabase.auth.getSession().then(({ data }) => {
        if (active && data.session?.user && !data.session.user.is_anonymous) {
          router.replace(destination)
        }
      })
    } catch {
      // The normal configuration error is shown when the user starts sign-in.
    }
    return () => {
      active = false
    }
  }, [destination, router])

  async function signInWith(providerName: AuthProvider) {
    setProvider(providerName)
    setError(null)
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`
      const supabase = createClient()
      const credentials = {
        provider: providerName,
        options: { redirectTo, skipBrowserRedirect: true },
      }
      const preserveAnonymousWork = await shouldLinkAnonymousIdentity(supabase)
      const { data, error: signInError } = preserveAnonymousWork
        ? await supabase.auth.linkIdentity(credentials)
        : await supabase.auth.signInWithOAuth(credentials)
      if (signInError) {
        if (preserveAnonymousWork) {
          setError(
            'We could not safely link this browser’s existing work. Enable Manual Identity Linking in Supabase, then try again.',
          )
          setProvider(null)
          return
        }
        throw signInError
      }
      if (!data.url) throw new Error('No sign-in URL was returned.')
      window.location.assign(data.url)
    } catch (authError) {
      setProvider(null)
      setError(
        authError instanceof Error && authError.message === 'Authentication is not configured.'
          ? 'Sign-in is not configured yet. Please contact the site administrator.'
          : 'We could not start that sign-in. Please try again.',
      )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        maxWidth="max-w-3xl"
        right={
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Home
          </Link>
        }
      />

      <main className="mx-auto flex max-w-3xl justify-center px-4 py-10 sm:px-6 sm:py-16">
        <section className="flex w-full max-w-md flex-col gap-6 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-[12px] bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Welcome to TestStudio
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              Sign in to access your TestStudio account across your devices.
            </p>
          </div>

          {error ? (
            <p role="alert" className="rounded-[10px] border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void signInWith('google')}
              disabled={provider !== null}
              className="flex w-full items-center justify-center gap-3 rounded-[12px] border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-card font-heading text-xs font-semibold text-foreground shadow-soft" aria-hidden>
                G
              </span>
              {provider === 'google' ? 'Connecting to Google…' : 'Continue with Google'}
            </button>
            <button
              type="button"
              onClick={() => void signInWith('facebook')}
              disabled={provider !== null}
              className="flex w-full items-center justify-center gap-3 rounded-[12px] border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-card font-heading text-sm font-semibold text-foreground shadow-soft" aria-hidden>
                f
              </span>
              {provider === 'facebook' ? 'Connecting to Facebook…' : 'Continue with Facebook'}
            </button>
          </div>

          <p className="text-center text-xs leading-relaxed text-muted-foreground text-pretty">
            Test-takers can still take a test with a code without signing in.
          </p>
        </section>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
