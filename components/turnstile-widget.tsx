'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        },
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

/* Verification widget shown before a test can be submitted. Renders
   nothing — and reports an empty (accepted) token once on mount — if
   NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, so the submit flow keeps
   working exactly as before until it's configured. See lib/turnstile.ts
   for the matching server-side behavior. */
export function TurnstileWidget({
  onVerify,
}: {
  onVerify: (token: string) => void
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!siteKey) {
      onVerify('')
      return
    }
    let cancelled = false
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onVerify(token),
          'expired-callback': () => onVerify(''),
          'error-callback': () => {
            setFailed(true)
            onVerify('')
          },
        })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  if (!siteKey) {
    return process.env.NODE_ENV === 'production' ? (
      <p className="text-xs text-destructive">
        Verification is unavailable. Please contact the test owner.
      </p>
    ) : null
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={containerRef} />
      {failed ? (
        <p className="text-xs text-destructive">
          Verification widget failed to load. Please refresh and try again.
        </p>
      ) : null}
    </div>
  )
}
