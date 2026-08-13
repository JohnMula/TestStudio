'use client'

import { useEffect } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-2xl justify-center px-4 py-16 sm:px-6 sm:py-24">
        <section className="flex w-full max-w-lg flex-col items-center gap-5 rounded-[16px] border border-border bg-card p-6 text-center shadow-soft sm:p-10">
          <span className="flex size-12 items-center justify-center rounded-[12px] bg-accent text-accent-foreground">
            <TriangleAlert className="size-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">Try again. If the problem continues, return to the dashboard and try once more.</p>
          </div>
          <button type="button" onClick={reset} className="flex items-center gap-2 rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"><RefreshCw className="size-4" aria-hidden />Try again</button>
        </section>
      </main>
    </div>
  )
}
