'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  Users,
  ExternalLink,
  CopyPlus,
  Download,
  ChevronDown,
  Calendar,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { TicketCard } from '@/components/ticket-card'
import { TestQrCode } from '@/components/test-qr-code'
import {
  useTest,
  deleteTest,
  duplicateTest,
  gradeEssay,
  possiblePoints,
  responseEarned,
  type Response,
  type Test,
} from '@/lib/store'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv(test: Test) {
  const possible = possiblePoints(test)
  const rows = [
    ['Name', 'Submitted', 'Earned', 'Possible', 'Percent', 'Needs grading'],
    ...test.responses.map((r) => {
      const earned = responseEarned(test, r)
      return [
        r.takerName,
        new Date(r.submittedAt).toISOString(),
        String(earned),
        String(possible),
        possible ? `${Math.round((earned / possible) * 100)}%` : '0%',
        r.needsGrading ? 'yes' : 'no',
      ]
    }),
  ]
  const csv = rows
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  download(`${test.title.replace(/\s+/g, '-')}-results.csv`, csv, 'text/csv')
}

function TestDetail() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const test = useTest(params.id)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const justCreated = search.get('created') === '1'

  if (!test) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          Test not found
        </h1>
        <p className="text-sm text-muted-foreground">
          This test may have been deleted.
        </p>
        <Link
          href="/dashboard"
          className="rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>
    )
  }

  const possible = possiblePoints(test)
  const pendingCount = test.responses.filter((r) => r.needsGrading).length
  const avgScore =
    test.responses.length > 0 && possible > 0
      ? Math.round(
          (test.responses.reduce((s, r) => s + responseEarned(test, r), 0) /
            (test.responses.length * possible)) *
            100,
        )
      : null

  function copyCode() {
    navigator.clipboard?.writeText(test!.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  async function handleDelete() {
    await deleteTest(test!.id)
    router.push('/dashboard')
  }

  async function handleDuplicate() {
    const copy = await duplicateTest(test!.id)
    if (copy) router.push(`/test/${copy.id}`)
  }

  const essays = test.questions.filter((q) => q.type === 'essay')

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {justCreated ? (
        <div className="mb-6 flex items-center gap-2 rounded-[12px] border border-primary/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <Check className="size-4 text-primary" aria-hidden />
          Test published. Share the code below — no account needed to take it.
        </div>
      ) : null}

      <div className="mb-8 flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground text-balance sm:text-2xl">
          {test.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {test.questions.length}{' '}
          {test.questions.length === 1 ? 'question' : 'questions'} · {possible}{' '}
          {possible === 1 ? 'point' : 'points'} · Time limit {test.timeLimit} ·
          Shuffle {test.shuffle ? 'on' : 'off'}
        </p>
        {test.opensAt || test.closesAt ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5 text-primary" aria-hidden />
            {test.opensAt ? `Opens ${new Date(test.opensAt).toLocaleString()}` : 'Open now'}
            {test.closesAt ? ` · Closes ${new Date(test.closesAt).toLocaleString()}` : ''}
          </p>
        ) : null}
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-6">
          {/* share row */}
          <section className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-6">
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Share
            </span>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={copyCode}
                    className="flex items-center gap-2 rounded-[10px] border border-border bg-background px-4 py-2 font-mono text-lg text-foreground transition-colors hover:bg-secondary"
                  >
                    {test.code}
                    {copied ? (
                      <Check className="size-4 text-primary" aria-hidden />
                    ) : (
                      <Copy className="size-4 text-muted-foreground" aria-hidden />
                    )}
                  </button>
                  <Link
                    href={`/take/${test.code}`}
                    className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Preview as taker
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  {copied ? 'Copied to clipboard.' : 'Anyone with this code can take the test.'}
                </p>
              </div>
              {origin ? (
                <TestQrCode
                  url={`${origin}/take/${test.code}`}
                  filename={`${test.title.replace(/\s+/g, '-')}-qr.png`}
                />
              ) : null}
            </div>
          </section>

          {/* responses */}
          <section className="flex flex-col rounded-[16px] border border-border bg-card shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-6 sm:px-6">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Responses
                {pendingCount > 0 ? (
                  <span className="ml-2 rounded-full bg-[var(--color-amber)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-amber)]">
                    {pendingCount} to grade
                  </span>
                ) : null}
              </h2>
              <div className="flex items-center gap-3">
                {avgScore !== null ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    avg {avgScore}%
                  </span>
                ) : null}
                {test.responses.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => exportCsv(test)}
                    className="flex items-center gap-1.5 rounded-[8px] border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    <Download className="size-3.5" aria-hidden />
                    Export CSV
                  </button>
                ) : null}
              </div>
            </div>
            {test.responses.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <Users className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  No responses yet. Share the code to start collecting.
                </p>
              </div>
            ) : (
              <ul>
                {test.responses.map((r) => (
                  <ResponseRow
                    key={r.id}
                    test={test}
                    response={r}
                    possible={possible}
                    expanded={expanded === r.id}
                    onToggle={() =>
                      setExpanded((cur) => (cur === r.id ? null : r.id))
                    }
                    hasEssays={essays.length > 0}
                  />
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleDuplicate}
              className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
            >
              <CopyPlus className="size-4 text-primary" aria-hidden />
              Duplicate test
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              Delete test
            </button>
          </div>
        </div>

        <div className="md:w-80">
          <TicketCard
            title={test.title}
            questionCount={test.questions.length}
            timeLimit={test.timeLimit === 'Off' ? 'No limit' : test.timeLimit}
            code={test.code}
          />
        </div>
      </div>
    </main>
  )
}

function ResponseRow({
  test,
  response,
  possible,
  expanded,
  onToggle,
  hasEssays,
}: {
  test: Test
  response: Response
  possible: number
  expanded: boolean
  onToggle: () => void
  hasEssays: boolean
}) {
  const earned = responseEarned(test, response)
  const essays = test.questions.filter((q) => q.type === 'essay')

  return (
    <li className="border-t border-border">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm text-foreground">
            {response.takerName || 'Anonymous'}
          </span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(response.submittedAt)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {response.needsGrading ? (
            <span className="rounded-full bg-[var(--color-amber)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-amber)]">
              needs grading
            </span>
          ) : null}
          <span className="font-mono text-sm text-foreground">
            {earned}/{possible}
          </span>
          {hasEssays ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={expanded ? 'Collapse' : 'Grade open answers'}
              aria-expanded={expanded}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronDown
                className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
      </div>

      {expanded && hasEssays ? (
        <div className="flex flex-col gap-4 bg-secondary/40 px-4 py-4 sm:px-6">
          {essays.map((q) => {
            const text = response.answers[q.id]
            const awarded = response.manualScores[q.id]
            return (
              <div key={q.id} className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  {q.prompt || 'Open response'}
                </span>
                <p className="whitespace-pre-wrap rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-foreground">
                  {typeof text === 'string' && text.trim()
                    ? text
                    : '— no answer —'}
                </p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Award
                    <input
                      type="number"
                      min={0}
                      max={q.points}
                      value={awarded ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        gradeEssay(
                          test.id,
                          response.id,
                          q.id,
                          Math.max(
                            0,
                            Math.min(q.points, Number(e.target.value) || 0),
                          ),
                        )
                      }
                      className="w-16 rounded-[8px] border border-border bg-background px-2 py-1 font-mono text-sm text-foreground outline-none focus:border-primary"
                    />
                    / {q.points} pts
                  </label>
                  {awarded !== undefined ? (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <Check className="size-3.5" aria-hidden />
                      graded
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </li>
  )
}

export default function TestDetailPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        maxWidth="max-w-4xl"
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
      <Suspense fallback={null}>
        <TestDetail />
      </Suspense>
    </div>
  )
}