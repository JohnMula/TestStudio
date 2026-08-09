'use client'

import { useMemo, useState } from 'react'
import { X, Search, Plus, Trash2, Library } from 'lucide-react'
import { useBank, removeFromBank, typeMeta, makeId, type Question } from '@/lib/store'
import { TYPE_ICON } from '@/components/question-icons'

export function BankDialog({
  open,
  onClose,
  onInsert,
}: {
  open: boolean
  onClose: () => void
  onInsert: (question: Question) => void
}) {
  const bank = useBank()
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState<string>('All')

  const subjects = useMemo(() => {
    const set = new Set(bank.map((b) => b.subject))
    return ['All', ...Array.from(set).sort()]
  }, [bank])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bank.filter((b) => {
      const subjOk = subject === 'All' || b.subject === subject
      const textOk =
        !q ||
        b.question.prompt.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q)
      return subjOk && textOk
    })
  }, [bank, query, subject])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Question bank"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[16px] border border-border bg-card shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-6">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <Library className="size-4 text-primary" aria-hidden />
              Question bank
            </span>
            <span className="text-xs text-muted-foreground">
              Reuse questions across every test you make.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-border bg-background px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions…"
              className="w-full bg-transparent py-2 text-sm text-foreground outline-none"
            />
          </div>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Filter by subject"
            className="rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {bank.length === 0
                ? 'Your bank is empty. Save a question from the builder with the bookmark icon.'
                : 'No matching questions.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((item) => {
                const Icon = TYPE_ICON[item.question.type]
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-[12px] border border-border bg-background p-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-foreground">
                        {item.question.prompt || 'Untitled question'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.subject} · {typeMeta(item.question.type).label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onInsert({ ...item.question, id: makeId() })
                      }
                      className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Insert
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromBank(item.id)}
                      aria-label="Remove from bank"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
