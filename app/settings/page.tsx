import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SettingsView } from '@/components/settings-view'

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-6 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
        <span className="font-heading text-base font-semibold tracking-tight text-foreground">
          TestStudio
        </span>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your account and the defaults for new tests.
          </p>
        </div>

        <SettingsView />
      </main>
    </div>
  )
}
