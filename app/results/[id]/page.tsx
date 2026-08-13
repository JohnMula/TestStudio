'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, Clock, RotateCcw, Trophy } from 'lucide-react'
import { ResultQuestionCard } from '@/components/result-question-card'
import { SiteHeader } from '@/components/site-header'
import { ResultsBodySkeleton } from '@/components/skeletons/results-skeleton'
import { getAttempt } from '@/lib/store'

function formatPoints(points: number): string {
  return Number.isInteger(points)
    ? String(points)
    : points.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

export default function AttemptResultPage() {
  const params = useParams<{ id: string }>()
  const { data: attempt, isLoading } = useSWR(
    params.id ? ['attempt', params.id] : null,
    () => getAttempt(params.id),
  )

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        maxWidth="max-w-2xl"
        right={
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            Dashboard
          </Link>
        }
      />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {isLoading ? (
          <ResultsBodySkeleton />
        ) : !attempt ? (
          <div className="flex flex-col items-center gap-4 rounded-[16px] border border-border bg-card px-6 py-20 text-center shadow-soft">
            <h1 className="font-heading text-xl font-semibold text-foreground">Result unavailable</h1>
            <p className="text-sm text-muted-foreground">This result may not belong to your account, or it is no longer available.</p>
            <Link href="/dashboard" className="rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90">Back to dashboard</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <section className="flex flex-col items-center gap-5 rounded-[16px] border border-border bg-card p-6 text-center shadow-soft sm:p-10">
              <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary"><Trophy className="size-7" aria-hidden /></span>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Attempt {attempt.attemptNumber}</span>
                <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{attempt.title}</h1>
                <p className="text-sm text-muted-foreground">Taken {new Date(attempt.submittedAt).toLocaleString()}</p>
              </div>
              <div className="w-full rounded-[12px] border border-border bg-background px-5 py-4">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Your score</span>
                <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{formatPoints(attempt.result.scoreEarned)} <span className="text-lg text-muted-foreground">/ {formatPoints(attempt.result.totalPossible)}</span></p>
                <p className="font-heading text-2xl font-semibold text-primary">{attempt.result.percentage}%</p>
              </div>
              <div className="grid w-full grid-cols-3 divide-x divide-border overflow-hidden rounded-[12px] border border-border bg-background text-left">
                <Metric value={attempt.result.correctCount} label="Correct" className="text-primary" />
                <Metric value={attempt.result.incorrectCount} label="Incorrect" className="text-destructive" />
                <Metric value={attempt.result.manualGradingCount} label="Manual grading" className="text-[var(--color-amber)]" />
              </div>
              {attempt.result.needsGrading ? <p className="flex items-center gap-1.5 text-sm text-[var(--color-amber)]"><Clock className="size-4" aria-hidden />Open responses may change once manually graded.</p> : null}
              {attempt.canRetake && attempt.retakeCode ? <Link href={`/take/${encodeURIComponent(attempt.retakeCode)}`} className="flex items-center gap-2 rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"><RotateCcw className="size-4" aria-hidden />Retake test</Link> : attempt.singleAttempt ? <p className="text-xs text-muted-foreground">Retake unavailable — this test allows one attempt.</p> : null}
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 px-1">
                <h2 className="font-heading text-lg font-semibold text-foreground">Question review</h2>
                <p className="text-sm text-muted-foreground">Your submitted answers are shown against the snapshot of the test you took.</p>
              </div>
              {attempt.result.questions.map((review, index) => <ResultQuestionCard key={review.questionId} review={review} index={index} />)}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

function Metric({ value, label, className }: { value: number; label: string; className: string }) {
  return <div className="flex min-w-0 flex-col gap-0.5 px-3 py-3 sm:px-4"><span className={`font-heading text-xl font-semibold ${className}`}>{value}</span><span className="text-xs leading-tight text-muted-foreground">{label}</span></div>
}
