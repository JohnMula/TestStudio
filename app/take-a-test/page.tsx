'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, KeyRound, Loader2, QrCode } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { QrScanDialog } from '@/components/qr-scan-dialog'
import { getPublicTestByCode } from '@/lib/actions'

export default function TakeATestPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanOpen, setScanOpen] = useState(false)

  async function goToTest(rawCode: string) {
    const trimmed = rawCode.trim()
    if (!trimmed) {
      setError('Enter a test code to continue.')
      return
    }
    setChecking(true)
    setError(null)
    try {
      const test = await getPublicTestByCode(trimmed)
      if (!test) {
        setError(
          `We couldn't find a test with the code "${trimmed.toUpperCase()}". Double-check and try again.`,
        )
        setChecking(false)
        return
      }
      router.push(`/take/${encodeURIComponent(test.code)}`)
    } catch {
      setError('Something went wrong looking up that code. Please try again.')
      setChecking(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    goToTest(code)
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        maxWidth="max-w-2xl"
        right={
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Home
          </Link>
        }
      />

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-[12px] bg-accent text-accent-foreground">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Take a test
          </h1>
          <p className="max-w-xs text-sm text-muted-foreground text-pretty">
            Enter a code or scan a QR code to jump right in. No account
            needed.
          </p>
        </div>

        <section className="flex flex-col gap-5 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Test code
              </span>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="AB3F-9K"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="rounded-[10px] border border-border bg-background px-3 py-2 font-mono text-sm uppercase text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <button
              type="submit"
              disabled={checking}
              className="flex items-center justify-center gap-2 rounded-[12px] bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checking ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Checking…
                </>
              ) : (
                <>
                  Take the Test
                  <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3" aria-hidden>
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="flex items-center justify-center gap-2 rounded-[12px] border border-border bg-card px-6 py-3 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
          >
            <QrCode className="size-4 text-primary" aria-hidden />
            Scan QR Code
          </button>
        </section>
      </main>

      <QrScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onSuccess={(scannedCode) => {
          setScanOpen(false)
          setCode(scannedCode)
          router.push(`/take/${encodeURIComponent(scannedCode)}`)
        }}
      />
    </div>
  )
}