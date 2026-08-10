import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function SiteHeader({
  right,
  maxWidth = 'max-w-6xl',
}: {
  right?: ReactNode
  maxWidth?: string
}) {
  return (
    <header className="border-b border-border">
      <div
        className={`mx-auto flex ${maxWidth} items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5`}
      >
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
        <nav className="flex items-center gap-3 sm:gap-5">{right}</nav>
      </div>
    </header>
  )
}