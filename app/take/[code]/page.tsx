'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Trophy, ArrowRight, Clock, Lock, Loader2 } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { QuestionTaker } from '@/components/question-taker'
import { getPublicTestByCode, submitResponse } from '@/lib/actions'
import { possiblePointsPublic } from '@/lib/store'

type Stage = 'intro' | 'quiz' | 'result'

type Result = {
  autoEarned: number
  autoPossible: number
  needsGrading: boolean
}

export default function TakeTestPage() {
  const params = useParams<{ code: string }>()
  const code = decodeURIComponent(params.code)

  const { data: test, isLoading } = useSWR(['public-test', code], () =>
    getPublicTestByCode(code),
  )

  const [stage, setStage] = useState<Stage>('intro')
  const [name, setName] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // shuffle order once, if enabled
  const order = useMemo(() => {
    if (!test) return []
    const idx = test.questions.map((_, i) => i)
    if (!test.shuffle) return idx
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return idx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test?.id])

  if (isLoading) {
    return (
      <Shell code={code.toUpperCase()}>
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden />
          <p className="text-sm">Loading test…</p>
        </div>
      </Shell>
    )
  }

  if (!test) {
    return (
      <Shell code={code.toUpperCase()}>
        <NotFound code={code} />
      </Shell>
    )
  }

  const now = Date.now()
  const notYetOpen = test.opensAt ? now < test.opensAt : false
  const closed = test.closesAt ? now > test.closesAt : false

  if (notYetOpen || closed) {
    return (
      <Shell code={test.code}>
        <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-[16px] border border-border bg-card p-6 text-center shadow-soft sm:p-10">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            {notYetOpen ? (
              <Clock className="size-6" aria-hidden />
            ) : (
              <Lock className="size-6" aria-hidden />
            )}
          </span>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {notYetOpen ? 'This test hasn’t opened yet' : 'This test is closed'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {notYetOpen
              ? `Opens ${new Date(test.opensAt!).toLocaleString()}.`
              : `Closed ${new Date(test.closesAt!).toLocaleString()}.`}
          </p>
        </section>
        <SiteFooter />
      </Shell>
    )
  }

  const orderedQuestions = order.map((i) => test.questions[i])
  const total = possiblePointsPublic(test)
  const answeredCount = orderedQuestions.filter(
    (q) => answers[q.id] !== undefined,
  ).length

  async function submit() {
    if (!test || submitting) return
    setSubmitting(true)
    setError(null)
    const res = await submitResponse(test.id, answers, name)
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setResult({
      autoEarned: res.autoEarned,
      autoPossible: res.autoPossible,
      needsGrading: res.needsGrading,
    })
    setStage('result')
    window.scrollTo({ top: 0 })
  }

  return (
    <Shell code={test.code}>
      {stage === 'intro' ? (
        <section className="flex flex-col gap-6 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:p-8">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Test ticket
            </span>
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground text-balance sm:text-2xl">
              {test.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {orderedQuestions.length}{' '}
              {orderedQuestions.length === 1 ? 'question' : 'questions'} · {total}{' '}
              {total === 1 ? 'point' : 'points'} · Time limit {test.timeLimit} ·
              No account needed.
            </p>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Your name <span className="text-muted-foreground">(optional)</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leave blank to stay anonymous"
              className="rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <button
            type="button"
            onClick={() => setStage('quiz')}
            className="flex items-center justify-center gap-2 rounded-[12px] bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
          >
            Start test
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </section>
      ) : null}

      {stage === 'quiz' ? (
        <section className="flex flex-col gap-6">
          <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>
                {answeredCount} / {orderedQuestions.length} answered
              </span>
              <span>{total} pts</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${(answeredCount / Math.max(1, orderedQuestions.length)) * 100}%`,
                }}
              />
            </div>
          </div>

          {orderedQuestions.map((q, i) => (
            <QuestionTaker
              key={q.id}
              question={q}
              index={i}
              answer={answers[q.id]}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            />
          ))}

          {error ? (
            <p className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-end sm:py-3"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              <>
                Submit test
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>
        </section>
      ) : null}

      {stage === 'result' && result ? (
        <section className="flex flex-col items-center gap-6 rounded-[16px] border border-border bg-card p-6 text-center shadow-soft sm:p-10">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
            <Trophy className="size-7" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              You scored {result.autoEarned}/{result.autoPossible}
            </h1>
            <p className="text-sm text-muted-foreground">
              {result.autoPossible > 0
                ? `${Math.round((result.autoEarned / result.autoPossible) * 100)}% on the auto-graded questions.`
                : 'Your response has been recorded.'}
            </p>
            {result.needsGrading ? (
              <p className="mt-1 text-sm text-[var(--color-amber)]">
                Some open-ended answers will be graded by hand — your final
                score may go up.
              </p>
            ) : null}
          </div>
          <Link
            href="/dashboard"
            className="rounded-[12px] border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
          >
            Back to dashboard
          </Link>
        </section>
      ) : null}

      <SiteFooter />
    </Shell>
  )
}

function Shell({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        maxWidth="max-w-2xl"
        right={
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            {code}
          </span>
        }
      />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  )
}

function NotFound({ code }: { code: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <h1 className="font-heading text-xl font-semibold text-foreground">
        No test found for <span className="font-mono">{code.toUpperCase()}</span>
      </h1>
      <p className="text-sm text-muted-foreground">
        Double-check the code and try again.
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

function SiteFooter() {
  return (
    <p className="mt-8 text-center text-xs text-muted-foreground">
      Made with{' '}
      <Link href="/" className="font-medium text-foreground hover:underline">
        TestStudio
      </Link>
    </p>
  )
}
