'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SettingsView } from '@/components/settings-view'

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        maxWidth="max-w-2xl"
        right={
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Dashboard
          </Link>
        }
      />

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Defaults for new tests, and export preferences, saved to this
            browser.
          </p>
        </div>

        <SettingsView />
      </main>
    </div>
  )
}