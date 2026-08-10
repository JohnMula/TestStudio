'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { SettingsView } from '@/components/settings-view'

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-6 sm:px-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight text-foreground"
        >
          <Image
            src="/logo/t.png"
            alt="TestStudio logo"
            width={26}
            height={26}
            priority
            className="rounded-[22%]"
          />
          TestStudio
        </Link>
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