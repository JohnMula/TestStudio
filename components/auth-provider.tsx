'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export function isSignedIn(user: User | null): user is User {
  return Boolean(user && !user.is_anonymous)
}

type AuthState = {
  user: User | null
  loading: boolean
  // Best guess at whether the eventual answer will be "signed in", based on
  // the last resolved state on this browser. Used only to pick which
  // skeleton shape the account widget shows while `loading` is true —
  // starts false so server-rendered and first-client-render markup match
  // (no hydration mismatch), then is corrected client-side as soon as we
  // have a real hint, and again as soon as we have the real answer.
  expectSignedIn: boolean
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  expectSignedIn: false,
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

const AUTH_HINT_KEY = 'ts-auth-hint'

function readAuthHint(): boolean {
  try {
    return window.localStorage.getItem(AUTH_HINT_KEY) === 'in'
  } catch {
    return false
  }
}

function writeAuthHint(signedIn: boolean) {
  try {
    window.localStorage.setItem(AUTH_HINT_KEY, signedIn ? 'in' : 'out')
  } catch {
    // ignore — private browsing, full storage quota, etc.
  }
}

// Once the Supabase client already has a session in memory, checking it
// resolves in a couple of milliseconds — too fast for a skeleton to be
// visibly shown, even though every page is built assuming one will be.
// Holding the loading state up for at least this long is what makes every
// page's skeleton (including the account widget in the header) resolve
// together, instead of the account widget popping in slightly before or
// after the rest of the page. It never adds latency beyond what a slow
// check would already take on its own — a check that takes longer than
// this just resolves as soon as it's ready.
const MIN_LOADING_MS = 400

/**
 * Resolves the current Supabase session exactly once for the whole app —
 * mounted in the root layout, so it survives client-side navigation between
 * pages instead of redoing the check on every remount — and shares the
 * result everywhere it's needed. A single shared loading state, checked
 * once, is what keeps the account widget and the rest of any given page
 * loading together instead of resolving on their own independent
 * schedules.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    expectSignedIn: false,
  })

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined

    // committed: the initial loading state has been swapped for the real
    // answer once already. haveAnswer/latestUser: the most recent thing
    // Supabase told us, which may arrive before the minimum timer below is
    // done.
    let committed = false
    let minTimerDone = false
    let haveAnswer = false
    let latestUser: User | null = null

    function commitNow() {
      if (!active) return
      committed = true
      const signedIn = isSignedIn(latestUser)
      writeAuthHint(signedIn)
      setState({ user: latestUser, loading: false, expectSignedIn: signedIn })
    }

    // getSession() and the initial onAuthStateChange event both fire for
    // the same startup check (in either order), so this can be called more
    // than once before anything is committed — harmless, since only the
    // first commit matters. A change that arrives after that first commit
    // is a genuine later event (signed in/out, session refreshed) and is
    // applied immediately, with no artificial delay.
    function onAnswer(nextUser: User | null) {
      latestUser = nextUser
      haveAnswer = true
      if (committed) {
        commitNow()
        return
      }
      if (minTimerDone) commitNow()
    }

    const minTimer = setTimeout(() => {
      minTimerDone = true
      if (haveAnswer && !committed) commitNow()
    }, MIN_LOADING_MS)

    if (readAuthHint()) {
      setState((current) => ({ ...current, expectSignedIn: true }))
    }

    try {
      const supabase = createClient()
      void supabase.auth.getSession().then(({ data }) => {
        onAnswer(data.session?.user ?? null)
      })
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        onAnswer(session?.user ?? null)
      })
      unsubscribe = () => data.subscription.unsubscribe()
    } catch {
      onAnswer(null)
    }

    return () => {
      active = false
      unsubscribe?.()
      clearTimeout(minTimer)
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
