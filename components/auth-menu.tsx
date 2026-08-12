'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ChevronDown, CircleUserRound, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function isSignedIn(user: User | null): user is User {
  return Boolean(user && !user.is_anonymous)
}

function displayName(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown>
  const name = metadata.full_name ?? metadata.name
  return typeof name === 'string' && name.trim()
    ? name.trim()
    : user.email ?? 'Signed-in user'
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words[0]?.[0] ?? 'U') + (words[1]?.[0] ?? '')
}

export function AuthMenu() {
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined

    try {
      const supabase = createClient()
      void supabase.auth.getSession().then(({ data }) => {
        if (active) {
          setUser(data.session?.user ?? null)
          setLoading(false)
        }
      })
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) {
          setUser(session?.user ?? null)
          setLoading(false)
        }
      })
      unsubscribe = () => data.subscription.unsubscribe()
    } catch {
      if (active) setLoading(false)
    }

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    setError(null)
    try {
      const { error: signOutError } = await createClient().auth.signOut()
      if (signOutError) throw signOutError
      setOpen(false)
      router.push('/')
      router.refresh()
    } catch {
      setError('Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  if (loading) {
    return <span className="size-8 animate-pulse rounded-full bg-secondary" aria-label="Loading account" />
  }

  if (!isSignedIn(user)) {
    return (
      <Link
        href="/login"
        className="rounded-[10px] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
      >
        Sign in
      </Link>
    )
  }

  const name = displayName(user)
  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setError(null)
          setOpen((current) => !current)
        }}
        className="flex max-w-40 items-center gap-2 rounded-[10px] border border-border bg-card px-2 py-1.5 text-sm text-foreground shadow-soft transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-semibold text-accent-foreground">
          {initials(name)}
        </span>
        <span className="hidden truncate sm:block">{name}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 z-30 mt-2 w-56 rounded-[12px] border border-border bg-card p-2 shadow-soft-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-2 py-2.5">
            <CircleUserRound className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              {user.email ? (
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              ) : null}
            </span>
          </div>
          {error ? <p className="px-2 pb-1 pt-2 text-xs text-destructive">{error}</p> : null}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-1 flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="size-3.5" aria-hidden />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
