'use client'

import { Check } from 'lucide-react'
import { typeMeta, type PublicQuestion } from '@/lib/store'
import { TYPE_ICON } from '@/components/question-icons'
import { AutosizeTextarea } from '@/components/autosize-textarea'

const inputCls =
  'w-full rounded-[10px] border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function QuestionTaker({
  question,
  index,
  answer,
  onChange,
  disabled = false,
}: {
  question: PublicQuestion
  index: number
  answer: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}) {
  const meta = typeMeta(question.type)
  const Icon = TYPE_ICON[question.type]

  return (
    <section className="flex flex-col gap-5 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold leading-snug text-foreground text-balance">
          <span className="mr-2 font-mono text-sm font-normal text-muted-foreground">
            {index + 1}.
          </span>
          {question.prompt || (
            <span className="text-muted-foreground">Untitled question</span>
          )}
        </h2>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
          <Icon className="size-3.5 text-primary" aria-hidden />
          {question.points} {question.points === 1 ? 'pt' : 'pts'}
        </span>
      </div>

      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="sr-only">{meta.label} answer</legend>

        {question.type === 'multiple_choice'
          ? question.options.map((option) => {
              const opt = option.text
              const sel = Array.isArray(answer)
                ? (answer as string[]).includes(option.id)
                : false
              function toggle() {
                if (question.type !== 'multiple_choice') return
                const cur = Array.isArray(answer) ? (answer as string[]) : []
                if (question.multiple) {
                  onChange(
                    cur.includes(option.id)
                      ? cur.filter((id) => id !== option.id)
                      : [...cur, option.id],
                  )
                } else {
                  onChange([option.id])
                }
              }
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={toggle}
                  className={`flex items-center gap-3 rounded-[12px] border px-4 py-3 text-left text-sm transition-colors ${
                    sel
                      ? 'border-primary bg-accent text-foreground'
                      : 'border-border bg-background text-foreground hover:border-primary/50'
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center border ${
                      question.multiple ? 'rounded-[6px]' : 'rounded-full'
                    } ${
                      sel
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-transparent'
                    }`}
                  >
                    <Check className="size-3" aria-hidden />
                  </span>
                  {opt || <span className="text-muted-foreground">—</span>}
                </button>
              )
            })
          : null}

        {question.type === 'true_false'
          ? [true, false].map((val) => {
              const active = answer === val
              return (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => onChange(val)}
                  className={`flex-1 rounded-[12px] border px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:border-primary/50'
                  }`}
                >
                  {val ? 'True' : 'False'}
                </button>
              )
            })
          : null}

        {question.type === 'identification' ? (
          <AutosizeTextarea
            value={typeof answer === 'string' ? answer : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your answer…"
            className={inputCls}
          />
        ) : null}

        {question.type === 'fill_blank' ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: question.blankCount }).map((_, bi) => {
              const arr = Array.isArray(answer) ? (answer as string[]) : []
              return (
                <label key={bi} className="flex items-start gap-2">
                  <span className="mt-2 font-mono text-xs text-muted-foreground">
                    #{bi + 1}
                  </span>
                  <AutosizeTextarea
                    value={arr[bi] ?? ''}
                    onChange={(e) => {
                      const next = [...arr]
                      next[bi] = e.target.value
                      onChange(next)
                    }}
                    placeholder={`Blank ${bi + 1}`}
                    className={inputCls}
                  />
                </label>
              )
            })}
          </div>
        ) : null}

        {question.type === 'enumeration' ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: question.answerCount }).map((_, ai) => {
              const arr = Array.isArray(answer) ? (answer as string[]) : []
              return (
                <label key={ai} className="flex items-start gap-2">
                  <span className="mt-2 font-mono text-xs text-muted-foreground">
                    {ai + 1}.
                  </span>
                  <AutosizeTextarea
                    value={arr[ai] ?? ''}
                    onChange={(e) => {
                      const next = [...arr]
                      next[ai] = e.target.value
                      onChange(next)
                    }}
                    placeholder={`Answer ${ai + 1}`}
                    className={inputCls}
                  />
                </label>
              )
            })}
          </div>
        ) : null}

        {question.type === 'matching' ? (
          <MatchingTaker
            question={question}
            answer={answer}
            onChange={onChange}
          />
        ) : null}

        {question.type === 'essay' ? (
          <div className="flex flex-col gap-1.5">
            <AutosizeTextarea
              value={typeof answer === 'string' ? answer : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Write your response…"
              rows={5}
              className={inputCls}
            />
            <span className="text-xs text-muted-foreground">
              Graded by hand after the test closes.
            </span>
          </div>
        ) : null}
      </fieldset>
    </section>
  )
}

function MatchingTaker({
  question,
  answer,
  onChange,
}: {
  question: Extract<PublicQuestion, { type: 'matching' }>
  answer: unknown
  onChange: (value: unknown) => void
}) {
  const map =
    answer && typeof answer === 'object'
      ? (answer as Record<string, string>)
      : {}

  return (
    <div className="flex flex-col gap-2">
      {question.lefts.map((left) => (
        <div
          key={left.key}
          className="flex flex-col gap-2 rounded-[12px] border border-border bg-background px-4 py-3 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3"
        >
          <span className="text-sm text-foreground">
            {left.text || <span className="text-muted-foreground">—</span>}
          </span>
          <select
            value={map[left.key] ?? ''}
            onChange={(e) => onChange({ ...map, [left.key]: e.target.value })}
            className="w-full rounded-[8px] border border-border bg-card px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary sm:w-auto"
          >
            <option value="">Choose…</option>
            {question.rights.map((right) => (
              <option key={right.key} value={right.key}>
                {right.text || '—'}
              </option>
            ))}
          </select>
        </div>
      ))} 
    </div>
  )
}