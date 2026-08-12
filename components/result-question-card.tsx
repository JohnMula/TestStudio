import { Check, Clock, X } from 'lucide-react'
import { TYPE_ICON } from '@/components/question-icons'
import { typeMeta, type ResultQuestionReview } from '@/lib/types'

const STATUS = {
  correct: {
    label: 'Correct',
    Icon: Check,
    className: 'border-primary/30 bg-accent text-primary',
  },
  incorrect: {
    label: 'Incorrect',
    Icon: X,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  manual: {
    label: 'Manual grading',
    Icon: Clock,
    className:
      'border-[var(--color-amber)]/25 bg-[var(--color-amber)]/15 text-[var(--color-amber)]',
  },
} as const

export function ResultQuestionCard({
  review,
  index,
}: {
  review: ResultQuestionReview
  index: number
}) {
  const meta = typeMeta(review.type)
  const TypeIcon = TYPE_ICON[review.type]
  const status = STATUS[review.status]
  const StatusIcon = status.Icon

  return (
    <section className="flex flex-col gap-5 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Question {index + 1}
          </span>
          <h2 className="whitespace-pre-wrap font-heading text-lg font-semibold leading-snug text-foreground text-balance">
            {review.prompt || (
              <span className="text-muted-foreground">Untitled question</span>
            )}
          </h2>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            <TypeIcon className="size-3.5 text-primary" aria-hidden />
            {meta.label}
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
          >
            <StatusIcon className="size-3.5" aria-hidden />
            {status.label}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <AnswerPanel label="Your answer" lines={review.submittedAnswer} />
        {review.correctAnswer ? (
          <AnswerPanel label="Correct answer" lines={review.correctAnswer} />
        ) : null}
      </div>

      {review.status === 'manual' ? (
        <p className="rounded-[10px] bg-[var(--color-amber)]/10 px-3 py-2 text-sm text-[var(--color-amber)]">
          This response requires manual grading. Your score may change once it
          has been reviewed.
        </p>
      ) : null}

      {review.explanation ? (
        <div className="flex flex-col gap-1.5 rounded-[10px] bg-secondary/60 px-4 py-3">
          <h3 className="text-sm font-medium text-foreground">Rationalization</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {review.explanation}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <span
          className={`text-sm font-medium ${
            review.status === 'correct'
              ? 'text-primary'
              : review.status === 'incorrect'
                ? 'text-destructive'
                : 'text-[var(--color-amber)]'
          }`}
        >
          {review.status === 'manual' ? 'Awaiting manual grade' : status.label}
        </span>
        <span className="font-mono text-sm text-foreground">
          {formatPoints(review.pointsEarned)} / {formatPoints(review.pointsPossible)}{' '}
          {review.pointsPossible === 1 ? 'point' : 'points'}
        </span>
      </div>
    </section>
  )
}

function AnswerPanel({ label, lines }: { label: string; lines: string[] }) {
  const noAnswer = lines.length === 1 && lines[0] === 'No answer submitted'

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-background px-4 py-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </h3>
      {lines.length > 1 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-foreground">
          {lines.map((line, index) => (
            <li key={index} className="whitespace-pre-wrap">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed ${
            noAnswer ? 'text-muted-foreground' : 'text-foreground'
          }`}
        >
          {lines[0] ?? '—'}
        </p>
      )}
    </div>
  )
}

function formatPoints(points: number): string {
  return Number.isInteger(points)
    ? String(points)
    : points.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}
