'use client'

import { GripVertical, Plus, Trash2, Check, Bookmark } from 'lucide-react'
import {
  typeMeta,
  makeId,
  type Question,
  type MultipleChoiceQ,
  type IdentificationQ,
  type MatchingQ,
  type FillBlankQ,
  type EnumerationQ,
  type TrueFalseQ,
} from '@/lib/store'
import { TYPE_ICON } from '@/components/question-icons'

const inputCls =
  'w-full rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
  onSaveToBank,
  onHandlePointerDown,
}: {
  question: Question
  index: number
  onChange: (q: Question) => void
  onRemove: () => void
  onSaveToBank: () => void
  onHandlePointerDown: () => void
}) {
  const meta = typeMeta(question.type)
  const Icon = TYPE_ICON[question.type]

  function patch<T extends Question>(p: Partial<T>) {
    onChange({ ...(question as T), ...p })
  }

  return (
    <section className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Drag to reorder"
            onPointerDown={onHandlePointerDown}
            className="cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Q{index + 1}
          </span>
          {/* consistent moss-dot tag for every type */}
          <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            <Icon className="size-3.5 text-primary" aria-hidden />
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSaveToBank}
            aria-label="Save to question bank"
            title="Save to question bank"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Bookmark className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove question ${index + 1}`}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* prompt */}
      <PromptField question={question} onChange={onChange} />

      {/* type-specific body */}
      {question.type === 'multiple_choice' ? (
        <MultipleChoiceBody q={question} patch={patch<MultipleChoiceQ>} />
      ) : null}
      {question.type === 'true_false' ? (
        <TrueFalseBody q={question} patch={patch<TrueFalseQ>} />
      ) : null}
      {question.type === 'identification' ? (
        <IdentificationBody q={question} patch={patch<IdentificationQ>} />
      ) : null}
      {question.type === 'matching' ? (
        <MatchingBody q={question} patch={patch<MatchingQ>} />
      ) : null}
      {question.type === 'fill_blank' ? (
        <FillBlankBody q={question} patch={patch<FillBlankQ>} />
      ) : null}
      {question.type === 'enumeration' ? (
        <EnumerationBody q={question} patch={patch<EnumerationQ>} />
      ) : null}
      {question.type === 'essay' ? (
        <p className="rounded-[10px] bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Open response — no answer key. You&apos;ll grade these by hand after
          the test closes; they&apos;re excluded from the auto-score until then.
        </p>
      ) : null}

      {/* footer: points + explanation */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Points
            <input
              type="number"
              min={1}
              value={question.points}
              onChange={(e) =>
                onChange({
                  ...question,
                  points: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="w-16 rounded-[8px] border border-border bg-background px-2 py-1 font-mono text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
        </div>
        <input
          value={question.explanation ?? ''}
          onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="Optional: why the answer is correct (shown after grading)"
          className={inputCls}
        />
      </div>
    </section>
  )
}

/* ---------- prompt (with fill-blank sync) ---------- */

function PromptField({
  question,
  onChange,
}: {
  question: Question
  onChange: (q: Question) => void
}) {
  const placeholder =
    question.type === 'fill_blank'
      ? 'Type a sentence, using ___ for each blank…'
      : question.type === 'matching'
        ? 'Instructions, e.g. “Match each term to its definition.”'
        : question.type === 'enumeration'
          ? 'Prompt, e.g. “Name the three branches of government.”'
          : 'Type your question…'

  function handleChange(value: string) {
    if (question.type === 'fill_blank') {
      const count = Math.max(1, (value.match(/___/g) || []).length)
      const blanks = Array.from(
        { length: count },
        (_, i) => question.blanks[i] ?? { answers: [''] },
      )
      onChange({ ...question, prompt: value, blanks })
      return
    }
    onChange({ ...question, prompt: value })
  }

  return (
    <input
      value={question.prompt}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
    />
  )
}

/* ---------- multiple choice ---------- */

function MultipleChoiceBody({
  q,
  patch,
}: {
  q: MultipleChoiceQ
  patch: (p: Partial<MultipleChoiceQ>) => void
}) {
  function toggleCorrect(i: number) {
    const optionId = q.options[i]?.id
    if (!optionId) return
    if (q.multiple) {
      const has = q.correct.includes(optionId)
      patch({
        correct: has
          ? q.correct.filter((id) => id !== optionId)
          : [...q.correct, optionId],
      })
    } else {
      patch({ correct: [optionId] })
    }
  }

  function setOption(i: number, value: string) {
    patch({
      options: q.options.map((option, idx) =>
        idx === i ? { ...option, text: value } : option,
      ),
    })
  }

  function addOption() {
    if (q.options.length < 6) {
      patch({ options: [...q.options, { id: makeId(), text: '' }] })
    }
  }

  function removeOption(i: number) {
    if (q.options.length <= 2) return
    const optionId = q.options[i]?.id
    const options = q.options.filter((_, idx) => idx !== i)
    const correct = q.correct.filter((id) => id !== optionId)
    patch({ options, correct: correct.length ? correct : [options[0].id] })
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={q.multiple}
          onChange={(e) => {
            const multiple = e.target.checked
            patch({
              multiple,
              correct: multiple
                ? q.correct
                : [q.correct[0] ?? q.options[0]?.id].filter(
                    (id): id is string => Boolean(id),
                  ),
            })
          }}
          className="size-3.5 accent-[var(--color-primary)]"
        />
        Allow multiple correct answers
      </label>
      <span className="text-xs text-muted-foreground">
        {q.multiple
          ? 'Check every correct option.'
          : 'Tap the circle to mark the correct answer.'}
      </span>
      {q.options.map((opt, i) => {
        const correct = q.correct.includes(opt.id)
        return (
          <div key={opt.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCorrect(i)}
              aria-label={`Mark option ${i + 1} correct`}
              aria-pressed={correct}
              className={`flex size-6 shrink-0 items-center justify-center border transition-colors ${
                q.multiple ? 'rounded-[6px]' : 'rounded-full'
              } ${
                correct
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-transparent hover:border-primary'
              }`}
            >
              <Check className="size-3.5" aria-hidden />
            </button>
            <input
              value={opt.text}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className={inputCls}
            />
            {q.options.length > 2 ? (
              <button
                type="button"
                onClick={() => removeOption(i)}
                aria-label={`Remove option ${i + 1}`}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        )
      })}
      {q.options.length < 6 ? (
        <button
          type="button"
          onClick={addOption}
          className="flex items-center gap-1.5 self-start text-sm text-primary transition-opacity hover:opacity-80"
        >
          <Plus className="size-4" aria-hidden />
          Add option
        </button>
      ) : null}
    </div>
  )
}

/* ---------- true / false ---------- */

function TrueFalseBody({
  q,
  patch,
}: {
  q: TrueFalseQ
  patch: (p: Partial<TrueFalseQ>) => void
}) {
  return (
    <div className="flex items-center gap-2">
      {[true, false].map((val) => (
        <button
          key={String(val)}
          type="button"
          onClick={() => patch({ answer: val })}
          className={`flex-1 rounded-[10px] border px-4 py-2 text-sm font-medium transition-colors ${
            q.answer === val
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground hover:border-primary/50'
          }`}
        >
          {val ? 'True' : 'False'}
        </button>
      ))}
    </div>
  )
}

/* ---------- identification ---------- */

function IdentificationBody({
  q,
  patch,
}: {
  q: IdentificationQ
  patch: (p: Partial<IdentificationQ>) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <input
        value={q.answer}
        onChange={(e) => patch({ answer: e.target.value })}
        placeholder="Correct answer"
        className={inputCls}
      />
      <input
        value={q.alternates.join(', ')}
        onChange={(e) =>
          patch({
            alternates: e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder="Accepted alternate spellings (comma-separated)"
        className={inputCls}
      />
    </div>
  )
}

/* ---------- matching ---------- */

function MatchingBody({
  q,
  patch,
}: {
  q: MatchingQ
  patch: (p: Partial<MatchingQ>) => void
}) {
  function setPair(id: string, side: 'left' | 'right', value: string) {
    patch({
      pairs: q.pairs.map((p) => (p.id === id ? { ...p, [side]: value } : p)),
    })
  }
  return (
    <div className="flex flex-col gap-3 sm:gap-2">
      <div className="hidden grid-cols-[1fr_1fr_auto] gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground sm:grid">
        <span>Left</span>
        <span>Right (match)</span>
        <span className="sr-only">Remove</span>
      </div>
      {q.pairs.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-2 rounded-[12px] border border-border bg-background/60 p-2 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
        >
          <div className="grid flex-1 grid-cols-1 gap-2 sm:contents sm:grid-cols-2">
            <input
              value={p.left}
              onChange={(e) => setPair(p.id, 'left', e.target.value)}
              placeholder="Term"
              className={inputCls}
            />
            <input
              value={p.right}
              onChange={(e) => setPair(p.id, 'right', e.target.value)}
              placeholder="Definition"
              className={inputCls}
            />
          </div>
          {q.pairs.length > 2 ? (
            <button
              type="button"
              onClick={() => patch({ pairs: q.pairs.filter((x) => x.id !== p.id) })}
              aria-label="Remove pair"
              className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : (
            <span className="hidden size-4 sm:block" />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          patch({ pairs: [...q.pairs, { id: makeId(), left: '', right: '' }] })
        }
        className="flex items-center gap-1.5 self-start text-sm text-primary transition-opacity hover:opacity-80"
      >
        <Plus className="size-4" aria-hidden />
        Add pair
      </button>
    </div>
  )
}

/* ---------- fill in the blank ---------- */

function FillBlankBody({
  q,
  patch,
}: {
  q: FillBlankQ
  patch: (p: Partial<FillBlankQ>) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">
        {q.blanks.length} {q.blanks.length === 1 ? 'blank' : 'blanks'} detected.
        Add accepted answers for each.
      </span>
      {q.blanks.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            #{i + 1}
          </span>
          <input
            value={b.answers.join(', ')}
            onChange={(e) =>
              patch({
                blanks: q.blanks.map((blank, idx) =>
                  idx === i
                    ? {
                        answers: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }
                    : blank,
                ),
              })
            }
            placeholder="Accepted answer(s), comma-separated"
            className={inputCls}
          />
        </div>
      ))}
    </div>
  )
}

/* ---------- enumeration ---------- */

function EnumerationBody({
  q,
  patch,
}: {
  q: EnumerationQ
  patch: (p: Partial<EnumerationQ>) => void
}) {
  function setAnswer(i: number, value: string) {
    patch({ answers: q.answers.map((a, idx) => (idx === i ? value : a)) })
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={q.requireOrder}
          onChange={(e) => patch({ requireOrder: e.target.checked })}
          className="size-3.5 accent-[var(--color-primary)]"
        />
        Require answers in order
      </label>
      {q.answers.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {i + 1}.
          </span>
          <input
            value={a}
            onChange={(e) => setAnswer(i, e.target.value)}
            placeholder={`Accepted answer ${i + 1}`}
            className={inputCls}
          />
          {q.answers.length > 1 ? (
            <button
              type="button"
              onClick={() =>
                patch({ answers: q.answers.filter((_, idx) => idx !== i) })
              }
              aria-label={`Remove answer ${i + 1}`}
              className="text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : (
            <span className="size-4" />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => patch({ answers: [...q.answers, ''] })}
        className="flex items-center gap-1.5 self-start text-sm text-primary transition-opacity hover:opacity-80"
      >
        <Plus className="size-4" aria-hidden />
        Add answer
      </button>
    </div>
  )
}
