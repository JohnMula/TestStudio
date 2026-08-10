'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, Settings, X } from 'lucide-react'

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
      <nav className="hidden items-center gap-3 sm:flex">
        <Link
          href="/dashboard"
          className="rounded-[12px] border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
        >
          Dashboard
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          className="inline-flex size-9 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-secondary"
        >
          <Settings className="size-4" aria-hidden />
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
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight text-foreground"
            >
              <Image
                src="/logo/t.png"
                alt="TestStudio logo"
                width={26}
                height={26}
                className="rounded-[22%]"
              />
              TestStudio
            </Link>
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
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-[12px] bg-primary px-4 py-3 text-center text-base font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                aria-label="Settings"
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-secondary"
              >
                <Settings className="size-5" aria-hidden />
              </Link>
            </div>
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