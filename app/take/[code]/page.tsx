'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { ArrowRight, Clock, Loader2, Lock, Trophy } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { TakeTestBodySkeleton } from '@/components/skeletons/take-test-skeleton'
import { QuestionTaker } from '@/components/question-taker'
import { ResultQuestionCard } from '@/components/result-question-card'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { getPublicTestByCode, hasSubmitted, submitResponse } from '@/lib/actions'
import { clearQuizProgress, getDeviceId, loadQuizProgress, possiblePointsPublic, saveQuizProgress } from '@/lib/store'
import type { TestResult } from '@/lib/types'

type Stage = 'intro' | 'quiz' | 'result'

const TIME_LIMIT_SECONDS: Record<string, number | null> = {
  Off: null,
  '15m': 15 * 60,
  '30m': 30 * 60,
  '60m': 60 * 60,
}

function formatClock(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

export default function TakeTestPage() {
  const params = useParams<{ code: string }>()
  const code = decodeURIComponent(params.code)
  const { data: test, isLoading } = useSWR(['public-test', code], () => getPublicTestByCode(code))
  const [stage, setStage] = useState<Stage>('intro')
  const [name, setName] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [result, setResult] = useState<TestResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const turnstileConfigured =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  const deviceId = useMemo(() => getDeviceId(), [])

  const order = useMemo(() => {
    if (!test) return []
    const indexes = test.questions.map((_, index) => index)
    if (!test.shuffle) return indexes
    for (let index = indexes.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1))
      ;[indexes[index], indexes[other]] = [indexes[other], indexes[index]]
    }
    return indexes
  }, [test?.id])

  useEffect(() => {
    if (!test) return
    const saved = loadQuizProgress(test.id)
    if (saved && Object.keys(saved.answers).length > 0) {
      setAnswers(saved.answers)
      if (saved.name) setName(saved.name)
      setStage('quiz')
    }
  }, [test?.id])

  useEffect(() => {
    if (!test || stage !== 'quiz') return
    saveQuizProgress(test.id, { answers, name })
  }, [test, stage, answers, name])

  const { data: alreadyAttempted } = useSWR(
    test && test.singleAttempt ? ['device-attempted', test.id, deviceId] : null,
    () => hasSubmitted(test!.id, deviceId),
  )

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const deadlineRef = useRef<number | null>(null)
  useEffect(() => {
    if (stage !== 'quiz' || !test) return
    const limit = TIME_LIMIT_SECONDS[test.timeLimit] ?? null
    if (limit == null) {
      setSecondsLeft(null)
      return
    }
    deadlineRef.current = Date.now() + limit * 1000
    setSecondsLeft(limit)
    const interval = window.setInterval(() => {
      const deadline = deadlineRef.current ?? Date.now()
      setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    }, 250)
    return () => window.clearInterval(interval)
  }, [stage, test])

  useEffect(() => {
    if (stage === 'quiz' && secondsLeft === 0 && !submitting) void submit()
    // submit is intentionally not a dependency: adding it would restart the
    // effect each render and can schedule duplicate deadline submissions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft])

  async function submit() {
    if (!test || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await submitResponse(test.id, answers, name, captchaToken, deviceId)
      if (!response.ok) {
        setError(response.error)
        setCaptchaToken('')
        return
      }
      clearQuizProgress(test.id)
      setResult(response.result)
      setStage('result')
      window.scrollTo({ top: 0 })
    } catch {
      setError('Unable to submit this test. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <Shell code={code.toUpperCase()}><TakeTestBodySkeleton /></Shell>
  }
  if (!test) {
    return <Shell code={code.toUpperCase()}><div className="flex flex-col items-center gap-4 py-12 text-center"><h1 className="font-heading text-xl font-semibold text-foreground">No test found for <span className="font-mono">{code.toUpperCase()}</span></h1><p className="text-sm text-muted-foreground">Double-check the code and try again.</p><Link href="/dashboard" className="rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90">Back to dashboard</Link></div></Shell>
  }

  const now = Date.now()
  const notYetOpen = test.opensAt ? now < test.opensAt : false
  const closed = test.closesAt ? now > test.closesAt : false
  const orderedQuestions = order.map((index) => test.questions[index])
  const total = possiblePointsPublic(test)
  const answeredCount = orderedQuestions.filter((question) => answers[question.id] !== undefined).length
  const orderedReviews = result ? orderedQuestions.flatMap((question) => {
    const review = result.questions.find((item) => item.questionId === question.id)
    return review ? [review] : []
  }) : []

  if (notYetOpen || closed) {
    return <Shell code={test.code}><section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-[16px] border border-border bg-card p-6 text-center shadow-soft sm:p-10"><span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">{notYetOpen ? <Clock className="size-6" aria-hidden /> : <Lock className="size-6" aria-hidden />}</span><h1 className="font-heading text-xl font-semibold text-foreground">{notYetOpen ? 'This test hasn’t opened yet' : 'This test is closed'}</h1><p className="text-sm text-muted-foreground">{notYetOpen ? `Opens ${new Date(test.opensAt!).toLocaleString()}.` : `Closed ${new Date(test.closesAt!).toLocaleString()}.`}</p></section></Shell>
  }

  return (
    <Shell code={test.code}>
      {stage === 'intro' ? (
        <section className="flex flex-col gap-6 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:p-8">
          <div className="flex flex-col gap-2"><span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Test ticket</span><h1 className="font-heading text-xl font-semibold tracking-tight text-foreground text-balance sm:text-2xl">{test.title}</h1>{test.description ? <p className="text-sm text-muted-foreground text-pretty">{test.description}</p> : null}<p className="text-sm text-muted-foreground">{orderedQuestions.length} {orderedQuestions.length === 1 ? 'question' : 'questions'} · {total} {total === 1 ? 'point' : 'points'} · {test.timeLimit === 'Off' ? 'No time limit' : `Time limit ${test.timeLimit} (auto-submits when it runs out)`} · No account needed.</p></div>
          {test.singleAttempt && alreadyAttempted ? <div className="flex items-center gap-3 rounded-[10px] border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground"><Lock className="size-4 shrink-0" aria-hidden />This is a one-attempt test, and you&apos;ve already submitted it from this account or browser.</div> : <><label className="flex flex-col gap-2"><span className="text-sm font-medium text-foreground">Your name <span className="text-muted-foreground">(optional)</span></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Leave blank to stay anonymous" className="rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" /></label><button type="button" onClick={() => setStage('quiz')} className="flex items-center justify-center gap-2 rounded-[12px] bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90">Start test <ArrowRight className="size-4" aria-hidden /></button></>}
        </section>
      ) : null}

      {stage === 'quiz' ? (
        <section className="flex flex-col gap-6">
          <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"><div className="flex items-center justify-between font-mono text-xs text-muted-foreground"><span>{answeredCount} / {orderedQuestions.length} answered</span>{secondsLeft != null ? <span className={secondsLeft <= 60 ? 'text-destructive' : undefined}>{formatClock(secondsLeft)} left</span> : null}<span>{total} pts</span></div><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(answeredCount / Math.max(1, orderedQuestions.length)) * 100}%` }} /></div></div>
          {orderedQuestions.map((question, index) => <QuestionTaker key={question.id} question={question} index={index} answer={answers[question.id]} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />)}
          {error ? <p className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:justify-end"><TurnstileWidget onVerify={setCaptchaToken} /><button type="button" onClick={() => void submit()} disabled={submitting || (turnstileConfigured && !captchaToken)} className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-3">{submitting ? <><Loader2 className="size-4 animate-spin" aria-hidden />Submitting…</> : <>Submit test <ArrowRight className="size-4" aria-hidden /></>}</button></div>
        </section>
      ) : null}

      {stage === 'result' && result ? (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col items-center gap-6 rounded-[16px] border border-border bg-card p-6 text-center shadow-soft sm:p-10"><span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary"><Trophy className="size-7" aria-hidden /></span><div className="flex w-full flex-col gap-1"><span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Your results</span><h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{formatPoints(result.scoreEarned)} / {formatPoints(result.totalPossible)}</h1><p className="text-sm text-muted-foreground">Score earned</p><p className="font-heading text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{result.percentage}%</p><div className="mt-4 grid w-full grid-cols-3 divide-x divide-border overflow-hidden rounded-[12px] border border-border bg-background text-left"><Metric value={result.correctCount} label="Correct" className="text-primary" /><Metric value={result.incorrectCount} label="Incorrect" className="text-destructive" /><Metric value={result.manualGradingCount} label="Manual grading" className="text-[var(--color-amber)]" /></div>{result.needsGrading ? <p className="mt-1 text-sm text-[var(--color-amber)]">{result.manualGradingCount} open-ended response{result.manualGradingCount === 1 ? '' : 's'} require manual grading. Your score may change once reviewed.</p> : null}</div><Link href="/dashboard" className="rounded-[12px] border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary">Back to dashboard</Link></section>
          <section className="flex flex-col gap-4"><div className="flex flex-col gap-1 px-1"><h2 className="font-heading text-lg font-semibold text-foreground">Question review</h2><p className="text-sm text-muted-foreground">Review your submitted answers and the correct answers.</p></div>{orderedReviews.map((review, index) => <ResultQuestionCard key={review.questionId} review={review} index={index} />)}</section>
        </div>
      ) : null}
    </Shell>
  )
}

function Shell({ code, children }: { code: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-background"><SiteHeader maxWidth="max-w-2xl" right={<span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">{code}</span>} /><main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">{children}</main></div>
}

function Metric({ value, label, className }: { value: number; label: string; className: string }) {
  return <div className="flex min-w-0 flex-col gap-0.5 px-3 py-3 sm:px-4"><span className={`font-heading text-xl font-semibold ${className}`}>{value}</span><span className="text-xs leading-tight text-muted-foreground">{label}</span></div>
}
