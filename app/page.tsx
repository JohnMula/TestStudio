import Image from 'next/image'
import Link from 'next/link'
import { KeyRound, Infinity as InfinityIcon, Download } from 'lucide-react'
import { TicketCard } from '@/components/ticket-card'
import { LandingNav } from '@/components/landing-nav'

const features = [
  {
    icon: KeyRound,
    title: 'No login for test-takers',
    body: 'Share a code or link. Anyone can start immediately — no account, no email, no friction.',
  },
  {
    icon: InfinityIcon,
    title: 'Unlimited questions & responses',
    body: 'Build tests as long as you need and collect as many responses as come in. No caps, no paywalls.',
  },
  {
    icon: Download,
    title: 'Free result exports',
    body: 'Download scores and response data whenever you want. Your results are always yours to keep.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg"
        >
          <Image
            src="/logo/t.png"
            alt="TestStudio logo"
            width={28}
            height={28}
            priority
            className="rounded-[22%]"
          />
          TestStudio
        </Link>
        <LandingNav />
      </header>

      {/* hero */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-24">
          <div className="flex flex-col items-start gap-5 sm:gap-6">
            <span className="rounded-full border border-border bg-card px-3 py-1 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground shadow-soft">
              Free test maker
            </span>
            <h1 className="font-heading text-4xl font-bold leading-[1.08] tracking-tight text-foreground text-balance sm:text-5xl md:text-6xl">
              Make a test. Share a code. That&apos;s it.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              Free, unlimited tests. No account needed to take one.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/create"
                className="rounded-[12px] bg-primary px-6 py-3 text-center text-base font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
              >
                Create your first test
              </Link>
              <Link
                href="/take-a-test"
                className="rounded-[12px] bg-primary px-6 py-3 text-center text-base font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
              >
                Take a Test
              </Link>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <TicketCard />
          </div>
        </section>

        {/* features */}
        <section className="grid gap-6 pb-16 sm:grid-cols-2 sm:pb-24 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-6 shadow-soft"
            >
              <span className="flex size-11 items-center justify-center rounded-[12px] bg-accent text-accent-foreground">
                <feature.icon className="size-5" aria-hidden />
              </span>
              <h2 className="font-heading text-lg font-semibold leading-snug text-foreground">
                {feature.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                {feature.body}
              </p>
            </article>
          ))}
        </section>
      </main>

      {/* footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-center text-sm text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
          <span className="font-heading font-semibold text-foreground">
            TestStudio
          </span>
          <span>Free, unlimited tests. No account needed to take one.</span>
        </div>
      </footer>
    </div>
  )
}