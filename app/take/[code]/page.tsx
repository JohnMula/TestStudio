'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock3, LockKeyhole, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuestionTaker } from '@/components/question-taker'
import {
  clearQuizProgress,
  getDeviceId,
  isSingleAttemptUsed,
  loadQuizProgress,
  orderedChoiceOptions,
  saveQuizProgress,
  type PublicQuestion,
  type PublicTest,
} from '@/lib/store'
import type { TestResult } from '@/lib/types'
import { possiblePointsPublic, totalPointsPublic } from '@/lib/store'

type Stage = 'intro' | 'quiz' | 'result'

type Props = {
  test: PublicTest | null
  errorMessage?: string | null
}

function makeSeed(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function seededQuestionOrder(
  testId: string,
  attemptSeed: string,
  count: number,
): number[] {
  const indexes = Array.from({ length: count }, (_, i) => i)
  const seed = `${attemptSeed}:${testId}:questions`

  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }

  for (let i = indexes.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    const j = h % (i + 1)
    ;[indexes[i], indexes[j]] = [indexes[j], indexes[i]]
  }

  return indexes
}

export default function TakeTestClient({ test, errorMessage }: Props) {
  const [stage, setStage] = useState<Stage>('intro')
  const [name, setName] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [attemptSeed, setAttemptSeed] = useState('')
  const [result, setResult] = useState<TestResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(errorMessage ?? null)
  const [singleAttemptUsed, setSingleAttemptUsed] = useState(false)

  const turnstileConfigured = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  )

  const order = useMemo(() => {
    if (!test) return []

    if (!test.shuffle || !attemptSeed) {
      return test.questions.map((_, i) => i)
    }

    return seededQuestionOrder(
      test.id,
      attemptSeed,
      test.questions.length,
    )
  }, [test, attemptSeed])

  const deviceId = useMemo(() => {
    if (!test) return ''
    return getDeviceId()
  }, [test])

  useEffect(() => {
    if (!test || !deviceId || !test.singleAttempt) return

    let cancelled = false

    void isSingleAttemptUsed(test.id, deviceId).then((used) => {
      if (!cancelled) setSingleAttemptUsed(used)
    })

    return () => {
      cancelled = true
    }
  }, [test, deviceId])

  useEffect(() => {
    if (!test) return

    const saved = loadQuizProgress(test.id)

    if (!saved) return

    if (saved.name) {
      setName(saved.name)
    }

    if (Object.keys(saved.answers).length > 0) {
      setAnswers(saved.answers)
      setAttemptSeed(saved.attemptSeed || makeSeed())
      setStage('quiz')
    }
  }, [test])

  useEffect(() => {
    if (!test || stage !== 'quiz' || !attemptSeed) return

    saveQuizProgress(test.id, {
      answers,
      name,
      attemptSeed,
    })
  }, [test, stage, answers, name, attemptSeed])

  const orderedQuestions: PublicQuestion[] = useMemo(() => {
    if (!test) return []

    return order.map((index) => {
      const question = test.questions[index]

      if (
        question.type !== 'multiple_choice' ||
        !test.shuffleChoices ||
        !attemptSeed
      ) {
        return question
      }

      return {
        ...question,
        options: orderedChoiceOptions(
          question.options,
          `${attemptSeed}:${test.id}:${question.id}:choices`,
          true,
        ),
      }
    })
  }, [test, order, attemptSeed])

  if (!test) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Test unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {errorMessage || 'This test could not be loaded.'}
          </p>
        </div>
      </main>
    )
  }

  const total = possiblePointsPublic(test)
  const answeredCount = orderedQuestions.filter(
    (question) => answers[question.id] !== undefined,
  ).length

  const allAnswered =
    orderedQuestions.length === 0 || answeredCount === orderedQuestions.length

  function updateAnswer(questionId: string, answer: unknown) {
    setAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }))
  }

  async function submit() {
    if (submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testId: test.id,
          name: name.trim(),
          answers,
          attemptSeed,
          turnstileConfigured,
        }),
      })

      const data = (await response.json()) as {
        ok?: boolean
        result?: TestResult
        error?: string
      }

      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error || 'Unable to submit this test.')
      }

      clearQuizProgress(test.id)
      setResult(data.result)
      setStage('result')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to submit this test.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (stage === 'result' && result) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border bg-card p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-primary" aria-hidden />
              <div>
                <h1 className="text-xl font-semibold">Test submitted</h1>
                <p className="text-sm text-muted-foreground">{test.title}</p>
              </div>
            </div>

            <div className="mt-8 rounded-xl border bg-muted/30 p-6">
              <p className="text-sm text-muted-foreground">Your score</p>
              <p className="mt-1 text-4xl font-semibold">
                {result.score}
                <span className="text-lg text-muted-foreground">
                  {' '}
                  / {total}
                </span>
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/">
                  <ArrowLeft className="mr-2 size-4" aria-hidden />
                  Home
                </Link>
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setAnswers({})
                  setResult(null)
                  setError(null)
                  setAttemptSeed(makeSeed())
                  setStage('intro')
                }}
              >
                Take again
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (stage === 'quiz') {
    return (
      <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{test.title}</p>
              <h1 className="mt-1 text-xl font-semibold">
                {answeredCount} of {orderedQuestions.length} answered
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm text-muted-foreground">
              <Clock3 className="size-4" aria-hidden />
              <span>
                {Math.max(0, test.timeLimitMinutes)} min
              </span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="space-y-5">
            {orderedQuestions.map((question, index) => (
              <section
                key={question.id}
                className="rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="mb-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Question {index + 1}
                  </p>
                </div>

                <QuestionTaker
                  question={question}
                  answer={answers[question.id]}
                  onChange={(value) => updateAnswer(question.id, value)}
                />
              </section>
            ))}
          </div>

          <div className="sticky bottom-4 mt-6 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {answeredCount}/{orderedQuestions.length} answered
              </div>

              <Button
                type="button"
                disabled={!allAnswered || submitting}
                onClick={() => void submit()}
              >
                <Send className="mr-2 size-4" aria-hidden />
                {submitting ? 'Submitting…' : 'Submit test'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <ShieldCheck className="size-6 text-primary" aria-hidden />
            </div>

            <div>
              <h1 className="text-2xl font-semibold">{test.title}</h1>
              {test.description && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {test.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Questions</p>
              <p className="mt-1 font-semibold">{test.questions.length}</p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Total points</p>
              <p className="mt-1 font-semibold">{total}</p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Time limit</p>
              <p className="mt-1 font-semibold">
                {test.timeLimitMinutes} min
              </p>
            </div>
          </div>

          <div className="mt-8">
            <label
              htmlFor="taker-name"
              className="text-sm font-medium"
            >
              Your name
            </label>

            <input
              id="taker-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {singleAttemptUsed && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm">
              <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Attempt already used</p>
                <p className="mt-1 text-muted-foreground">
                  This test only allows one attempt from this browser.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button
              type="button"
              disabled={
                !name.trim() ||
                singleAttemptUsed ||
                submitting
              }
              onClick={() => {
                setAttemptSeed((seed) => seed || makeSeed())
                setStage('quiz')
              }}
            >
              Start test
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}