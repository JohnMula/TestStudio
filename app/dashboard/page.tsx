'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  Plus,
  Users,
  HelpCircle,
  ArrowRight,
  KeyRound,
  Settings,
  Ellipsis,
  Pencil,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { useTests } from '@/lib/store'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const tests = useTests()
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')

  const totalResponses = tests.reduce((sum, t) => sum + t.responses.length, 0)

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = joinCode.trim()
    if (code) router.push(`/take/${encodeURIComponent(code)}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        right={
          <>
            <Link
              href="/create"
              className="flex items-center gap-2 rounded-[12px] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 sm:px-4"
            >
              <Plus className="size-4" aria-hidden />
              New test
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className="inline-flex size-9 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-secondary"
            >
              <Settings className="size-4" aria-hidden />
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Your tests
          </h1>
          <p className="text-sm text-muted-foreground">
            {tests.length} {tests.length === 1 ? 'test' : 'tests'} ·{' '}
            {totalResponses} total {totalResponses === 1 ? 'response' : 'responses'}
          </p>
        </div>

        {/* join a test by code */}
        <form
          onSubmit={handleJoin}
          className="mb-8 flex flex-col gap-3 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="size-4 text-primary" aria-hidden />
            Have a code? Take a test
          </div>
          <div className="flex flex-1 gap-2 sm:justify-end">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="AB3F-9K"
              aria-label="Test code"
              className="w-40 rounded-[10px] border border-border bg-background px-3 py-2 font-mono text-sm uppercase text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              className="rounded-[10px] border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
            >
              Go
            </button>
          </div>
        </form>

        {tests.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[16px] border border-dashed border-border bg-card/50 px-6 py-20 text-center">
            <p className="text-sm text-muted-foreground">
              No tests yet. Create your first one to get a share code.
            </p>
            <Link
              href="/create"
              className="flex items-center gap-2 rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" aria-hidden />
              Create a test
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((test) => (
              <article
                key={test.id}
                className="group flex flex-col gap-5 rounded-[16px] border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-soft-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/test/${test.id}`}
                    className="min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <h2 className="font-heading text-base font-semibold leading-snug text-foreground text-balance">
                      {test.title}
                    </h2>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="rounded-md bg-accent px-2 py-1 font-mono text-xs text-accent-foreground">
                      {test.code}
                    </span>
                    <TestActionsMenu testId={test.id} />
                  </div>
                </div>
                <Link
                  href={`/test/${test.id}`}
                  className="mt-auto flex items-center justify-between rounded-sm text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="size-4" aria-hidden />
                      {test.questions.length}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-4" aria-hidden />
                      {test.responses.length}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function TestActionsMenu({ testId }: { testId: string }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Test actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Ellipsis className="size-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Test actions"
          className="absolute right-0 top-full z-20 mt-1 w-36 rounded-[10px] border border-border bg-card p-1 shadow-soft-lg"
        >
          <Link
            href={`/create?edit=${encodeURIComponent(testId)}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-[7px] px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Pencil className="size-3.5 text-primary" aria-hidden />
            Edit
          </Link>
        </div>
      ) : null}
    </div>
  )
}
