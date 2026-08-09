'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

export function LandingNav() {
  const [open, setOpen] = useState(false)

  // lock scroll while the mobile menu is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      {/* desktop nav */}
      <nav className="hidden items-center gap-6 sm:flex">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Settings
        </Link>
        <Link
          href="/dashboard"
          className="rounded-[12px] border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
        >
          Dashboard
        </Link>
      </nav>

      {/* mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex size-10 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-secondary sm:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {/* mobile menu overlay */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-heading text-base font-semibold tracking-tight text-foreground">
              TestStudio
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="inline-flex size-10 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-secondary"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <nav className="flex flex-col gap-2 px-4 py-4">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="rounded-[12px] border border-border bg-card px-4 py-3 text-base font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
            >
              Settings
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="rounded-[12px] bg-primary px-4 py-3 text-base font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
            >
              Dashboard
            </Link>
            <Link
              href="/create"
              onClick={() => setOpen(false)}
              className="rounded-[12px] border border-border bg-card px-4 py-3 text-base font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
            >
              Create a test
            </Link>
          </nav>
        </div>
      ) : null}
    </>
  )
}
