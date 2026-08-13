import Link from 'next/link'
import { Compass } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-2xl justify-center px-4 py-16 sm:px-6 sm:py-24">
        <section className="flex w-full max-w-lg flex-col items-center gap-5 rounded-[16px] border border-border bg-card p-6 text-center shadow-soft sm:p-10">
          <span className="flex size-12 items-center justify-center rounded-[12px] bg-accent text-accent-foreground">
            <Compass className="size-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">404</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">That page isn&apos;t here</h1>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">The link may be outdated, or the page may have moved.</p>
          </div>
          <Link href="/" className="rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90">Go home</Link>
        </section>
      </main>
    </div>
  )
}
