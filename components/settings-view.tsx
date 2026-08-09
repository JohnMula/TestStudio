'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

/* ---------- small primitives ---------- */

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-secondary'
      }`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-card shadow-soft transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap items-center gap-1 rounded-[10px] border border-border bg-background p-1"
    >
      {options.map((option) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={`rounded-[7px] px-3 py-1 font-mono text-xs transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[16px] border border-border bg-card shadow-soft">
      <div className="flex flex-col gap-1 px-4 pb-4 pt-6 sm:px-6">
        <h2 className="font-heading text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}

function Row({
  label,
  description,
  control,
}: {
  label: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      <div className="sm:shrink-0">{control}</div>
    </div>
  )
}

/* ---------- view ---------- */

export function SettingsView() {
  const [timeLimit, setTimeLimit] = useState<'Off' | '15m' | '30m' | '60m'>(
    '15m',
  )
  const [shuffle, setShuffle] = useState(true)
  const [singleAttempt, setSingleAttempt] = useState(false)

  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON' | 'PDF'>(
    'CSV',
  )
  const [includeTimestamps, setIncludeTimestamps] = useState(true)
  const [autoExport, setAutoExport] = useState(false)

  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Default test settings"
        description="Applied to every new test. You can override these per test."
      >
        <Row
          label="Time limit"
          description="Countdown shown to test-takers once they start."
          control={
            <Segmented
              label="Default time limit"
              options={['Off', '15m', '30m', '60m'] as const}
              value={timeLimit}
              onChange={setTimeLimit}
            />
          }
        />
        <Row
          label="Shuffle questions"
          description="Randomize question order for each test-taker."
          control={
            <Toggle
              label="Shuffle questions"
              checked={shuffle}
              onChange={setShuffle}
            />
          }
        />
        <Row
          label="Single-attempt lock"
          description="Once submitted, a code can't be used again from the same device."
          control={
            <Toggle
              label="Single-attempt lock"
              checked={singleAttempt}
              onChange={setSingleAttempt}
            />
          }
        />
      </Card>

      <Card
        title="Export preferences"
        description="How results are packaged when you download them."
      >
        <Row
          label="File format"
          control={
            <Segmented
              label="Export file format"
              options={['CSV', 'JSON', 'PDF'] as const}
              value={exportFormat}
              onChange={setExportFormat}
            />
          }
        />
        <Row
          label="Include timestamps"
          description="Add start and submit times to each response."
          control={
            <Toggle
              label="Include timestamps"
              checked={includeTimestamps}
              onChange={setIncludeTimestamps}
            />
          }
        />
        <Row
          label="Auto-export on close"
          description="Email a copy of results when a test is closed."
          control={
            <Toggle
              label="Auto-export on close"
              checked={autoExport}
              onChange={setAutoExport}
            />
          }
        />
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="flex items-center gap-1.5 text-sm text-primary">
            <Check className="size-4" aria-hidden />
            Changes saved
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          className="rounded-[12px] bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
        >
          Save changes
        </button>
      </div>
    </div>
  )
}
