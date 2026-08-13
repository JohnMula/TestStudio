'use client'

import { useState } from 'react'
import { X, Eye } from 'lucide-react'
import { QuestionTaker } from '@/components/question-taker'
import {
  possiblePoints,
  toPublicQuestion,
  type Question,
  type Test,
} from '@/lib/store'

export function PreviewDialog({
  open,
  title,
  description,
  questions,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  questions: Question[]
  onClose: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})

  if (!open) return null

  const total = possiblePoints({ questions } as Test)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Preview as test-taker"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="hidden sm:inline">
            Preview — this is exactly what a test-taker sees
          </span>
          <span className="sm:hidden">Preview</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
        >
          <X className="size-4" aria-hidden />
          <span className="hidden sm:inline">Close preview</span>
          <span className="sm:hidden">Close</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Preview
            </span>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground text-balance">
              {title || 'Untitled test'}
            </h1>
            {description.trim() ? (
              <p className="text-sm text-muted-foreground text-pretty">{description}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {questions.length}{' '}
              {questions.length === 1 ? 'question' : 'questions'} · {total}{' '}
              {total === 1 ? 'point' : 'points'} total
            </p>
          </div>

          {questions.length === 0 ? (
            <p className="rounded-[16px] border border-dashed border-border bg-card/50 px-6 py-16 text-center text-sm text-muted-foreground">
              Add a question to preview it.
            </p>
          ) : (
            questions.map((q, i) => (
              <QuestionTaker
                key={q.id}
                question={toPublicQuestion(q)}
                index={i}
                answer={answers[q.id]}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              />
            ))
          )}

          <button
            type="button"
            disabled
            className="self-end rounded-[12px] bg-primary px-6 py-3 text-sm font-medium text-primary-foreground opacity-60"
          >
            Submit (disabled in preview)
          </button>
        </main>
      </div>
    </div>
  )
}
