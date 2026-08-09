'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { QUESTION_TYPES, type QType } from '@/lib/store'
import { TYPE_ICON } from '@/components/question-icons'

export function TypePicker({
  recentType,
  onPick,
}: {
  recentType: QType
  onPick: (type: QType) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // recently used type first, so a single-type flow stays fast
  const ordered = [...QUESTION_TYPES].sort((a, b) => {
    if (a.type === recentType) return -1
    if (b.type === recentType) return 1
    return 0
  })

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-border bg-card/50 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        <Plus className="size-4" aria-hidden />
        Add question
      </button>

      {open ? (
        <div className="absolute bottom-full left-1/2 z-20 mb-2 w-full max-w-md -translate-x-1/2 rounded-[16px] border border-border bg-card p-2 shadow-soft-lg">
          <div className="grid gap-1 sm:grid-cols-2">
            {ordered.map((t) => {
              const Icon = TYPE_ICON[t.type]
              const isRecent = t.type === recentType
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => {
                    onPick(t.type)
                    setOpen(false)
                  }}
                  className={`flex items-start gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-secondary ${
                    isRecent ? 'bg-accent' : ''
                  }`}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex flex-col">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {t.label}
                      {isRecent ? (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          recent
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.hint}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
