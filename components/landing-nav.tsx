'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Menu, Settings, X } from 'lucide-react'
import { AuthMenu } from '@/components/auth-menu'

export function LandingNav() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // close the dropdown on outside click or Escape
  useEffect(() => {
    if (!open) return
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
  }, [open])

  return (
    <>
      {/* desktop nav */}
      <nav className="hidden items-center gap-3 sm:flex">
        <Link
          href="/dashboard"
          className="rounded-[12px] border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
        >
          Dashboard
        </Link>
        <AuthMenu />
        <Link
          href="/settings"
          aria-label="Settings"
          className="inline-flex size-9 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-secondary"
        >
          <Settings className="size-4" aria-hidden />
        </Link>
      </nav>

      {/* mobile hamburger + dropdown */}
      <div ref={menuRef} className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex size-10 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-secondary"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>

        {open ? (
          <div
            role="menu"
            aria-label="Menu"
            className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[16px] border border-border bg-card p-3 shadow-soft-lg"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-[12px] bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
                >
                  Dashboard
                </Link>
                <AuthMenu />
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  aria-label="Settings"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background text-foreground shadow-soft transition-colors hover:bg-secondary"
                >
                  <Settings className="size-4" aria-hidden />
                </Link>
              </div>
              <Link
                href="/create"
                onClick={() => setOpen(false)}
                className="rounded-[12px] border border-border bg-background px-4 py-2.5 text-center text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
              >
                Create a test
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}